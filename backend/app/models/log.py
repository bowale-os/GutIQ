from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.utils import utcnow as _utcnow


class Log(SQLModel, table=True):
    """Envelope — raw input only. Never modified after save."""
    __tablename__ = "logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    raw_content: str
    source: str                               # "text" | "voice"
    transcript: Optional[str] = None         # populated for voice
    logged_at: datetime = Field(default_factory=_utcnow, index=True)
    natural_summary: Optional[str] = None
    confidence: Optional[str] = None

    food_entries: List["FoodEntry"] = Relationship(back_populates="log")
    symptom_entries: List["SymptomEntry"] = Relationship(back_populates="log")
    wellness_entry: Optional["WellnessEntry"] = Relationship(
        back_populates="log",
        sa_relationship_kwargs={"uselist": False},
    )


class FoodEntry(SQLModel, table=True):
    """One row per food item. Queryable, indexable, joinable."""
    __tablename__ = "food_entries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    log_id: uuid.UUID = Field(foreign_key="logs.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    logged_at: datetime
    name: str

    log: Optional[Log] = Relationship(back_populates="food_entries")


class SymptomEntry(SQLModel, table=True):
    """One row per symptom. Severity lives here, not on the log."""
    __tablename__ = "symptom_entries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    log_id: uuid.UUID = Field(foreign_key="logs.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    logged_at: datetime
    name: str
    severity: Optional[int] = None            # 1–10, per symptom

    log: Optional[Log] = Relationship(back_populates="symptom_entries")


class WellnessEntry(SQLModel, table=True):
    """One per log — stress, sleep, exercise. Scalar measurements, not a list."""
    __tablename__ = "wellness_entries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    log_id: uuid.UUID = Field(foreign_key="logs.id", unique=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    logged_at: datetime
    stress: Optional[str] = None              # "low" | "medium" | "high"
    sleep_hours: Optional[float] = None
    exercise: Optional[str] = None            # "none" | "light" | "moderate" | "intense"

    log: Optional[Log] = Relationship(back_populates="wellness_entry")
