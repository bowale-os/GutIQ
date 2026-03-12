# app/api/routes/logs.py

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db import get_session
from app.models import User
from app.models.log import Log
from app.schemas.log import (
    LogPreviewResponse,
    LogCreateRequest,
    LogCreateResponse,
    LogResponse,
    LogListResponse,
)
from app.api.deps import get_current_user
from app.ai_llm.parser import parse_with_llm
from app.ai_llm.transcriber import llm_transcribe

router = APIRouter()


# ── Preview (parse but do NOT save) ───────────────────────────────────────────

@router.post("/preview", response_model=LogPreviewResponse, status_code=200)
async def preview_log(
    source: str = Form(...),
    raw_content: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """Parse with Claude but do NOT save. Returns structured fields for user to review."""

    # ── Text path ──────────────────────────────────────────
    if source == "text":
        if not raw_content:
            raise HTTPException(status_code=400, detail="raw_content required for text logs")
        transcript = None
        content_to_parse = raw_content

    # ── Voice path ─────────────────────────────────────────
    elif source == "voice":
        if not audio_file:
            raise HTTPException(status_code=400, detail="audio_file required for voice logs")
        audio_bytes = await audio_file.read()
        transcript = await llm_transcribe(audio_bytes)
        content_to_parse = transcript

    else:
        raise HTTPException(status_code=400, detail="source must be 'text' or 'voice'")

    # ── Both paths converge here ───────────────────────────
    parsed = await parse_with_llm(content_to_parse)

    return LogPreviewResponse(
        transcript=transcript,
        log_categories=parsed.log_categories,
        parsed_foods=parsed.parsed_foods,
        parsed_symptoms=parsed.parsed_symptoms,
        parsed_severity=parsed.parsed_severity,
        parsed_stress=parsed.parsed_stress,
        parsed_sleep=parsed.parsed_sleep,
        parsed_exercise=parsed.parsed_exercise,
        confidence=parsed.confidence,
        natural_summary=parsed.natural_summary,
        missing_critical_field=parsed.missing_critical_field,
    )


# ── Save confirmed log ─────────────────────────────────────────────────────────

@router.post("/create-log", response_model=LogCreateResponse, status_code=201)
async def create_log(
    body: LogCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Save a log after the user reviews and confirms the preview."""
    if not body.raw_content:
        raise HTTPException(status_code=400, detail="raw_content is required")

    log = Log(
        user_id=current_user.id,
        source=body.source,
        raw_content=body.raw_content,
        parsed_foods=json.dumps(body.parsed_foods) if body.parsed_foods else None,
        parsed_symptoms=json.dumps(body.parsed_symptoms) if body.parsed_symptoms else None,
        parsed_severity=body.parsed_severity,
        parsed_stress=body.parsed_stress,
        parsed_sleep=body.parsed_sleep,
        parsed_exercise=body.parsed_exercise
    )
    session.add(log)
    await session.commit()
    await session.refresh(log)

    return LogCreateResponse(log=LogResponse.from_orm(log))


# ── List logs ──────────────────────────────────────────────────────────────────

@router.get("/list-logs", response_model=LogListResponse, status_code=200)
async def list_logs(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return all logs for the current user, newest first."""
    result = await session.execute(
        select(Log)
        .where(Log.user_id == current_user.id)
        .order_by(Log.logged_at.desc())
    )
    logs = result.scalars().all()

    return LogListResponse(
        logs=[LogResponse.from_orm(log) for log in logs],
        total=len(logs),
    )


# ── Get single log ─────────────────────────────────────────────────────────────

@router.get("/logs/{log_id}", response_model=LogResponse, status_code=200)
async def get_log(
    log_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return a single log by ID (must belong to the current user)."""
    result = await session.execute(
        select(Log).where(Log.id == log_id, Log.user_id == current_user.id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    return LogResponse.from_orm(log)
