from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict

class OnboardingStatusResponse(BaseModel):
    is_complete: bool
    missing: Dict[str, bool]


class OnboardingCompleteRequest(BaseModel):
    digestive_condition: str = Field(..., min_length=1, max_length=100, description="Digestive condition being tracked")
    goal: str = Field(..., max_length=150, description="Tracking goal")
    age_range: str = Field(..., description="User age range")


class OnboardingCompleteResponse(BaseModel):
    message: str
    user_id: str