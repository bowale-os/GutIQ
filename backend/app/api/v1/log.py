from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta, datetime
from uuid import UUID


from app.db import get_session
from app.models import User
from app.schemas import LogPreviewRequest
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/logs/preview", status_code=200)
async def preview_log(
    data: LogPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Parse raw_content with Nova but do NOT save.
    Returns structured fields for user review.
    """
    content_to_parse = None
    
    if data.source == "text":
        if not data.raw_content:
            raise HTTPException(
                status_code=400, 
                detail="raw_content required for text logs"
            )
        transcript = None
        content_to_parse = data.raw_content

    elif data.source == "voice":
        if not data.audio_file:
            raise HTTPException(
                status_code=400, 
                detail="audio_file required for voice logs"
            )
        audio_bytes = await data.audio_data.read()
        transcript = await nova_sonic_transcribe(audio_bytes)
        content_to_parse = transcript

    return LogPreviewResponse(
        parsed_foods=parsed.foods,
        parsed_symptoms=parsed.symptoms,
        parsed_severity=parsed.severity,
        parsed_stress=parsed.stress,
        parsed_sleep=parsed.sleep,
        parsed_exercise=parsed.exercise,
        confidence=parsed.confidence
    )