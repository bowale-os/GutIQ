from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Literal
from datetime import datetime
import uuid
import json

from app.models.log import LogType


class LogCreateRequest(BaseModel):
    raw_content: str
    source: str

class LogPreviewRequest(BaseModel):
    user_id: uuid.UUID
    source: Literal["voice", "text"]
    raw_content: Optional[str] = None    # text only
    audio_data: Optional[bytes] = None   # voice only

    @model_validator(mode="after")
    def validate_source(self):
        if self.source == "voice" and not self.audio_data:
            raise ValueError("Voice preview requires audio_data")
        if self.source == "text" and not self.raw_content:
            raise ValueError("Text preview requires raw_content")
        return self


class LogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    raw_content: str
    logged_at: datetime
    log_type: Optional[LogType] = None
    parsed_foods: Optional[List[str]] = None      # deserialized from JSON string
    parsed_symptoms: Optional[List[str]] = None   # deserialized from JSON string
    parsed_severity: Optional[int] = None
    parsed_stress: Optional[str] = None
    parsed_sleep: Optional[float] = None
    parsed_exercise: Optional[str] = None
    is_ai_processed: bool

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
            parsed_exercise=log.parsed_exercise,
            is_ai_processed=log.is_ai_processed,
        )


class LogListResponse(BaseModel):
    logs: List[LogResponse]
    total: int


class LogCreateResponse(BaseModel):
    success: bool = True
    message: str = "Log saved. Processing with Nova..."
    log: LogResponse
