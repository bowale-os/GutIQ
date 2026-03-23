"""
ConfirmedTrigger — permanent record of a pattern the app has verified
with enough data to trust.

Promoted from pattern_cache when:
  - delta > user's personal noise floor
  - sample_size >= 15 logs

Feeds: GP export, GutCheck system prompt context, dashboard findings card.
Separated from pattern_cache deliberately — cache is a hypothesis that
gets rewritten every 5 logs; confirmed triggers are the permanent record
of what the app has actually learned about this person.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field

from app.core.utils import utcnow


class ConfirmedTrigger(SQLModel, table=True):
    __tablename__ = "confirmed_triggers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # What was confirmed
    variable_type:  str  # "food" | "stress" | "sleep" | "exercise"
    variable_value: str  # "coffee", "high", "sleep_lt_6", "none"
    direction:      str  # "trigger" | "protective"

    # The result — stored in full so the GP export and GutCheck can quote
    # real numbers without recomputing ("coffee days avg 7.2, non-coffee 4.8")
    pain_delta:       float  # positive = trigger, negative = protective
    avg_pain_with:    float  # avg severity when variable present
    avg_pain_without: float  # avg severity when variable absent
    sample_size:      int    # total logs this conclusion is based on

    confirmed_at: datetime = Field(default_factory=utcnow)
