from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import func
import uuid

from app.core.utils import utcnow

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(index=True, unique=True)
    name: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None, index=True, unique=True)
    hashed_password: str
    digestive_condition: Optional[str] = Field(default=None, index=True)
    goal: Optional[str] = Field(default=None)
    age_range: Optional[str] = Field(default=None)  # e.g., "Under 20", "20-30", "30-40", "40-50", "50+"
    
    
    # ── Health context (collected in onboarding) ──────────────────────────────
    medications:      Optional[str] = Field(default=None)  # comma-separated, e.g. "omeprazole, buscopan"
    dietary_protocol: Optional[str] = Field(default=None)  # e.g. "low-fodmap", "gluten-free", "none"

    # ── Reminders ────────────────────────────────────────────────────────────
    reminder_time:     Optional[str] = Field(default=None)  # "08:00" (24-hr, user's local time)
    reminder_channel:  Optional[str] = Field(default=None)  # "email" | "push" | "none"
    reminder_timezone: Optional[str] = Field(default=None)  # IANA tz, e.g. "America/Chicago"

    # ── GutCheck health profile ───────────────────────────────────────────────
    # Compact Claude-generated summary of all the user's logs.
    # Regenerated in the background every 5 new logs (see gut_check_profile.py).
    health_profile_summary: Optional[str] = Field(default=None)
    profile_updated_at: Optional[datetime] = Field(default=None)
    logs_since_last_profile_change: int = Field(default=0)

    # ── Pattern cache ─────────────────────────────────────────────────────────
    # JSON string written by the pattern engine every 5 logs (same background
    # task as health_profile_summary). Read by dashboard, GutCheck, post-save.
    # Format: {"triggers": [...], "protective": [...], "log_count": 34}
    pattern_cache: Optional[str] = Field(default=None)
    pattern_cache_updated_at: Optional[datetime] = Field(default=None)

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
