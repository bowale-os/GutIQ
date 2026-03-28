# app/api/routes/log.py

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.db import get_session
from app.models import User
from app.models.log import Log, FoodEntry, SymptomEntry, WellnessEntry
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
from app.ai_llm.gut_check_profile import regenerate_profile, should_regenerate

router = APIRouter()

_LOG_RELATIONS = [
    selectinload(Log.food_entries),
    selectinload(Log.symptom_entries),
    selectinload(Log.wellness_entry),
]


def _log_categories(parsed) -> list[str]:
    cats = []
    if parsed.foods:
        cats.append("food")
    if parsed.symptoms:
        cats.append("symptom")
    w = parsed.wellness
    if w.stress:
        cats.append("stress")
    if w.sleep_hours is not None:
        cats.append("sleep")
    if w.exercise and w.exercise != "none":
        cats.append("exercise")
    return cats


# ── Preview (parse but do NOT save) ───────────────────────────────────────────

@router.post("/preview", response_model=LogPreviewResponse, status_code=200)
async def preview_log(
    source: str = Form(...),
    raw_content: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """Parse with Claude but do NOT save. Returns structured fields for user to review."""
    if source == "text":
        if not raw_content:
            raise HTTPException(status_code=400, detail="raw_content required for text logs")
        transcript = None
        content_to_parse = raw_content

    elif source == "voice":
        if not audio_file:
            raise HTTPException(status_code=400, detail="audio_file required for voice logs")
        audio_bytes = await audio_file.read()
        transcript = await llm_transcribe(audio_bytes)
        content_to_parse = transcript

    else:
        raise HTTPException(status_code=400, detail="source must be 'text' or 'voice'")

    parsed = await parse_with_llm(content_to_parse)

    return LogPreviewResponse(
        transcript=transcript,
        log_categories=_log_categories(parsed),
        parsed_foods=[f.name for f in parsed.foods],
        parsed_symptoms=parsed.symptoms,
        parsed_stress=parsed.wellness.stress,
        parsed_sleep=parsed.wellness.sleep_hours,
        parsed_exercise=parsed.wellness.exercise,
        confidence=parsed.confidence,
        natural_summary=parsed.natural_summary,
        missing_critical_field=parsed.missing_critical_field,
    )


# ── Save confirmed log ─────────────────────────────────────────────────────────

@router.post("/create-log", response_model=LogCreateResponse, status_code=201)
async def create_log(
    body: LogCreateRequest,
    background_tasks: BackgroundTasks,
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
        transcript=body.transcript,
        natural_summary=body.natural_summary,
        confidence=body.confidence,
    )
    session.add(log)
    await session.flush()  # get log.id before inserting children

    ts = log.logged_at

    food_objs = [
        FoodEntry(log_id=log.id, user_id=current_user.id, logged_at=ts, name=name)
        for name in (body.parsed_foods or [])
    ]
    symptom_objs = [
        SymptomEntry(
            log_id=log.id, user_id=current_user.id, logged_at=ts,
            name=item.name,
            severity=item.severity,
        )
        for item in (body.parsed_symptoms or [])
    ]
    session.add_all(food_objs)
    session.add_all(symptom_objs)

    if any((body.parsed_stress is not None, body.parsed_sleep is not None, body.parsed_exercise is not None)):
        session.add(WellnessEntry(
            log_id=log.id, user_id=current_user.id,
            logged_at=ts,
            stress=body.parsed_stress,
            sleep_hours=body.parsed_sleep,
            exercise=body.parsed_exercise,
        ))

    await session.commit()
    await session.refresh(log, attribute_names=['food_entries', 'symptom_entries', 'wellness_entry'])

    # Increment profile counter — trigger background rebuild every 5 logs
    current_user.logs_since_last_profile_change += 1
    if should_regenerate(current_user):
        background_tasks.add_task(regenerate_profile, current_user.id, session)
    await session.commit()

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
        .options(*_LOG_RELATIONS)
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
        select(Log)
        .where(Log.id == log_id, Log.user_id == current_user.id)
        .options(*_LOG_RELATIONS)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    return LogResponse.from_orm(log)
