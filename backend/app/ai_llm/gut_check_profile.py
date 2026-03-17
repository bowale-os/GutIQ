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
from datetime import datetime

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.core.config import settings
from app.core.utils import utcnow
from app.models.log import Log
from app.models.user import User
from app.ai_llm.gut_check_prompt import format_log

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
            system=PROFILE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        new_profile = response.content[0].text.strip()

        user.health_profile_summary        = new_profile
        user.profile_updated_at            = utcnow()
        user.logs_since_last_profile_change = 0

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
