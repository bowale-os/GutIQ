from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict

class OnboardingStatusResponse(BaseModel):
    is_complete: bool
    missing: Dict[str, bool]


class OnboardingCompleteRequest(BaseModel):
    digestive_condition: str = Field(..., min_length=1, max_length=100, description="Digestive condition being tracked")
    goal: str = Field(..., max_length=150, description="Tracking goal")
    age_range: str = Field(..., description="User age range")
    reminder_time: Optional[str] = Field(default=None, description="Preferred log reminder time, e.g. '08:00'")
    reminder_channel: Optional[str] = Field(default=None, description="'email' | 'push' | 'none'")


class OnboardingCompleteResponse(BaseModel):
    message: str
    user_id: str