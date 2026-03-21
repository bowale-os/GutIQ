from pydantic import BaseModel, Field
from typing import Optional, Dict


class OnboardingStatusResponse(BaseModel):
    is_complete: bool
    missing: Dict[str, bool]


class OnboardingCompleteRequest(BaseModel):
    digestive_condition: str = Field(..., min_length=1, max_length=100)
    goal: str = Field(..., max_length=150)
    age_range:        Optional[str] = Field(default=None)
    reminder_time:     Optional[str] = Field(default=None)   # "08:00"
    reminder_channel:  Optional[str] = Field(default=None)   # "email" | "push" | "none"
    reminder_timezone: Optional[str] = Field(default=None)   # IANA tz, e.g. "America/Chicago"
    preferred_name:   Optional[str] = Field(default=None, max_length=60)
    medications:      Optional[str] = Field(default=None, max_length=500)
    dietary_protocol: Optional[str] = Field(default=None, max_length=100)


class OnboardingCompleteResponse(BaseModel):
    message: str
    user_id: str
