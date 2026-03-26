# app/schemas/log.py

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid


# ── Shared sub-models ─────────────────────────────────────────────────────────

class SymptomItem(BaseModel):
    name: str
    severity: Optional[int] = Field(None, ge=1, le=10)


class WellnessData(BaseModel):
    stress: Optional[Literal["low", "medium", "high"]] = None
    sleep_hours: Optional[float] = None
    exercise: Optional[Literal["none", "light", "moderate", "intense"]] = None


# ── Parser output (internal — matches LLM JSON exactly) ──────────────────────

class FoodItem(BaseModel):
    name: str


class ParsedLogData(BaseModel):
    foods: List[FoodItem] = []
    symptoms: List[SymptomItem] = []
    wellness: WellnessData = WellnessData()
    natural_summary: Optional[str] = None
    confidence: str = "high"
    missing_critical_field: Optional[str] = None
    overall_severity: Optional[int] = None


# ── Preview (returned to client after parsing, before save) ───────────────────

class LogPreviewResponse(BaseModel):
    transcript: Optional[str] = None
    log_categories: List[str] = []
    parsed_foods: List[str] = []
    parsed_symptoms: List[SymptomItem] = []
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None
    overall_severity: Optional[int] = None
    confidence: str = "high"
    natural_summary: Optional[str] = None
    missing_critical_field: Optional[str] = None


# ── Save (after user confirms preview) ────────────────────────────────────────

class LogCreateRequest(BaseModel):
    source: Literal["text", "voice"]
    raw_content: Optional[str] = None
    transcript: Optional[str] = None
    natural_summary: Optional[str] = None
    confidence: Optional[str] = None
    parsed_foods: Optional[List[str]] = None
    parsed_symptoms: Optional[List[SymptomItem]] = None
    overall_severity: Optional[int] = Field(None, ge=1, le=10)
    parsed_stress: Optional[Literal["low", "medium", "high"]] = None
    parsed_sleep: Optional[float] = Field(None, ge=0, le=24)
    parsed_exercise: Optional[Literal["none", "light", "moderate", "intense"]] = None


# ── Response ──────────────────────────────────────────────────────────────────

class LogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    raw_content: Optional[str]
    logged_at: datetime
    natural_summary: Optional[str] = None
    confidence: Optional[str] = None
    parsed_foods: List[str] = []
    parsed_symptoms: List[SymptomItem] = []
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None

    @classmethod
    def from_orm(cls, log) -> "LogResponse":
        wellness = log.wellness_entry
        return cls(
            id=log.id,
            user_id=log.user_id,
            raw_content=log.raw_content,
            logged_at=log.logged_at,
            natural_summary=log.natural_summary,
            confidence=log.confidence,
            parsed_foods=[f.name for f in (log.food_entries or [])],
            parsed_symptoms=[
                SymptomItem(name=s.name, severity=s.severity)
                for s in (log.symptom_entries or [])
            ],
            parsed_stress=wellness.stress if wellness else None,
            parsed_sleep=wellness.sleep_hours if wellness else None,
            parsed_exercise=wellness.exercise if wellness else None,
        )


class LogListResponse(BaseModel):
    logs: List[LogResponse]
    total: int


class LogCreateResponse(BaseModel):
    success: bool = True
    message: str = "Log saved."
    log: LogResponse
