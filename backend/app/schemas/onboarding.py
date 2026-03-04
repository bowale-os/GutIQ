from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Literal

class OnboardingStatusResponse(BaseModel):
    is_complete: bool
    missing: Dict[str, bool]


class OnboardingCompleteRequest(BaseModel):
    digestive_condition: Literal["GERD", "IBS", "Ulcer", "Other"] = Field(..., description="Digestive condition being tracked")
    goal: str = Field(..., max_length=150, description="Tracking goal (e.g. 'identify food triggers')")
    age_range: Literal["20-30", "30-40", "40-50", "50+"] = Field(..., description="User age range")


class OnboardingCompleteResponse(BaseModel):
    message: str
    user_id: str