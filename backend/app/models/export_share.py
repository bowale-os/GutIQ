# app/models/export_share.py
"""
ExportShare — stores a short-lived snapshot of the patient's export report
so a doctor can view it via a public link without needing an account.

Token is a UUID; expires after 7 days by default.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text

from app.core.utils import utcnow


class ExportShare(SQLModel, table=True):
    __tablename__ = "export_shares"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # The URL-safe token — sent to the doctor, used to look up this row
    token: str = Field(index=True, unique=True)

    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Full report JSON snapshot (logs + stats) serialised as a string
    report_json: str = Field(sa_column=Column(Text, nullable=False))

    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime = Field(
        default_factory=lambda: utcnow() + timedelta(days=7)
    )
