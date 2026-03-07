from fastapi import APIRouter, Depends, HTTPException


from app.models import User
from app.schemas import LogPreviewRequest, LogPreviewResponse
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
    if data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot preview logs for another user")

    if data.source == "text":
        if not data.raw_content or not data.raw_content.strip():
            raise HTTPException(
                status_code=400, 
                detail="raw_content required for text logs"
            )

    elif data.source == "voice":
        if data.audio_data is None:
            raise HTTPException(
                status_code=400, 
                detail="audio_data required for voice logs"
            )
        if not isinstance(data.audio_data, (bytes, bytearray)) or len(data.audio_data) == 0:
            raise HTTPException(
                status_code=400,
                detail="audio_data must contain non-empty bytes",
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported source type")

    return LogPreviewResponse(
        parsed_foods=[],
        parsed_symptoms=[],
        parsed_severity=None,
        parsed_stress=None,
        parsed_sleep=None,
        parsed_exercise=None,
        confidence=0.0,
    )
