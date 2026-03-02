from pydantic import BaseModel, EmailStr, Field
from typing import Optional

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


class UserUpdateRequest(BaseModel):
    digestive_condition: Optional[str] = Field(..., min_length=2, max_length=50)
    goal: Optional[str] = None

class UserUpdateResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    digestive_condition: Optional[str] = None
    onboarding_goal: Optional[str] = None

