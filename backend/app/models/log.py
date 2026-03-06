from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from uuid import UUID
import uuid
from datetime import date, datetime

class Log(SQLModel, table=True):

    __tablename__ = "logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    raw_content: str        # exactly what the user typed
    logged_at: datetime = Field(default_factory=datetime.now)
    
    # populated by AI after submission
    parsed_foods: Optional[str] = None
    parsed_symptoms: Optional[str] = None
    parsed_severity: Optional[int] = None