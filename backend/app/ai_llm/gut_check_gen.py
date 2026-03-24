# app/ai_llm/gut_check_gen.py
"""
GutCheck agent loop — the core of the feature.

How it works:
  1. Load user, recent logs (last 30 days), conversation history.
  2. Build system prompt (long-term profile + raw logs injected once).
  3. Stream Claude response as SSE events to the frontend.
  4. If Claude calls a tool, execute it, send tool_start/tool_done events,
     then continue the loop with the tool result appended to messages.
  5. On end_turn, save both turns to DB and yield a final "done" event.

SSE event format (all events):
  data: {"type": "<event_type>", ...fields}\n\n

Event types:
  session_id    — sent first, carries the session UUID the frontend should store
  tool_start    — Claude is calling a tool (show spinner in UI)
  tool_done     — tool finished (mark spinner done)
  answer_chunk  — a piece of Claude's streamed text answer
  done          — stream complete

Debug tip:
  Set LOG_PROMPTS=true in .env to print the full system prompt and each
  Claude response to stdout.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.core.config import settings
from app.core.utils import utcnow
from app.db import AsyncSessionLocal
from app.models.confirmed_trigger import ConfirmedTrigger
from app.models.gut_check import GutCheckMessage, GutCheckSession
from app.models.log import Log
from app.models.user import User
from app.ai_llm.gut_check_prompt import build_system_prompt, format_log
from app.ai_llm.gut_check_tools import (
    TOOL_DEFINITIONS,
    execute_fetch_research,
    execute_query_logs,
)

logger      = logging.getLogger(__name__)
LOG_PROMPTS = os.getenv("LOG_PROMPTS", "false").lower() == "true"

_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL       = "claude-haiku-4-5-20251001"
MAX_TOKENS  = 1024
RECENT_DAYS = 30
MAX_HISTORY_PAIRS = 10   # keep last 10 Q+A pairs to avoid context overflow


# ── SSE helpers ────────────────────────────────────────────────────────────────

def _sse(event_type: str, **fields) -> str:
    """Format a single SSE data line."""
    return f"data: {json.dumps({'type': event_type, **fields})}\n\n"


# ── Main entry point ───────────────────────────────────────────────────────────

async def run_gutcheck(
    question: str,
    session_id: Optional[uuid.UUID],
    user: User,
    db_session: AsyncSession,
) -> AsyncGenerator[str, None]:
    """
    Full agent loop. Yields SSE strings.

    Args:
        question:   The user's current question.
        session_id: Existing session UUID, or None to start a new session.
        user:       The authenticated User ORM object.
        db_session: Async DB session (from FastAPI dependency).
    """

    # ── 1. Resolve or create session ──────────────────────────────────────────
    if session_id is None:
        session_id = await _create_session(user.id, db_session)
    else:
        # Verify the session exists AND belongs to this user before trusting it.
        # A caller replaying another user's UUID must not be able to read or
        # append to that conversation.
        result = await db_session.execute(
            select(GutCheckSession).where(
                GutCheckSession.id == session_id,
                GutCheckSession.user_id == user.id,
            )
        )
        if result.scalar_one_or_none() is None:
            # Unknown or foreign session — start a fresh one rather than erroring,
            # so the frontend recovers gracefully without a visible crash.
            logger.warning(
                "session_id %s not found for user %s — creating new session",
                session_id, user.id,
            )
            session_id = await _create_session(user.id, db_session)

    yield _sse("session_id", id=str(session_id))

    # ── 2. Load data ───────────────────────────────────────────────────────────
    recent_logs, confirmed = await asyncio.gather(
        _fetch_recent_logs(user.id, db_session, days=RECENT_DAYS),
        _fetch_confirmed_triggers(user.id, db_session),
    )
    history = await _load_history(session_id, db_session)
    system  = build_system_prompt(user, recent_logs, user.health_profile_summary, confirmed)

    if LOG_PROMPTS:
        logger.info("=== GUTCHECK SYSTEM PROMPT ===\n%s", system)

    # ── 3. Build message list: history + new question ─────────────────────────
    messages = _trim_history(history) + [{"role": "user", "content": question}]

    # ── 4. Agent loop ──────────────────────────────────────────────────────────
    full_answer: list[str] = []
    tools_used:  list[str] = []

    while True:
        text_chunks:   list[str] = []
        pending_tools: list      = []   # tool_use content blocks from this turn

        async with _client.messages.stream(
            model=MODEL,
            system=system,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            max_tokens=MAX_TOKENS,
            temperature=0.6,
        ) as stream:

            async for event in stream:

                # Tool call starting — notify frontend immediately
                if (
                    event.type == "content_block_start"
                    and event.content_block.type == "tool_use"
                ):
                    tool_name = event.content_block.name
                    tools_used.append(tool_name)
                    yield _sse("tool_start", tool=tool_name)

                # Text streaming — forward each chunk to frontend
                elif (
                    event.type == "content_block_delta"
                    and event.delta.type == "text_delta"
                ):
                    chunk = event.delta.text
                    text_chunks.append(chunk)
                    full_answer.append(chunk)
                    yield _sse("answer_chunk", text=chunk)

            final = await stream.get_final_message()

        if LOG_PROMPTS:
            logger.info(
                "=== CLAUDE RESPONSE === stop_reason=%s\n%s",
                final.stop_reason,
                "".join(text_chunks),
            )

        # ── end_turn: Claude is done ───────────────────────────────────────────
        if final.stop_reason == "end_turn":
            break

        # ── tool_use: execute tools, then loop ─────────────────────────────────
        if final.stop_reason == "tool_use":
            tool_blocks = [b for b in final.content if b.type == "tool_use"]

            # Run all tool calls in parallel.
            # Each call gets its own session — sharing one AsyncSession across
            # concurrent tasks violates SQLAlchemy's concurrency model.
            tool_results = await asyncio.gather(*[
                _execute_tool(block.name, block.input, user.id)
                for block in tool_blocks
            ])

            # Notify frontend that each tool is done
            for block in tool_blocks:
                yield _sse("tool_done", tool=block.name)

            # Append assistant turn + tool results, then loop
            messages.append({"role": "assistant", "content": final.content})
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type":        "tool_result",
                        "tool_use_id": block.id,
                        "content":     json.dumps(result),
                    }
                    for block, result in zip(tool_blocks, tool_results)
                ],
            })

    # ── 5. Extract safety tag, strip it, persist, emit events ─────────────────
    answer_text = "".join(full_answer)

    # Claude appends [SAFETY:level] on the last line per system prompt instructions.
    # Parse it, strip it from the stored message, and send as a dedicated SSE event.
    safety_level = "none"
    import re as _re
    tag_match = _re.search(r'\[SAFETY:(none|see_doctor|emergency)\]\s*$', answer_text.strip())
    if tag_match:
        safety_level = tag_match.group(1)
        answer_text  = answer_text[:tag_match.start()].rstrip()

    await _save_exchange(session_id, user.id, question, answer_text, tools_used, db_session)

    yield _sse("safety", level=safety_level)
    yield _sse("done")


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _create_session(user_id, db_session: AsyncSession) -> uuid.UUID:
    session = GutCheckSession(user_id=user_id)
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session.id


async def _fetch_recent_logs(user_id, db_session: AsyncSession, days: int) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db_session.execute(
        select(Log)
        .where(Log.user_id == user_id, Log.logged_at >= cutoff)
        .options(
            selectinload(Log.food_entries),
            selectinload(Log.symptom_entries),
            selectinload(Log.wellness_entry),
        )
        .order_by(Log.logged_at.asc())
    )
    return [format_log(l) for l in result.scalars().all()]


async def _fetch_confirmed_triggers(user_id, db_session: AsyncSession) -> list[dict]:
    result = await db_session.execute(
        select(ConfirmedTrigger)
        .where(ConfirmedTrigger.user_id == user_id)
        .order_by(ConfirmedTrigger.confirmed_at.desc())
    )
    return [
        {
            "variable_type":    ct.variable_type,
            "variable_value":   ct.variable_value,
            "direction":        ct.direction,
            "avg_pain_with":    ct.avg_pain_with,
            "avg_pain_without": ct.avg_pain_without,
            "sample_size":      ct.sample_size,
        }
        for ct in result.scalars().all()
    ]


async def _load_history(session_id: uuid.UUID, db_session: AsyncSession) -> list[dict]:
    """Load prior messages for this session, ordered oldest first."""
    result = await db_session.execute(
        select(GutCheckMessage)
        .where(GutCheckMessage.session_id == session_id)
        .order_by(GutCheckMessage.created_at.asc())
    )
    return [
        {"role": m.role, "content": m.content}
        for m in result.scalars().all()
    ]


def _trim_history(history: list[dict], max_pairs: int = MAX_HISTORY_PAIRS) -> list[dict]:
    """
    Keep only the most recent N question/answer pairs.
    Prevents the context window filling up in long sessions.
    Always trims in pairs (user + assistant) to avoid orphaned roles.
    """
    if len(history) <= max_pairs * 2:
        return history
    return history[-(max_pairs * 2):]


async def _save_exchange(
    session_id: uuid.UUID,
    user_id,
    question: str,
    answer: str,
    tools_used: Optional[list[str]],
    db_session: AsyncSession,
) -> None:
    """Stage both turns and commit once — keeps history in matched pairs."""
    db_session.add(GutCheckMessage(
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=question,
        tools_used=None,
    ))
    db_session.add(GutCheckMessage(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=answer,
        tools_used=json.dumps(tools_used) if tools_used else None,
    ))
    await db_session.commit()


# ── Tool dispatcher ────────────────────────────────────────────────────────────

async def _execute_tool(name: str, inputs: dict, user_id) -> dict:
    """
    Route a tool call to the correct implementation.

    DB-backed tools (query_logs) open their own AsyncSession so that
    multiple tool calls gathered in parallel never share a session —
    SQLAlchemy's AsyncSession is not safe for concurrent use.
    """
    logger.info("Executing tool: %s | inputs=%s", name, inputs)

    if name == "query_logs":
        async with AsyncSessionLocal() as tool_session:
            return await execute_query_logs(inputs, user_id, tool_session)

    if name == "fetch_research":
        return await execute_fetch_research(inputs)

    logger.warning("Unknown tool requested: %s", name)
    return {"error": f"Unknown tool: {name}"}
