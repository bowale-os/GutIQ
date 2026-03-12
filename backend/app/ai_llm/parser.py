# app/ai-llm/parser.py

import anthropic
import json
from app.core.config import settings
from app.schemas.log import LogPreviewResponse

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

async def parse_with_llm(raw_content: str) -> LogPreviewResponse:

    prompt = f"""
You are a gut health log parser for GERD/IBS/peptic ulcer patients.
Log: "{raw_content}"

Return ONLY valid JSON, no preamble, no markdown:
{{
  "log_categories": [],
  "parsed_foods": [],
  "parsed_symptoms": [],
  "parsed_severity": null,
  "parsed_stress": null,
  "parsed_sleep": null,
  "parsed_exercise": null,
  "confidence": "high",
  "natural_summary": "",
  "missing_critical_field": null
}}

Rules:
- log_categories: list of "food"|"symptom"|"sleep"|"stress"|"exercise"|"medication"|"general"
- parsed_severity: integer 1-10 or null
- parsed_stress: "low"|"medium"|"high" or null
- parsed_sleep: float hours or null
- parsed_exercise: "none"|"light"|"moderate"|"intense" or null
- confidence: "high"|"medium"|"low"
- missing_critical_field: most important missing field or null
  priority: severity > sleep > foods > stress > exercise > null
- natural_summary: short human-readable summary e.g. "Coffee → chest discomfort"
"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )

    if not message.content:
        raise ValueError("LLM returned an empty response (no content blocks)")
    text = message.content[0].text
    
    # Strip markdown fences if model adds them
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    try:
        data = json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw: {text[:200]}")
    return LogPreviewResponse(**data)