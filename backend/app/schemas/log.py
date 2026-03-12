# app/schemas/log.py

from pydantic import BaseModel, model_validator
from typing import Optional, List, Literal
from datetime import datetime
import uuid
import json

from app.models.log import LogType


# ── Preview ────────────────────────────────────────────────────────────────────

class LogPreviewResponse(BaseModel):
    transcript: Optional[str] = None          # populated for voice, None for text
    log_categories: List[str] = []
    parsed_foods: Optional[List[str]] = None
    parsed_symptoms: Optional[List[str]] = None
    parsed_severity: Optional[int] = None
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None
    confidence: str = "high"
    natural_summary: str = ""
    missing_critical_field: Optional[str] = None


# ── Save (after user confirms) ─────────────────────────────────────────────────

class LogCreateRequest(BaseModel):
    source: Literal["text", "voice"]
    raw_content: Optional[str] = None
    log_categories: Optional[List[str]] = None
    parsed_foods: Optional[List[str]] = None
    parsed_symptoms: Optional[List[str]] = None
    parsed_severity: Optional[int] = None
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None


# ── Response ───────────────────────────────────────────────────────────────────

class LogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    raw_content: Optional[str]
    logged_at: datetime
    log_type: Optional[LogType] = None
    parsed_foods: Optional[List[str]] = None
    parsed_symptoms: Optional[List[str]] = None
    parsed_severity: Optional[int] = None
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None

    @classmethod
    def from_orm(cls, log) -> "LogResponse":
        return cls(
            id=log.id,
            user_id=log.user_id,
            raw_content=log.raw_content,
            logged_at=log.logged_at,
            log_type=log.log_type,
            parsed_foods=json.loads(log.parsed_foods) if log.parsed_foods else None,
            parsed_symptoms=json.loads(log.parsed_symptoms) if log.parsed_symptoms else None,
            parsed_severity=log.parsed_severity,
            parsed_stress=log.parsed_stress,
            parsed_sleep=log.parsed_sleep,
            parsed_exercise=log.parsed_exercise
        )


class LogListResponse(BaseModel):
    logs: List[LogResponse]
    total: int


class LogCreateResponse(BaseModel):
    success: bool = True
    message: str = "Log saved."
    log: LogResponse