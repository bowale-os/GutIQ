# app/ai_llm/pain_relief_gen.py
"""
Claude generation step for the pain relief pipeline.

Returns a StructuredRelief object — JSON parsed and validated by Pydantic.
The LLM is prompted to output only valid JSON in the exact schema.

Debug tip:
  Set LOG_PROMPTS=true in your .env to print the full prompt and raw
  Claude response to stdout on every call.
"""

import json
import logging
import os
import re

import anthropic

from app.core.config import settings
from app.schemas.pain_relief import PainReliefRequest, RetrievalResult, StructuredRelief

logger = logging.getLogger(__name__)

LOG_PROMPTS: bool = os.getenv("LOG_PROMPTS", "false").lower() == "true"

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

MODEL      = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1500  # increased — structured JSON with alternatives needs headroom


# ── System prompt ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a gut pain relief guide for GutIQ.

A user is in acute pain right now. Your job is to return a single JSON object — \
nothing else. No markdown fences, no commentary, no explanation outside the JSON.

The JSON must follow this exact schema:

{
  "primary": {
    "action": "3-6 word action name",
    "instruction": "One or two sentences. Exactly what to do — body position, movement, or technique a person in pain can follow right now. Not a study result. Not a mechanism.",
    "duration_minutes": <integer>
  },
  "maintain": [
    "Short passive phrase — no explanation",
    "Short passive phrase",
    "Short passive phrase"
  ],
  "avoid": [
    "Short phrase",
    "Short phrase"
  ],
  "alternatives": [
    {
      "action": "3-6 word action name",
      "instruction": "One or two sentences.",
      "duration_minutes": <integer>
    },
    {
      "action": "3-6 word action name",
      "instruction": "One or two sentences.",
      "duration_minutes": <integer>
    }
  ],
  "session_duration_minutes": <integer>,
  "when_to_seek_care": "One calm sentence."
}

Rules you must never break:

1. primary — the single most effective immediate intervention from the clinical \
evidence. The thing the user focuses on RIGHT NOW.

2. maintain — 2 to 4 short passive behaviours to keep doing alongside the primary. \
Phrases only. No explanation.

3. avoid — 2 to 4 things not to do. Short phrases.

4. alternatives — exactly 2 backup primary actions. They must be genuinely different \
from the primary — not the same intervention reworded. These are shown only if the \
primary brings no relief after a few minutes.

5. session_duration_minutes — realistic total time for this protocol (10-20 minutes).

6. when_to_seek_care — one calm sentence. When should they stop and see a doctor.

7. Never suggest medication of any kind.

8. Never diagnose.

9. Every action must be doable within 30 seconds using only items in a normal home.

10. If the retrieved clinical context does not contain enough information to give \
safe, specific actions — return exactly: {"error": "insufficient_evidence"}
"""


def _build_user_prompt(request: PainReliefRequest, result: RetrievalResult) -> str:
    regions = ", ".join(
        f"{c.region.value.replace('_', ' ')} ({c.view.value})"
        for c in request.body_clicks
    )
    character = (
        request.pain_character.value if request.pain_character else "not specified"
    )
    condition_label = result.condition.value.replace("_", " ").title()

    chunk_lines: list[str] = []
    for i, chunk in enumerate(result.chunks, start=1):
        source_label = chunk.source.upper()
        if chunk.pmid:
            source_label += f" (PMID {chunk.pmid})"
        if chunk.year:
            source_label += f", {chunk.year}"
        chunk_lines.append(
            f"[{i}] Source: {source_label}\n"
            f"    Title: {chunk.title}\n"
            f"    {chunk.text.strip()}"
        )

    chunks_block = "\n\n".join(chunk_lines) if chunk_lines else "No evidence retrieved."

    return f"""\
A user is experiencing gut pain right now. Here is their situation:

Pain location  : {regions}
Intensity      : {request.intensity}/10
Character      : {character}
Description    : "{request.description}"
Condition      : {condition_label}

---
CLINICAL EVIDENCE (use only what is below):

{chunks_block}

---
Return the JSON object now. Nothing else.\
"""


def _extract_json(text: str) -> dict:
    """
    Parse the JSON from Claude's response.
    Handles cases where Claude wraps it in markdown fences despite instructions.
    """
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences if present
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        return json.loads(fence_match.group(1))

    # Last resort — find the outermost { ... }
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        return json.loads(brace_match.group())

    raise ValueError("Claude response contained no parseable JSON")


# ── Public API ──────────────────────────────────────────────────────────────────

async def generate_relief_steps(
    request: PainReliefRequest,
    result: RetrievalResult,
) -> StructuredRelief:
    """
    Call Claude and return a validated StructuredRelief object.

    Raises:
        anthropic.APIError  — Claude API unreachable or returned an error
        ValueError          — Claude returned empty, non-JSON, or insufficient evidence
    """
    user_prompt = _build_user_prompt(request, result)

    if LOG_PROMPTS:
        logger.info("=== PAIN RELIEF PROMPT ===\n%s", user_prompt)

    logger.info(
        "Generating relief steps | session=%s condition=%s chunks=%d",
        result.session_id,
        result.condition.value,
        len(result.chunks),
    )

    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not message.content:
        raise ValueError("Claude returned an empty response")

    raw = message.content[0].text.strip()

    if LOG_PROMPTS:
        logger.info("=== CLAUDE RESPONSE ===\n%s", raw)

    logger.info(
        "Relief steps generated | session=%s tokens_used=%d",
        result.session_id,
        message.usage.output_tokens,
    )

    data = _extract_json(raw)

    if "error" in data:
        raise ValueError(
            f"Insufficient clinical evidence for this condition: {data['error']}"
        )

    try:
        return StructuredRelief(**data)
    except Exception as exc:
        raise ValueError(f"Claude JSON did not match expected schema: {exc}") from exc
