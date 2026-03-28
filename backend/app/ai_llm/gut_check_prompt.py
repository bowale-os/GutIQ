# app/ai_llm/gut_check_prompt.py
"""
System prompt builder and log formatter for the GutCheck agent.

The system prompt injects two layers of context:
  1. Long-term health profile  — compact summary of all logs (if available)
  2. Recent raw logs            — last 30 days in full detail

Together these cover ~80% of questions with no tool calls needed.
Tools fire only when neither layer can answer the question.
"""

import json
from typing import Optional

from app.models.log import Log, WellnessEntry
from app.models.user import User


# ── Log formatter ──────────────────────────────────────────────────────────────

def format_log(log: Log) -> dict:
    """
    Convert a Log ORM object (with relations loaded) into a clean dict
    that Claude can read and reason over directly.
    """
    foods = [f.name for f in (log.food_entries or [])]
    symptoms = [
        {"name": s.name, "severity": s.severity}
        for s in (log.symptom_entries or [])
    ]
    wellness = {}
    w: Optional[WellnessEntry] = log.wellness_entry
    if w:
        if w.stress:
            wellness["stress"] = w.stress
        if w.sleep_hours is not None:
            wellness["sleep_hours"] = w.sleep_hours
        if w.exercise:
            wellness["exercise"] = w.exercise

    # Pick the highest severity across all symptoms for a quick scan value
    severities = [s["severity"] for s in symptoms if s["severity"] is not None]
    overall_severity = max(severities) if severities else None

    return {
        "date": log.logged_at.strftime("%Y-%m-%d"),
        "summary": log.natural_summary or "",
        "foods": foods,
        "symptoms": symptoms,
        "severity": overall_severity,
        "wellness": wellness or None,
    }


# ── System prompt ──────────────────────────────────────────────────────────────

def build_system_prompt(
    user: User,
    recent_logs: list[dict],
    profile: Optional[str],
    confirmed_triggers: Optional[list[dict]] = None,
) -> str:
    """
    Build the full system prompt injected on every GutCheck call.

    Args:
        user:               The authenticated User object.
        recent_logs:        Last 30 days of logs, already formatted via format_log().
        profile:            The stored health profile summary string, or None.
        confirmed_triggers: Rows from confirmed_triggers table for this user, or None.
    """
    log_count = len(recent_logs)
    date_range = _date_range(recent_logs)

    # ── User context block ─────────────────────────────────────────────────────
    condition_raw = (user.digestive_condition or "").strip().lower()
    if not condition_raw or condition_raw == "undiagnosed":
        condition_line = (
            f"{user.name} hasn't been diagnosed yet and is tracking symptoms "
            f"to find patterns that might explain what's going on."
        )
    else:
        condition_line = f"{user.name} is managing: {user.digestive_condition}."

    context_parts = [condition_line]
    if user.goal:
        context_parts.append(f"Goal: {user.goal}")
    if user.medications:
        context_parts.append(f"Current medications: {user.medications}")
    if user.dietary_protocol and user.dietary_protocol not in ("none", ""):
        context_parts.append(f"Dietary protocol: {user.dietary_protocol}")

    context_block = "\n".join(context_parts)
    # ──────────────────────────────────────────────────────────────────────────

    profile_section = profile.strip() if profile else (
        "No long-term profile built yet — reason from recent logs only."
    )

    recent_section = (
        json.dumps(recent_logs, indent=2)
        if recent_logs
        else "No logs in the last 30 days."
    )

    confirmed_section = _format_confirmed_triggers(confirmed_triggers or [])

    return f"""\
You are Tiwa, a personal gut health analyst built into GutIQ.
You are talking to {user.name}.

{context_block}

Your job is to help them understand their gut health patterns using their own logged data. \
You are not a doctor. You surface observations, name patterns, and suggest things worth trying. \
You never diagnose or prescribe.

When you refer to severity scores, always explain them in plain language. \
Never say "severity 7" alone. Instead say something like "a 7 out of 10, so pretty painful" \
or "rated a 4 out of 10, which is uncomfortable but manageable." \
Always translate the number into what it actually means for the person.

Write in a warm, soothing, and deeply explanatory tone. Imagine you are a knowledgeable, \
caring friend walking {user.name} through exactly what you see in their data, step by step. \
Explain not just what happened, but why it matters and what it means for their body. \
Write as if the person has never thought about gut health before and deserves a full, \
gentle explanation rather than a quick summary. \
Never use em dashes (the long dash character). Never use markdown formatting of any kind: \
no bold, no bullet points, no numbered lists, no headers, no asterisks. \
Use short paragraphs separated by line breaks. Two paragraphs maximum per response.

When you identify a pattern, cite what you can actually see in the data: specific dates, \
foods, what happened and when. Avoid vague statements. Instead say: \
"I can see that...", "Looking at your logs...", "On the days when..."

━━━ LONG-TERM HEALTH PROFILE ━━━
{profile_section}
{confirmed_section}
━━━ RECENT LOGS — last 30 days ({log_count} entries{date_range}) ━━━
{recent_section}

━━━ TOOL USAGE RULES ━━━
- Questions about the last 30 days     → reason from the logs above, no tool needed
- Questions about long-term trends     → reason from the profile above, no tool needed
- "Every time X", "has X ever", "how many times X happened"
                                       → call query_logs (searches full history)
- "Why does X happen", "is there research on X", "what does science say"
                                       → call fetch_research
- Never call query_logs for recent questions — the data is already here.

━━━ SAFETY CLASSIFICATION ━━━
At the very end of every response, on its own line, append exactly one tag:
[SAFETY:none]         — general gut health discussion, no escalation needed
[SAFETY:see_doctor]   — you are recommending they consult a doctor or healthcare provider
[SAFETY:emergency]    — you are describing symptoms that require urgent or emergency care
This tag is stripped before being shown to the user. It is for system use only.\
"""


# ── Internal helpers ───────────────────────────────────────────────────────────

def _format_confirmed_triggers(triggers: list[dict]) -> str:
    """
    Format confirmed triggers into a prompt section.
    Returns an empty string if there are none so the prompt stays clean.
    """
    if not triggers:
        return ""

    bad  = [t for t in triggers if t["direction"] == "trigger"]
    good = [t for t in triggers if t["direction"] == "protective"]

    lines = ["\n━━━ CONFIRMED PATTERNS (verified from this user's full history) ━━━",
             "These are statistically significant findings from their own data.",
             "Reference them confidently when relevant — they are not guesses.\n"]

    if bad:
        lines.append("Raise pain:")
        for t in bad:
            lines.append(
                f"  {t['variable_value']} ({t['variable_type']}): "
                f"avg pain {t['avg_pain_with']:.1f} on days with it vs "
                f"{t['avg_pain_without']:.1f} without — "
                f"{t['sample_size']} logs"
            )

    if good:
        lines.append("Lower pain:")
        for t in good:
            lines.append(
                f"  {t['variable_value']} ({t['variable_type']}): "
                f"avg pain {t['avg_pain_with']:.1f} on days with it vs "
                f"{t['avg_pain_without']:.1f} without — "
                f"{t['sample_size']} logs"
            )

    return "\n".join(lines) + "\n"


def _date_range(logs: list[dict]) -> str:
    if not logs:
        return ""
    dates = [l["date"] for l in logs if l.get("date")]
    if not dates:
        return ""
    return f", {min(dates)} → {max(dates)}"
