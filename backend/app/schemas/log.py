from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class LogCreateRequest(BaseModel):
    user_id: str
    raw_content: str

class LogCreateResponse(BaseModel):
    success: bool = True
    message: str = "Log created successfully"
