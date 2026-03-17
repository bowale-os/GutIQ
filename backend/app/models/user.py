from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import func
import uuid

from app.core.utils import utcnow

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    hashed_password: str
    digestive_condition: Optional[str] = Field(default=None, index=True)
    goal: Optional[str] = Field(default=None)
    age_range: Optional[str] = Field(default=None)  # e.g., "Under 20", "20-30", "30-40", "40-50", "50+"
    
    
    # ── GutCheck health profile ───────────────────────────────────────────────
    # Compact Claude-generated summary of all the user's logs.
    # Regenerated in the background every 5 new logs (see gut_check_profile.py).
    health_profile_summary: Optional[str] = Field(default=None)
    profile_updated_at: Optional[datetime] = Field(default=None)
    logs_since_last_profile_change: int = Field(default=0)

    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False
        }
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs={
            "server_default": func.now(),
            "onupdate": func.now(),
            "nullable": False
        }
    )
