# app/api/v1/pain_relief.py
"""
Pain Relief API — two endpoints:

  POST /pain-relief/session   intake → retrieve → generate → save to DB
  POST /pain-relief/feedback  user rates how well the steps worked

Debug tips:
  • Set LOG_PROMPTS=true in .env to print the full Claude prompt + response
  • Every step logs at INFO with session_id — grep logs by session ID to
    trace a full request end-to-end
  • HTTP error `detail` field tells you exactly which step failed
  • 503 on /session → Qdrant unreachable or collection empty (run ingest)
  • 404 on /feedback → session_id not found or belongs to another user
  • 409 on /feedback → feedback already submitted for that session
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.deps import get_current_user
from app.db import get_session
from app.models import User
from app.models.pain_relief import PainReliefChunk, PainReliefFeedback, PainReliefSession
from app.schemas.pain_relief import (
    GutCondition,
    PainReliefRequest,
    PainReliefResponse,
    RetrievalResult,
    StructuredRelief,
)
from app.rag.retriever import retrieve
from app.ai_llm.pain_relief_gen import generate_relief_steps

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _save_session(
    db: AsyncSession,
    user_id,
    request: PainReliefRequest,
    result: RetrievalResult,
    reply: StructuredRelief | str,
) -> None:
    """
    Persist the session envelope and one PainReliefChunk row per
    retrieved document. Called only after generation succeeds so
    we never store incomplete records.
    """
    import json as _json
    reply_str = reply if isinstance(reply, str) else _json.dumps(reply.model_dump())

    session_row = PainReliefSession(
        user_id=user_id,
        session_id=result.session_id,
        body_clicks=[c.model_dump() for c in request.body_clicks],
        description=request.description,
        intensity=request.intensity,
        pain_character=request.pain_character.value if request.pain_character else None,
        identified_condition=result.condition.value,
        is_red_flag=result.is_red_flag,
        red_flag_reason=result.red_flag_reason,
        steps_recommended=reply_str,
    )
    db.add(session_row)
    await db.flush()  # populate session_row.id before inserting chunks

    db.add_all([
        PainReliefChunk(
            session_id=session_row.id,
            user_id=user_id,
            chunk_text=chunk.text,
            source=chunk.source,
            title=chunk.title,
            pmid=chunk.pmid,
            year=chunk.year,
            condition=chunk.condition,
            relevance_score=chunk.relevance_score,
        )
        for chunk in result.chunks
    ])

    await db.commit()
    logger.info(
        "Session persisted | session=%s chunks=%d",
        result.session_id,
        len(result.chunks),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/session",
    response_model=PainReliefResponse,
    status_code=200,
    summary="Submit pain description — returns ordered relief steps",
)
async def pain_relief_session(
    body: PainReliefRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PainReliefResponse:
    """
    Full pipeline:
      1. Validate request        (Pydantic — automatic)
      2. Run retriever           (red flag check → condition → Qdrant search)
      3. Red flag?               → return escalation immediately, no Claude call
      4. Generate relief steps   (Claude, grounded in retrieved chunks only)
      5. Save session + chunks   (PostgreSQL)
      6. Return to frontend
    """
    logger.info(
        "Session start | user=%s regions=%s intensity=%d",
        current_user.id,
        [f"{c.region.value}/{c.view.value}" for c in body.body_clicks],
        body.intensity,
    )

    # ── 1. Retrieve — sync Qdrant call, run in thread pool ────────────────────
    try:
        result: RetrievalResult = await asyncio.to_thread(retrieve, body)
    except Exception as exc:
        logger.exception("Retriever error | user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Knowledge base unavailable. "
                "Ensure the Qdrant collection is populated by running: "
                "python -m app.rag.ingest"
            ),
        ) from exc

    # ── 2. Red flag — skip Claude, return escalation immediately ─────────────
    if result.is_red_flag:
        logger.warning(
            "Red flag | session=%s reason=%s",
            result.session_id,
            result.red_flag_reason,
        )
        await _save_session(db, current_user.id, body, result, reply="")
        return PainReliefResponse(
            session_id=result.session_id,
            is_red_flag=True,
            red_flag_reason=result.red_flag_reason,
            condition=result.condition,
            structured=None,
            reply=result.red_flag_reason or "Please seek medical attention immediately.",
        )

    # ── 3. Generate — Claude grounded strictly in retrieved chunks ────────────
    try:
        reply = await generate_relief_steps(request=body, result=result)
    except Exception as exc:
        logger.exception("Generation error | session=%s", result.session_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Relief step generation failed. Please try again.",
        ) from exc

    # ── 4. Persist — DB failure must not block the user seeing their steps ────
    try:
        await _save_session(db, current_user.id, body, result, reply)
    except Exception:
        logger.exception("DB save failed (non-fatal) | session=%s", result.session_id)

    return PainReliefResponse(
        session_id=result.session_id,
        is_red_flag=False,
        condition=result.condition,
        structured=reply,   # reply is now StructuredRelief
        reply="",
    )


@router.post(
    "/feedback",
    status_code=204,
    summary="Submit outcome feedback for a completed session",
)
async def pain_relief_feedback(
    session_id: str,
    relief_rating: int,
    steps_completed: int,
    notes: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> None:
    """
    Record how well the relief steps worked.

    relief_rating   : 1 (not at all) – 5 (completely relieved)
    steps_completed : number of recommended steps the user actually did
    notes           : optional free-text from the user

    404 — session not found or belongs to another user
    409 — feedback already submitted for this session
    """
    if not 1 <= relief_rating <= 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="relief_rating must be between 1 and 5.",
        )

    result = await db.execute(
        select(PainReliefSession).where(
            PainReliefSession.session_id == session_id,
            PainReliefSession.user_id == current_user.id,
        )
    )
    session_row = result.scalar_one_or_none()
    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found for this user.",
        )

    existing = await db.execute(
        select(PainReliefFeedback).where(
            PainReliefFeedback.session_id == session_row.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Feedback already submitted for this session.",
        )

    db.add(PainReliefFeedback(
        session_id=session_row.id,
        user_id=current_user.id,
        relief_rating=relief_rating,
        steps_completed=steps_completed,
        notes=notes,
    ))
    await db.commit()

    logger.info(
        "Feedback saved | session=%s rating=%d steps_completed=%d",
        session_id, relief_rating, steps_completed,
    )
