from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_current_user
from app.db import get_session
from app.models.user import User
from app.schemas.onboarding import OnboardingStatusResponse, OnboardingCompleteRequest, OnboardingCompleteResponse

router = APIRouter()

@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Check if user needs onboarding (missing fields)"""

    complete = bool(current_user.digestive_condition and current_user.goal and current_user.age_range)
    response = OnboardingStatusResponse(
        is_complete = complete,
        missing={
            "digestive_condition": not current_user.digestive_condition,
            "goal": not current_user.goal,
            "age_range": not current_user.age_range
        }
    )
    return response

@router.post("/complete")
async def complete_onboarding(
    data:OnboardingCompleteRequest ,  # in this format {"digestive_condition": "GERD", "goal": "triggers", "age_range": "30-40"}
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):

    """Complete user onboarding with condition, goal, and age range"""
    user_db = await session.get(User, current_user.id)
    
    # Safe direct assignment (validated by Pydantic)
    user_db.digestive_condition = data.digestive_condition
    user_db.goal = data.goal
    user_db.age_range = data.age_range
    
    await session.commit()
    await session.refresh(user_db)
    
    return OnboardingCompleteResponse(
        message="Onboarding complete! Ready to start voice logging.",
        user_id=str(current_user.id)
    )