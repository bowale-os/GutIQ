# app/ai_llm/red_flag_check.py
"""
Semantic red flag check — second gate, runs in parallel with Qdrant retrieval.

Catches signals keyword matching misses:
  "I can barely move", "came on out of nowhere", "shoulder tip pain",
  "doubled over", "sweating and shaking", "feels like something is wrong"

Fail-safe: any API error returns (False, None) — a check failure
never blocks the user from receiving relief steps.
"""

import json
import logging

import anthropic

from app.core.config import settings

logger  = logging.getLogger(__name__)
_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

_SYSTEM_PROMPT = """\
You are a medical triage classifier for a gut health app.

Your only job: decide if the user's description contains signs of a medical \
emergency or urgent condition requiring immediate attention — NOT routine gut pain.

Emergency signals include but are not limited to:
- Sudden onset: "came out of nowhere", "hit me all at once", "out of nowhere"
- Inability to function: "can barely move", "doubled over", "can't stand up"
- Referred shoulder tip pain — sign of biliary or diaphragmatic emergency
- Systemic signs: sweating, fainting, shaking, pallor, feeling faint
- Internal bleeding signs: black or tarry stool, coffee-ground vomit
- Peritoneal signs: rigid abdomen, rebound tenderness, board-like stomach
- Intensity 9–10 with sudden onset is always a red flag
- Any language suggesting the user feels something is seriously wrong

Return ONLY valid JSON. No explanation. No preamble:
{"red_flag": true,  "reason": "One calm sentence explaining why."}
{"red_flag": false, "reason": null}
"""


async def semantic_red_flag_check(
    description: str,
    intensity: int,
    regions: list[str],
) -> tuple[bool, str | None]:
    """
    Returns (is_red_flag, reason).

    Runs in parallel with Qdrant retrieval — net latency impact is near zero.
    Fails safe on any API error so a check failure never blocks relief steps.
    """
    user_content = (
        f"Pain description: {description}\n"
        f"Intensity: {intensity}/10\n"
        f"Body regions: {', '.join(regions) if regions else 'not specified'}"
    )
    try:
        msg = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            temperature=0,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
        data = json.loads(msg.content[0].text.strip())
        is_flag = bool(data.get("red_flag"))
        reason  = data.get("reason") or None
        if is_flag:
            logger.warning(
                "semantic_red_flag_check fired | reason=%s intensity=%d",
                reason, intensity,
            )
        return is_flag, reason
    except Exception:
        logger.exception("semantic_red_flag_check failed — failing safe (False)")
        return False, None
