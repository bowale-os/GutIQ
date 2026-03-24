import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta, datetime
from uuid import UUID

from app.db import get_session
from app.models import User
from app.models.confirmed_trigger import ConfirmedTrigger
from app.schemas import UserUpdateRequest, UserUpdateResponse
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter()

# @router.get("/{user_id}", response_model=User, status_code=200)
# async def get_user(user_id: UUID, 
#                     db: AsyncSession = Depends(get_session), 
#                     current_user: User = Depends(get_current_user)):
    
#     # Check if user_id is equal to current_user.id
#     if user_id != current_user.id:
#         raise HTTPException(status_code=403, detail="you're messing around")

#     return current_user


@router.get("/me", response_model=UserUpdateResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return UserUpdateResponse(
        username=current_user.username,
        name=current_user.name,
        email=current_user.email,
        digestive_condition=current_user.digestive_condition,
        goal=current_user.goal,
        age_range=current_user.age_range,
        updated_at=current_user.updated_at,
    )


@router.patch("/me", response_model=UserUpdateResponse)
async def update_user_profile(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # If email is being changed, check it isn't taken
    if data.email and data.email != current_user.email:
        existing = await session.exec(
            select(User).where(User.email == data.email)
        )
        if existing.first():
            raise HTTPException(status_code=409, detail="Email already in use")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    current_user.updated_at = datetime.now()
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return UserUpdateResponse(
        username=current_user.username,
        name=current_user.name,
        email=current_user.email,
        digestive_condition=current_user.digestive_condition,
        goal=current_user.goal,
        age_range=current_user.age_range,
        updated_at=current_user.updated_at
    )


@router.get("/insights")
async def get_insights(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Return the user's current pattern cache (triggers + protective factors)
    and their permanently confirmed triggers.

    Returns empty lists before enough logs exist (< 10 with severity).
    """
    # Parse cached pattern engine output
    cache = {}
    if current_user.pattern_cache:
        try:
            cache = json.loads(current_user.pattern_cache)
        except json.JSONDecodeError:
            cache = {}

    # Load confirmed triggers
    rows = (await session.execute(
        select(ConfirmedTrigger)
        .where(ConfirmedTrigger.user_id == current_user.id)
        .order_by(ConfirmedTrigger.confirmed_at.desc())
    )).scalars().all()

    confirmed = [
        {
            "variable_type":   ct.variable_type,
            "variable_value":  ct.variable_value,
            "direction":       ct.direction,
            "pain_delta":      ct.pain_delta,
            "avg_pain_with":   ct.avg_pain_with,
            "avg_pain_without": ct.avg_pain_without,
            "sample_size":     ct.sample_size,
            "confirmed_at":    ct.confirmed_at.isoformat(),
        }
        for ct in rows
    ]

    return {
        "triggers":            cache.get("triggers",   []),
        "protective":          cache.get("protective", []),
        "log_count":           cache.get("log_count",  0),
        "personal_range":      cache.get("personal_range", 0),
        "confirmed_triggers":  confirmed,
        "cache_updated_at":    current_user.pattern_cache_updated_at.isoformat()
                               if current_user.pattern_cache_updated_at else None,
    }