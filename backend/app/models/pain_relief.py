from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.utils import utcnow as _utcnow


class PainReliefSession(SQLModel, table=True):
    """
    One row per pain relief interaction.

    Stores everything that happened in a single session:
    what the user reported, what condition was identified,
    and what steps Claude recommended.

    The retrieved chunks that grounded the response are stored
    separately in PainReliefChunk (one row per chunk).
    Outcome feedback lives in PainReliefFeedback.
    """
    __tablename__ = "pain_relief_sessions"

    id:         uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id:    uuid.UUID = Field(foreign_key="users.id", index=True)

    # Client-facing session ID — used to look up a session mid-conversation
    session_id: str       = Field(index=True, unique=True)

    # ── What the user reported ─────────────────────────────────────────────────
    # Stored as JSON — list of {region: str, view: str} dicts
    body_clicks:    List   = Field(default=[], sa_column=Column(JSON))
    description:    str                       # free-text pain description
    intensity:      int                       # 1–10
    pain_character: Optional[str] = None      # sharp | dull | cramping | burning | pressure | bloating

    # ── What the system decided ────────────────────────────────────────────────
    identified_condition: str                 # GutCondition value
    is_red_flag:          bool = False
    red_flag_reason:      Optional[str] = None

    # ── What was recommended ───────────────────────────────────────────────────
    steps_recommended: Optional[str] = None  # full Claude response (the ordered steps)

    created_at: datetime = Field(default_factory=_utcnow, index=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    chunks:   List["PainReliefChunk"]           = Relationship(back_populates="session")
    feedback: Optional["PainReliefFeedback"]    = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"uselist": False},
    )


class PainReliefChunk(SQLModel, table=True):
    """
    One row per evidence chunk retrieved from Chroma for a session.

    This gives a full audit trail of what clinical evidence
    grounded each recommendation — queryable by source, condition,
    and relevance score.
    """
    __tablename__ = "pain_relief_chunks"

    id:         uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="pain_relief_sessions.id", index=True)
    user_id:    uuid.UUID = Field(foreign_key="users.id", index=True)

    chunk_text:      str
    source:          str            # "pubmed" | "nhs" | "pdf"
    title:           str
    pmid:            str            # PubMed ID if applicable, else ""
    year:            str
    condition:       str            # condition this chunk was retrieved under
    relevance_score: float          # cosine similarity score from Chroma

    session: Optional[PainReliefSession] = Relationship(back_populates="chunks")


class PainReliefFeedback(SQLModel, table=True):
    """
    Outcome feedback — submitted by the user after trying the steps.

    One feedback per session (unique constraint on session_id).
    This data tells us which conditions, sources, and chunks
    lead to actual relief — the foundation for improving the system.
    """
    __tablename__ = "pain_relief_feedback"

    id:         uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="pain_relief_sessions.id", unique=True, index=True)
    user_id:    uuid.UUID = Field(foreign_key="users.id", index=True)

    # How much the steps helped (1 = not at all, 5 = completely relieved)
    relief_rating:   int

    # How many of the recommended steps the user actually completed
    steps_completed: int

    # Optional free-text note from the user ("the heat helped but the breathing didn't")
    notes: Optional[str] = None

    submitted_at: datetime = Field(default_factory=_utcnow)

    session: Optional[PainReliefSession] = Relationship(back_populates="feedback")
