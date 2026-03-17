# app/models/gut_check.py
"""
GutCheck conversation models.

Two tables:
  GutCheckSession  — one per conversation (created on first message)
  GutCheckMessage  — one row per turn (role = "user" | "assistant")

Kept deliberately simple. The agent loop is stateless — history is
loaded from these tables on each request and passed to Claude directly.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.core.utils import utcnow


class GutCheckSession(SQLModel, table=True):
    __tablename__ = "gut_check_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class GutCheckMessage(SQLModel, table=True):
    __tablename__ = "gut_check_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="gut_check_sessions.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    role: str                                           # "user" | "assistant"
    content: str
    tools_used: Optional[str] = None                   # JSON list e.g. '["query_logs"]'
    created_at: datetime = Field(default_factory=utcnow)
