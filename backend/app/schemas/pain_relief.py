"""
Schemas for the pain relief feature.

The frontend shows anterior and posterior body images side by side.
The user taps one or more spots on either image. The frontend maps
tap coordinates → (region, view) pairs and sends them here.
"""

from enum import Enum
from pydantic import BaseModel, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────────────

class BodyView(str, Enum):
    anterior  = "anterior"   # front of body
    posterior = "posterior"  # back of body


class AnteriorRegion(str, Enum):
    """Clickable regions on the anterior (front) body image."""
    throat_chest  = "throat_chest"   # throat / chest — acid reflux, nausea
    upper_center  = "upper_center"   # epigastric — acid reflux, GERD
    upper_right   = "upper_right"    # RUQ — acid reflux, general
    upper_left    = "upper_left"     # LUQ — gas/bloating, general
    central       = "central"        # periumbilical — gas/bloating, IBS
    lower_right   = "lower_right"    # RLQ — IBS, constipation (red flag: appendix)
    lower_left    = "lower_left"     # LLQ — IBS cramping, constipation
    lower_center  = "lower_center"   # suprapubic — constipation, IBS
    whole_abdomen = "whole_abdomen"  # diffuse — general


class PosteriorRegion(str, Enum):
    """Clickable regions on the posterior (back) body image."""
    upper_back_center = "upper_back_center"  # referred acid reflux / esophageal
    upper_back_left   = "upper_back_left"    # referred gas / general
    upper_back_right  = "upper_back_right"   # referred acid reflux
    lower_back_center = "lower_back_center"  # referred IBS / constipation
    lower_back_left   = "lower_back_left"    # referred IBS cramping
    lower_back_right  = "lower_back_right"   # referred IBS cramping (red flag: kidney)


class GutCondition(str, Enum):
    """Gut conditions the system can identify and retrieve for."""
    ibs_cramping = "ibs_cramping"
    gas_bloating = "gas_bloating"
    acid_reflux  = "acid_reflux"
    constipation = "constipation"
    nausea       = "nausea"
    general      = "general"


class PainCharacter(str, Enum):
    """Optional structured pain descriptor — selected by the user in the UI."""
    sharp    = "sharp"
    dull     = "dull"
    cramping = "cramping"
    burning  = "burning"
    pressure = "pressure"
    bloating = "bloating"


# ── Sub-models ─────────────────────────────────────────────────────────────────

class BodyClickPoint(BaseModel):
    """
    A single tap on the body image.
    The frontend maps pixel coordinates → region name + view and sends this.
    """
    region: AnteriorRegion | PosteriorRegion = Field(
        ..., description="Named body region derived from tap coordinates"
    )
    view: BodyView = Field(
        ..., description="Which body image was tapped — anterior or posterior"
    )


# ── Request ────────────────────────────────────────────────────────────────────

class PainReliefRequest(BaseModel):
    """
    Sent by the frontend when the user submits their pain.

    - `body_clicks`  : all tapped spots across both body images (1 or more)
    - `description`  : free-text description of how the pain feels
    - `intensity`    : self-rated severity 1–10
    - `pain_character`: optional structured pain type selected in the UI
    - `session_id`   : null on first submission, populated for follow-ups
    """
    session_id:     str | None      = Field(default=None)
    body_clicks:    list[BodyClickPoint] = Field(
        ..., min_length=1, description="At least one body region must be selected"
    )
    description:    str             = Field(..., min_length=5, max_length=1000)
    intensity:      int             = Field(..., ge=1, le=10)
    pain_character: PainCharacter | None = Field(default=None)

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        return v.strip()


# ── Internal: retriever output ─────────────────────────────────────────────────

class RetrievedChunk(BaseModel):
    """A single document chunk returned from the Chroma vector store."""
    text:            str
    condition:       str
    source:          str   # "pubmed" | "nhs" | "pdf"
    title:           str
    pmid:            str
    year:            str
    relevance_score: float


class RetrievalResult(BaseModel):
    """
    Output of the retriever — passed into the LLM generation step.
    If `is_red_flag` is True the endpoint skips generation entirely
    and returns the escalation message directly.
    """
    session_id:      str
    condition:       GutCondition
    is_red_flag:     bool
    red_flag_reason: str | None
    chunks:          list[RetrievedChunk]


# ── Response ───────────────────────────────────────────────────────────────────

class PrimaryAction(BaseModel):
    """One focused relief action — the thing the user does right now."""
    action:           str   # 3-6 word action name
    instruction:      str   # 1-2 sentences of exactly what to do
    duration_minutes: int


class StructuredRelief(BaseModel):
    """
    Structured output from the LLM — replaces the raw markdown reply string.

    primary              — the single most effective immediate intervention
    maintain             — short passive behaviours to keep doing alongside primary
    avoid                — short list of things not to do
    alternatives         — exactly 2 backup primary actions (shown if primary doesn't help)
    session_duration_minutes — total length of the relief session
    when_to_seek_care    — one calm sentence about when to escalate
    """
    primary:                  PrimaryAction
    maintain:                 list[str]
    avoid:                    list[str]
    alternatives:             list[PrimaryAction]
    session_duration_minutes: int
    when_to_seek_care:        str


class PainReliefResponse(BaseModel):
    """Returned to the frontend after the full pipeline completes."""
    session_id:      str
    is_red_flag:     bool
    red_flag_reason: str | None = None
    condition:       GutCondition | None = None
    structured:      StructuredRelief | None = None
    reply:           str  # red flag message only; empty string on normal response
