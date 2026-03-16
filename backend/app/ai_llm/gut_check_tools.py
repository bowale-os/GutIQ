# app/ai_llm/gut_check_tools.py
"""
Tool implementations for the GutCheck agent.

Two tools:
  query_logs      — searches the user's full log history beyond 30 days
  fetch_research  — semantic search over the Qdrant clinical knowledge base

Each tool has:
  - A TOOL_DEFINITION dict  (what Claude sees — the JSON schema)
  - An execute_*() function (what runs when Claude calls it)

Synonym matching note:
  Text matching expands search terms to common synonyms (e.g. "coffee" →
  espresso, latte, etc.) before filtering. This is a simple dictionary approach
  that covers the 80% case. TODO: replace with DB full-text search or embeddings
  when the synonym list grows unwieldy.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.log import FoodEntry, Log, SymptomEntry
from app.ai_llm.gut_check_prompt import format_log

logger = logging.getLogger(__name__)


# ── Synonym dictionaries ───────────────────────────────────────────────────────
# TODO: replace with a proper search strategy (LIKE queries or embeddings)
#       once this dictionary grows beyond ~20 keys.

FOOD_SYNONYMS: dict[str, list[str]] = {
    "coffee":   ["coffee", "espresso", "latte", "cappuccino", "flat white",
                 "cold brew", "americano", "macchiato", "mocha"],
    "alcohol":  ["wine", "beer", "spirits", "gin", "vodka", "whiskey",
                 "prosecco", "champagne", "cider", "alcohol"],
    "spicy":    ["spicy", "chilli", "chili", "hot sauce", "curry",
                 "sriracha", "jalapeño", "pepper"],
    "dairy":    ["milk", "cheese", "yogurt", "cream", "butter", "ice cream",
                 "dairy", "lactose"],
    "gluten":   ["bread", "pasta", "wheat", "flour", "cereal",
                 "crackers", "toast", "gluten"],
    "tea":      ["tea", "herbal tea", "green tea", "chamomile", "peppermint tea"],
    "chocolate":["chocolate", "cocoa", "hot chocolate"],
    "citrus":   ["orange", "lemon", "lime", "grapefruit", "citrus", "juice"],
}

SYMPTOM_SYNONYMS: dict[str, list[str]] = {
    "heartburn":    ["heartburn", "reflux", "burning", "acid",
                     "indigestion", "regurgitation"],
    "bloating":     ["bloating", "bloated", "distension", "gassy",
                     "wind", "full", "distended"],
    "nausea":       ["nausea", "nauseous", "sick", "queasy", "vomiting"],
    "cramping":     ["cramping", "cramps", "spasm", "spasms", "colic"],
    "constipation": ["constipation", "constipated", "no bowel movement",
                     "hard stool", "can't go"],
    "diarrhea":     ["diarrhea", "diarrhoea", "loose stools", "runny"],
    "chest pain":   ["chest pain", "chest tightness", "chest pressure"],
}


def _expand_term(term: Optional[str], synonym_map: dict[str, list[str]]) -> list[str]:
    """Return all synonyms for a term, or the term itself if no match found."""
    if not term:
        return []
    term_lower = term.lower().strip()
    for key, synonyms in synonym_map.items():
        if term_lower == key or term_lower in synonyms:
            return synonyms
    return [term_lower]


# ── Tool 1: query_logs ─────────────────────────────────────────────────────────

QUERY_LOGS_DEFINITION = {
    "name": "query_logs",
    "description": (
        "Search the user's COMPLETE log history, including entries older than 30 days. "
        "Use this ONLY for questions like 'every time X happened', 'has X ever triggered', "
        "'how many times', or when the user specifies a date range outside the last 30 days. "
        "For recent questions the logs are already in your context — do NOT call this tool."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "food_contains": {
                "type": "string",
                "description": "Filter logs where this food was consumed. e.g. 'coffee'",
            },
            "symptom_contains": {
                "type": "string",
                "description": "Filter logs containing this symptom. e.g. 'heartburn'",
            },
            "min_severity": {
                "type": "integer",
                "description": "Only return logs at or above this severity (1–10).",
            },
            "days_back": {
                "type": "integer",
                "description": "How far back to search in days. Default 365. Max 1825 (5 years).",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of matching logs to return. Default 20.",
            },
        },
    },
}


async def execute_query_logs(
    inputs: dict,
    user_id,
    db_session: AsyncSession,
) -> dict:
    """
    Run a DB query filtered by the parameters Claude provided,
    then apply synonym-expanded text matching in Python.

    Returns a dict with total_found and the matching entries.
    """
    days_back = min(int(inputs.get("days_back", 365)), 1825)
    limit     = min(int(inputs.get("limit", 20)), 50)
    cutoff    = datetime.utcnow() - timedelta(days=days_back)

    # Build base query
    stmt = (
        select(Log)
        .where(Log.user_id == user_id, Log.logged_at >= cutoff)
        .options(
            selectinload(Log.food_entries),
            selectinload(Log.symptom_entries),
            selectinload(Log.wellness_entry),
        )
        .order_by(Log.logged_at.desc())
    )

    # Apply severity filter at DB level (efficient)
    min_severity = inputs.get("min_severity")
    if min_severity is not None:
        stmt = stmt.join(SymptomEntry, SymptomEntry.log_id == Log.id).where(
            SymptomEntry.severity >= int(min_severity)
        )

    result = await db_session.execute(stmt)
    logs = list(result.scalars().unique().all())

    # Apply synonym-expanded text filters in Python
    food_terms    = _expand_term(inputs.get("food_contains"),    FOOD_SYNONYMS)
    symptom_terms = _expand_term(inputs.get("symptom_contains"), SYMPTOM_SYNONYMS)

    if food_terms:
        logs = [
            l for l in logs
            if any(
                term in f.name.lower()
                for f in l.food_entries
                for term in food_terms
            )
        ]

    if symptom_terms:
        logs = [
            l for l in logs
            if any(
                term in s.name.lower()
                for s in l.symptom_entries
                for term in symptom_terms
            )
        ]

    matched = logs[:limit]

    logger.info(
        "query_logs | user=%s days_back=%d food=%s symptom=%s found=%d",
        user_id, days_back,
        inputs.get("food_contains"), inputs.get("symptom_contains"),
        len(matched),
    )

    return {
        "total_found": len(matched),
        "search_window_days": days_back,
        "entries": [format_log(l) for l in matched],
    }


# ── Tool 2: fetch_research ─────────────────────────────────────────────────────

FETCH_RESEARCH_DEFINITION = {
    "name": "fetch_research",
    "description": (
        "Search clinical research documents for gut health evidence. "
        "Call this when the user asks why something happens ('why does coffee make it worse?'), "
        "asks for the science behind a pattern, or when clinical evidence would strengthen "
        "an observation you've already made from their data. "
        "Do not call this for data questions — use query_logs or your context instead."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Clinical search query. Be specific — include the mechanism or condition. "
                    "e.g. 'coffee lower oesophageal sphincter GERD acid reflux'"
                ),
            },
        },
        "required": ["query"],
    },
}


async def execute_fetch_research(inputs: dict) -> dict:
    """
    Semantic similarity search over the Qdrant gut health knowledge base.
    Reuses the existing vector store singleton from the pain relief pipeline.
    Runs in a thread pool because the Qdrant client is synchronous.
    """
    from app.rag.retriever import _get_vector_store  # import here to avoid circular

    query = inputs["query"]

    def _search() -> list[dict]:
        store = _get_vector_store()
        docs = store.similarity_search(query, k=4)
        results = []
        for doc in docs:
            meta = doc.metadata or {}
            results.append({
                "text":   doc.page_content.strip(),
                "source": meta.get("source", "unknown"),
                "title":  meta.get("title", ""),
                "year":   meta.get("year"),
                "pmid":   meta.get("pmid"),
            })
        return results

    chunks = await asyncio.to_thread(_search)

    logger.info("fetch_research | query=%r chunks_returned=%d", query, len(chunks))

    return {"query": query, "sources": chunks}


# ── Tool registry ──────────────────────────────────────────────────────────────
# Add new tools here — the agent loop reads TOOL_DEFINITIONS automatically.

TOOL_DEFINITIONS = [
    QUERY_LOGS_DEFINITION,
    FETCH_RESEARCH_DEFINITION,
]
