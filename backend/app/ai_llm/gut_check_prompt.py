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
) -> str:
    """
    Build the full system prompt injected on every GutCheck call.

    Args:
        user:         The authenticated User object.
        recent_logs:  Last 30 days of logs, already formatted via format_log().
        profile:      The stored health profile summary string, or None.
    """
    condition = user.digestive_condition or "not specified"
    log_count = len(recent_logs)
    date_range = _date_range(recent_logs)

    profile_section = profile.strip() if profile else (
        "No long-term profile built yet — reason from recent logs only."
    )

    recent_section = (
        json.dumps(recent_logs, indent=2)
        if recent_logs
        else "No logs in the last 30 days."
    )

    return f"""\
You are Tiwa, a personal gut health analyst built into GutIQ.
You are talking to {user.name}, who is managing: {condition}.

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

━━━ RECENT LOGS — last 30 days ({log_count} entries{date_range}) ━━━
{recent_section}

━━━ TOOL USAGE RULES ━━━
- Questions about the last 30 days     → reason from the logs above, no tool needed
- Questions about long-term trends     → reason from the profile above, no tool needed
- "Every time X", "has X ever", "how many times X happened"
                                       → call query_logs (searches full history)
- "Why does X happen", "is there research on X", "what does science say"
                                       → call fetch_research
- Never call query_logs for recent questions — the data is already here.\
"""


# ── Internal helpers ───────────────────────────────────────────────────────────

def _date_range(logs: list[dict]) -> str:
    if not logs:
        return ""
    dates = [l["date"] for l in logs if l.get("date")]
    if not dates:
        return ""
    return f", {min(dates)} → {max(dates)}"
