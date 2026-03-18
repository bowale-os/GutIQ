from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re

_USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,30}$')

class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=8)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("Username must be 3–30 characters: letters, numbers, underscores only.")
        return v.lower()

class LogInRequest(BaseModel):
    """identifier can be username or email."""
    identifier: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    digestive_condition: Optional[str] = None
    goal: Optional[str] = None
    age_range: Optional[str] = None

class UserUpdateResponse(BaseModel):
    username: str
    name: Optional[str] = None
    email: Optional[str] = None
    digestive_condition: Optional[str] = None
    goal: Optional[str] = None
    age_range: Optional[str] = None
    updated_at: datetime

