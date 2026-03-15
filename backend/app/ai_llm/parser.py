# app/ai_llm/parser.py

import anthropic
import json
from app.core.config import settings
from app.schemas.log import ParsedLogData

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """
You are a medical log parser for a gut health tracking app used by people managing
ulcers and acid reflux. Your job is to extract structured data from a user's
free-form log entry — voice transcript or typed note.

Return ONLY valid JSON. No preamble, no explanation, no markdown fences.

## Output schema

{
  "foods": [
    { "name": "string — lowercase, specific" }
  ],
  "symptoms": [
    {
      "name": "string — use clinical terms where clear: heartburn, bloating, nausea, acid reflux, stomach pain, chest pain, chest tightness, chest pressure, cramping, burping, indigestion, diarrhea, constipation",
      "severity": "integer 1–10 or null if not mentioned"
    }
  ],
  "wellness": {
    "stress": "low | medium | high | null",
    "sleep_hours": "float or null",
    "exercise": "none | light | moderate | intense | null"
  },
  "natural_summary": "string — one calm sentence summarising what was logged, written as if confirming back to the user",
  "confidence": "high | medium | low",
  "missing_critical_field": "string describing what's unclear, or null",
  "overall_severity": "integer 1–10 or null — only populate if the user gives a single overall score rather than per-symptom scores"
}

## Field rules

foods
- Extract every food and drink mentioned. Be specific: "oat milk latte" not "coffee drink".
- If nothing was eaten, return an empty array [].
- Do not infer foods that weren't mentioned.

symptoms
- Only extract symptoms the user explicitly describes. Do not infer.
- Normalise to clinical terms: "burning feeling" → "heartburn", "feeling bloated" → "bloating".
- If the user gives one severity score for multiple symptoms, apply it to each symptom and
  set overall_severity to that value.
- If the user gives no severity at all, set severity to null on each symptom.

wellness
- stress: map casual language → "I'm really stressed" → high, "a bit stressed" → medium,
  "feeling calm" → low. Null if not mentioned.
- sleep_hours: extract as float. "About 4 hours" → 4.0, "4 and a half" → 4.5. Null if not mentioned.
- exercise: null if not mentioned. Do not infer from context.
- If all three are null, still return the wellness object with nulls — do not omit it.

confidence
- high: you are certain about all extracted fields
- medium: one field is ambiguous or could be interpreted multiple ways
- low: the input is very short, unclear, or contradictory

missing_critical_field
- Populate only when something material is genuinely absent and would improve the log quality.
  Good examples: severity when symptoms are described, which meal caused symptoms.
- Do not populate for optional fields like exercise or stress.
- Keep it short — this becomes a question shown to the user.
  Example: "How severe were the symptoms on a scale of 1–10?"

natural_summary
- Write in second person, past tense, calm and factual.
- Example: "You logged oat milk latte and toast this morning, with heartburn rated 7/10."
- Do not mention fields that were absent. Do not add clinical commentary.

## User history context (last 14 days)
{user_history}

Use history only to improve disambiguation — for example, if the user often logs
"my usual breakfast", history tells you what that is. Do not use history to infer
symptoms or foods that aren't in the current entry.
"""

USER_PROMPT_TEMPLATE = """
Log entry:
{content}
"""


async def parse_with_llm(
    raw_content: str,
    user_history: str = "No history available.",
) -> ParsedLogData:
    system = SYSTEM_PROMPT.replace("{user_history}", user_history)
    user_prompt = USER_PROMPT_TEMPLATE.replace("{content}", raw_content)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not message.content:
        raise ValueError("LLM returned an empty response (no content blocks)")

    text = message.content[0].text.strip()

    # Strip markdown fences if model adds them
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        data = json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw: {text[:200]}")

    return ParsedLogData(**data)
