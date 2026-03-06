from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta, datetime
from uuid import UUID


from app.db import get_session
from app.models import User
from app.schemas import UserUpdateRequest, UserUpdateResponse
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/{user_id}", response_model=User, status_code=200)
async def get_user(user_id: UUID, 
                    db: AsyncSession = Depends(get_session), 
                    current_user: User = Depends(get_current_user)):
    
    # Check if user_id is equal to current_user.id
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="you're messing around")

    return current_user


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
        email= current_user.email,
        digestive_condition=current_user.digestive_condition,
        goal=current_user.goal,
        age_range=current_user.age_range,
        updated_at=current_user.updated_at
    )