# app/ai_llm/gut_check_profile.py
"""
Health profile maintenance for the GutCheck agent.

The profile is a compact (~400 token) Claude-generated summary of the
user's complete log history. It lives on the User row and is updated
incrementally in the background — never blocking a request.

Trigger: every 5 new logs saved (tracked via User.logs_since_last_profile_change).
Update strategy: Claude receives the existing profile + the N newest logs only,
  so we never re-process the full history on each update.

Debug tip:
  POST /gutcheck/profile/regenerate  to force a full rebuild for testing.
"""

import json
import logging
import uuid
from datetime import datetime

import anthropic
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.core.config import settings
from app.core.utils import utcnow
from app.models.log import Log
from app.models.user import User
from app.models.confirmed_trigger import ConfirmedTrigger
from app.ai_llm.gut_check_prompt import format_log
from app.ai_llm import pattern_engine

logger = logging.getLogger(__name__)

_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL   = "claude-haiku-4-5-20251001"

PROFILE_SYSTEM_PROMPT = """\
You maintain a compact health profile for a gut health app called GutIQ.
The profile is injected into an AI analyst's context on every conversation turn.
It must be accurate, dense, and under 500 tokens.

Format rules:
- Start with a one-line summary: "HEALTH PROFILE — [Name] ([date range], [N] logs)"
- Group observations under clear headings: TOP PATTERNS, BEST PERIODS, WORST PERIODS,
  SAFE FOODS, TRIGGER FOODS, LONG-TERM TREND
- Use plain sentences. No bullet symbols. No markdown.
- Cite date ranges and rough percentages where meaningful.
- Only include a pattern if it appears in 3 or more entries.
- Never diagnose. Describe observations only.\
"""


async def regenerate_profile(user_id, db_session: AsyncSession) -> None:
    """
    Regenerate the user's health profile from all their logs.
    Called when logs_since_last_profile_change >= 5 or via manual trigger.

    Runs as a background task — failures are logged but not raised.
    """
    try:
        # Load user
        user = await db_session.get(User, user_id)
        if not user:
            logger.warning("regenerate_profile: user %s not found", user_id)
            return

        # Load all logs (no date limit — profile covers full history)
        result = await db_session.execute(
            select(Log)
            .where(Log.user_id == user_id)
            .options(
                selectinload(Log.food_entries),
                selectinload(Log.symptom_entries),
                selectinload(Log.wellness_entry),
            )
            .order_by(Log.logged_at.asc())
        )
        logs = list(result.scalars().all())

        if not logs:
            logger.info("regenerate_profile: no logs for user %s, skipping", user_id)
            return

        formatted        = [format_log(l) for l in logs]
        is_full_rebuild  = not user.health_profile_summary
        existing         = user.health_profile_summary or "No existing profile."

        # Full rebuild: send all logs so no long-term pattern is missed.
        # Incremental update: send only the 20 newest to keep the prompt small
        # and let Claude merge them into the existing profile.
        recent_formatted = formatted if is_full_rebuild else formatted[-20:]

        label = "All logs for full profile build" if is_full_rebuild else "New or updated logs to incorporate"

        user_message = (
            f"Existing profile:\n{existing}\n\n"
            f"{label} ({len(recent_formatted)} entries):\n"
            f"{json.dumps(recent_formatted, indent=2)}\n\n"
            f"Total log history: {len(formatted)} entries "
            f"from {formatted[0]['date']} to {formatted[-1]['date']}.\n\n"
            "Update the profile. Keep it under 500 tokens. "
            "Preserve confirmed long-term patterns. Update statistics. "
            "Add a pattern only if it appears in 3 or more entries."
        )

        logger.info(
            "regenerate_profile | user=%s mode=%s total_logs=%d logs_sent=%d",
            user_id,
            "full_rebuild" if is_full_rebuild else "incremental",
            len(formatted),
            len(recent_formatted),
        )

        response = await _client.messages.create(
            model=MODEL,
            max_tokens=650,
            temperature=0.3,
            system=PROFILE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        new_profile = response.content[0].text.strip()

        user.health_profile_summary        = new_profile
        user.profile_updated_at            = utcnow()
        user.logs_since_last_profile_change = 0

        await update_pattern_cache(user, logs, db_session)
        await db_session.commit()

        logger.info(
            "regenerate_profile: done | user=%s profile_tokens=%d",
            user_id, response.usage.output_tokens,
        )

    except Exception:
        await db_session.rollback()
        logger.exception("regenerate_profile failed for user %s", user_id)


def should_regenerate(user: User) -> bool:
    """Return True if the profile is due for an update."""
    return user.logs_since_last_profile_change >= 5


# ── Pattern cache ──────────────────────────────────────────────────────────────

def _logs_to_pattern_payload(logs: list[Log]) -> list[dict]:
    """Convert ORM Log objects to the flat dicts pattern_engine.run() expects."""
    rows = []
    for log in logs:
        severities = [s.severity for s in log.symptom_entries if s.severity is not None]
        rows.append({
            "severity":    sum(severities) / len(severities) if severities else None,
            "foods":       [f.name for f in log.food_entries],
            "stress":      log.wellness_entry.stress      if log.wellness_entry else None,
            "sleep_hours": log.wellness_entry.sleep_hours if log.wellness_entry else None,
            "exercise":    log.wellness_entry.exercise    if log.wellness_entry else None,
        })
    return rows


async def update_pattern_cache(user: User, logs: list[Log], db_session: AsyncSession) -> None:
    """
    Run the pattern engine over all user logs, write result to pattern_cache,
    and upsert any confirmable signals into confirmed_triggers.
    Called from regenerate_profile — never blocks a request.
    """
    payload = _logs_to_pattern_payload(logs)
    result  = pattern_engine.run(payload)

    user.pattern_cache            = json.dumps(result)
    user.pattern_cache_updated_at = utcnow()

    confirmable = [s for s in result["triggers"] + result["protective"] if s.get("confirmable")]

    for signal in confirmable:
        stmt = (
            pg_insert(ConfirmedTrigger)
            .values(
                id              = uuid.uuid4(),
                user_id         = user.id,
                variable_type   = signal["variable_type"],
                variable_value  = signal["variable_value"],
                direction       = signal["direction"],
                pain_delta      = signal["delta"],
                avg_pain_with   = signal["avg_with"],
                avg_pain_without= signal["avg_without"],
                sample_size     = signal["sample_size"],
                confirmed_at    = utcnow(),
            )
            .on_conflict_do_update(
                constraint="uq_confirmed_trigger",
                set_=dict(
                    pain_delta       = signal["delta"],
                    avg_pain_with    = signal["avg_with"],
                    avg_pain_without = signal["avg_without"],
                    sample_size      = signal["sample_size"],
                    confirmed_at     = utcnow(),
                ),
            )
        )
        await db_session.execute(stmt)

    logger.info(
        "update_pattern_cache | user=%s triggers=%d protective=%d confirmable=%d",
        user.id, len(result["triggers"]), len(result["protective"]), len(confirmable),
    )
