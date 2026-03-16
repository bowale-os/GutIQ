# app/api/v1/export.py
"""
Export share endpoints.

POST /export/share
    Authenticated. Accepts the full report JSON from the frontend,
    mints a UUID token, stores the snapshot, returns the share URL.

GET  /export/report/{token}
    Public (no auth). Returns the stored report JSON so the doctor's
    browser can render it. Returns 404 if token is missing or expired.
"""

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db import get_session
from app.models import User
from app.models.export_share import ExportShare
from app.api.deps import get_current_user
from app.core.utils import utcnow

router = APIRouter()


# ── Request / response schemas ────────────────────────────────────────────────

class ShareRequest(BaseModel):
    report: dict  # the full report payload from the frontend


class ShareResponse(BaseModel):
    token: str
    url:   str
    expires_in_days: int = 7


# ── POST /export/share ────────────────────────────────────────────────────────

@router.post("/share", response_model=ShareResponse)
async def create_share(
    body:    ShareRequest,
    user:    User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    token = secrets.token_urlsafe(16)

    share = ExportShare(
        token=token,
        user_id=user.id,
        report_json=json.dumps(body.report),
    )
    session.add(share)
    await session.commit()

    base_url = getattr(settings, "frontend_url", "http://localhost:5173")
    url = f"{base_url}/report/{token}"

    return ShareResponse(token=token, url=url)


# ── GET /export/report/{token} ────────────────────────────────────────────────

@router.get("/report/{token}")
async def get_shared_report(
    token:   str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ExportShare).where(ExportShare.token == token)
    )
    share: ExportShare | None = result.scalars().first()

    if share is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    if share.expires_at < utcnow():
        raise HTTPException(status_code=410, detail="This report link has expired.")

    return json.loads(share.report_json)
