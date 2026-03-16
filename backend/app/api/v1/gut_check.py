# app/api/v1/gut_check.py
"""
GutCheck API endpoints.

POST /gutcheck/ask
  Main endpoint. Streams SSE events as Tiwa analyses the user's question.
  Accepts an optional session_id — omit it on the first message of a
  conversation and the server creates one, returning it as the first event.

POST /gutcheck/profile/regenerate
  Force-rebuilds the user's health profile from all their logs.
  Useful for testing. In production this runs automatically via background task.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_session
from app.models.user import User
from app.ai_llm.gut_check_gen import run_gutcheck
from app.ai_llm.gut_check_profile import regenerate_profile

router = APIRouter()


# ── Request schema ─────────────────────────────────────────────────────────────

class GutCheckRequest(BaseModel):
    question: str
    session_id: Optional[uuid.UUID] = None   # None = start a new session


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/ask")
async def ask(
    body: GutCheckRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Stream Tiwa's response to the user's question as SSE.

    The frontend should:
      1. Open the stream.
      2. Read the first event (session_id) and store the UUID.
      3. Render tool_start/tool_done events as spinner states.
      4. Append answer_chunk events to build the streamed answer.
      5. Close on the "done" event.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    return StreamingResponse(
        run_gutcheck(
            question=body.question.strip(),
            session_id=body.session_id,
            user=current_user,
            db_session=session,
        ),
        media_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",        # disable nginx buffering
            "Cache-Control":     "no-cache",
            "Connection":        "keep-alive",
        },
    )


@router.post("/profile/regenerate", status_code=202)
async def force_regenerate_profile(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Manually trigger a full profile rebuild for the current user.
    Returns 202 immediately — regeneration runs in the background.
    Useful for development and testing.
    """
    background_tasks.add_task(regenerate_profile, current_user.id, session)
    return {"status": "profile regeneration queued"}
