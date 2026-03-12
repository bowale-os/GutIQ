from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)

class LogInRequest(BaseModel):
    email: EmailStr  
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
    email: EmailStr
    digestive_condition: Optional[str] = None
    goal: Optional[str] = None
    age_range: Optional[str] = None
    updated_at: datetime

