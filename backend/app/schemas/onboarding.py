from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict

class OnboardingStatusResponse(BaseModel):
    is_complete: bool
    missing: Dict[str, bool]


class OnboardingCompleteRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="User's name")
    digestive_condition: str = Field(..., min_length=1, max_length=100, description="Digestive condition being tracked")
    goal: str = Field(..., max_length=150, description="Tracking goal")
    age_range: str = Field(..., description="User age range")


class OnboardingCompleteResponse(BaseModel):
    message: str
    user_id: str