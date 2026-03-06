from sqlmodel import SQLModel, Field
from typing import Optional
from uuid import UUID
import uuid
from datetime import datetime
from enum import Enum

class LogType(str, Enum):
    food = "food"
    symptom = "symptom"
    general = "general"

class Log(SQLModel, table=True):
    __tablename__ = "logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    
    # Raw input — always saved first, never modified
    raw_content: str
    source: str
    logged_at: datetime = Field(default_factory=datetime.now)
    
    # AI-populated fields — all Optional until processed
    log_type: Optional[LogType] = None          # AI classifies after save
    parsed_foods: Optional[str] = None          # JSON string: '["coffee", "pasta"]'
    parsed_symptoms: Optional[str] = None       # JSON string: '["heartburn", "bloating"]'
    parsed_severity: Optional[int] = None       # 1–10
    parsed_stress: Optional[str] = None         # "low" | "medium" | "high"
    parsed_sleep: Optional[float] = None        # hours e.g. 6.5
    parsed_exercise: Optional[str] = None       # "none" | "light" | "moderate" | "intense"
    is_ai_processed: bool = Field(default=False)