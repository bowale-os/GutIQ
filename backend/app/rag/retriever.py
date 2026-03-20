# app/rag/retriever.py
"""
Retriever — maps user pain input to relevant clinical evidence chunks.

Pipeline (zero LLM calls):
  1. Red flag check          (deterministic keyword + structural rules)
  2. Region → condition map  (body click coordinates → condition candidates)
  3. Keyword signal scoring  (free-text → refines condition)
  4. Qdrant similarity search filtered by winning condition
  5. Return RetrievalResult ready for the generation step

The Qdrant client is a module-level singleton — instantiated once on
first call and reused for the lifetime of the process.

Debug:
  - "No vectors returned" → collection may be empty, run ingest first
  - Wrong condition identified → check KEYWORD_WEIGHTS and region maps
  - Import error on qdrant_client → pip install langchain-qdrant qdrant-client
"""

import logging
import uuid

from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

from app.core.config import settings
from app.schemas.pain_relief import (
    AnteriorRegion,
    BodyClickPoint,
    BodyView,
    GutCondition,
    PainCharacter,
    PainReliefRequest,
    PosteriorRegion,
    RetrievalResult,
    RetrievedChunk,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "gut_pain_relief"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
TOP_K           = 6   # chunks returned per query


# ── Red flag rules ─────────────────────────────────────────────────────────────
# Checked before any retrieval. If triggered, skip Qdrant entirely.

_RED_FLAG_PATTERNS: list[tuple[str, str]] = [
    # ── original ──────────────────────────────────────────────────────────────
    ("sudden severe",        "Sudden severe pain can indicate a serious condition."),
    ("worst pain",           "Worst-ever pain requires immediate medical evaluation."),
    ("rigid abdomen",        "Abdominal rigidity may indicate a surgical emergency."),
    ("vomiting blood",       "Vomiting blood requires emergency care."),
    ("blood in stool",       "Blood in stool requires prompt medical attention."),
    ("rectal bleeding",      "Rectal bleeding requires prompt medical attention."),
    ("cannot stand",         "Inability to stand due to pain requires emergency care."),
    ("can't stand",          "Inability to stand due to pain requires emergency care."),
    ("chest pain",           "Chest pain alongside gut symptoms requires immediate evaluation."),
    ("difficulty breathing", "Difficulty breathing requires emergency care."),
    ("high fever",           "Fever with abdominal pain may indicate infection or inflammation."),
    ("jaundice",             "Yellowing skin with abdominal pain requires urgent evaluation."),
    # ── expanded ──────────────────────────────────────────────────────────────
    ("can't move",           "Inability to move due to pain requires emergency care."),
    ("cannot move",          "Inability to move due to pain requires emergency care."),
    ("barely move",          "Inability to move due to pain requires emergency care."),
    ("doubled over",         "Severe pain causing inability to stand requires evaluation."),
    ("shoulder tip",         "Shoulder tip pain with abdominal symptoms may indicate a biliary emergency."),
    ("black stool",          "Black or tarry stools may indicate internal bleeding."),
    ("tarry stool",          "Black or tarry stools may indicate internal bleeding."),
    ("coffee ground",        "Coffee-ground vomit may indicate internal bleeding."),
    ("feel faint",           "Fainting with abdominal pain requires immediate evaluation."),
    ("feeling faint",        "Fainting with abdominal pain requires immediate evaluation."),
    ("passed out",           "Loss of consciousness with abdominal pain requires emergency care."),
    ("rigid",                "Abdominal rigidity may indicate a surgical emergency."),
    ("rebound",              "Rebound tenderness may indicate a surgical emergency."),
    ("out of nowhere",       "Sudden-onset pain requires immediate medical evaluation."),
    ("hit me suddenly",      "Sudden-onset pain requires immediate medical evaluation."),
    ("came on suddenly",     "Sudden-onset pain requires immediate medical evaluation."),
]

# Lower-right anterior + intensity ≥ this threshold → possible appendicitis
_APPENDIX_INTENSITY_THRESHOLD = 6


# ── Region → candidate conditions ─────────────────────────────────────────────
# Ordered list — first entry is the primary candidate (scores 2.0),
# subsequent entries are secondary candidates (score 1.0 each).

_ANTERIOR_MAP: dict[AnteriorRegion, list[GutCondition]] = {
    AnteriorRegion.throat_chest:  [GutCondition.acid_reflux,          GutCondition.nausea],
    AnteriorRegion.upper_center:  [GutCondition.acid_reflux,          GutCondition.functional_dyspepsia],
    AnteriorRegion.upper_right:   [GutCondition.peptic_ulcer,         GutCondition.acid_reflux],
    AnteriorRegion.upper_left:    [GutCondition.gas_bloating,         GutCondition.functional_dyspepsia],
    AnteriorRegion.central:       [GutCondition.gas_bloating,         GutCondition.ibs_cramping],
    AnteriorRegion.lower_right:   [GutCondition.ibs_cramping,         GutCondition.ibd_flare],
    AnteriorRegion.lower_left:    [GutCondition.ibd_flare,            GutCondition.ibs_cramping],
    AnteriorRegion.lower_center:  [GutCondition.constipation,         GutCondition.ibs_cramping],
    AnteriorRegion.whole_abdomen: [GutCondition.general,              GutCondition.gas_bloating],
}

_POSTERIOR_MAP: dict[PosteriorRegion, list[GutCondition]] = {
    PosteriorRegion.upper_back_center: [GutCondition.acid_reflux,    GutCondition.peptic_ulcer],
    PosteriorRegion.upper_back_left:   [GutCondition.gas_bloating,   GutCondition.general],
    PosteriorRegion.upper_back_right:  [GutCondition.acid_reflux,    GutCondition.general],
    PosteriorRegion.lower_back_center: [GutCondition.constipation,   GutCondition.ibs_cramping],
    PosteriorRegion.lower_back_left:   [GutCondition.ibd_flare,      GutCondition.ibs_cramping],
    PosteriorRegion.lower_back_right:  [GutCondition.ibs_cramping,   GutCondition.general],
}

# ── Keyword → condition boost ──────────────────────────────────────────────────
# Applied to the user's free-text description. Weights are summed and
# added to the region-derived scores to pick the winning condition.

_KEYWORD_WEIGHTS: list[tuple[list[str], GutCondition, float]] = [
    (["burning", "fire", "acid", "sour", "after eating", "regurgitat", "heartburn"],
     GutCondition.acid_reflux, 1.5),
    (["cramping", "cramp", "spasm", "waves", "comes and goes"],
     GutCondition.ibs_cramping, 1.5),
    (["bloated", "bloating", "full", "distended", "gas", "gassy", "trapped wind", "flatulence"],
     GutCondition.gas_bloating, 1.5),
    (["can't go", "cannot go", "haven't gone", "no bowel", "constipat", "hard stool"],
     GutCondition.constipation, 1.5),
    (["nauseous", "nausea", "sick", "want to vomit", "vomit", "queasy"],
     GutCondition.nausea, 1.5),
    (["indigestion", "dyspepsia", "fullness after eating", "early satiety", "epigastric"],
     GutCondition.functional_dyspepsia, 1.5),
    (["flare", "flare-up", "crohn", "colitis", "bloody stool", "mucus stool", "urgency"],
     GutCondition.ibd_flare, 1.5),
    (["dairy", "milk", "lactose", "cheese", "after milk", "after dairy"],
     GutCondition.lactose_intolerance, 1.5),
    (["ulcer", "pylori", "stomach ulcer", "gnawing", "empty stomach", "hunger pain"],
     GutCondition.peptic_ulcer, 1.5),
    (["gluten", "wheat", "after bread", "after pasta", "celiac", "coeliac"],
     GutCondition.celiac, 1.5),
]

_CHARACTER_MAP: dict[PainCharacter, GutCondition] = {
    PainCharacter.burning:  GutCondition.acid_reflux,
    PainCharacter.cramping: GutCondition.ibs_cramping,
    PainCharacter.bloating: GutCondition.gas_bloating,
    PainCharacter.pressure: GutCondition.gas_bloating,
    PainCharacter.sharp:    GutCondition.ibs_cramping,
    PainCharacter.dull:     GutCondition.general,
}


# ── Qdrant singleton ───────────────────────────────────────────────────────────

_vector_store: QdrantVectorStore | None = None


def _get_vector_store() -> QdrantVectorStore:
    """
    Return the module-level Qdrant client, creating it on first call.
    Thread-safe for reads; ingest is a separate offline process.
    """
    global _vector_store
    if _vector_store is None:
        logger.info("Initialising Qdrant vector store connection...")
        embeddings = FastEmbedEmbeddings(model_name=EMBEDDING_MODEL)
        _vector_store = QdrantVectorStore.from_existing_collection(
            embedding=embeddings,
            collection_name=COLLECTION_NAME,
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
        )
        logger.info("Qdrant vector store ready | collection=%s", COLLECTION_NAME)
    return _vector_store


# ── Internal helpers ───────────────────────────────────────────────────────────

def _check_red_flags(request: PainReliefRequest) -> tuple[bool, str | None]:
    desc = request.description.lower()

    for pattern, reason in _RED_FLAG_PATTERNS:
        if pattern in desc:
            return True, reason

    # Structural: lower-right anterior click + high intensity → appendicitis risk
    for click in request.body_clicks:
        if (
            click.view == BodyView.anterior
            and click.region == AnteriorRegion.lower_right
            and request.intensity >= _APPENDIX_INTENSITY_THRESHOLD
        ):
            return True, (
                "Sharp pain in the lower right abdomen with high intensity "
                "may indicate appendicitis. Please seek medical attention immediately."
            )

    return False, None


def _resolve_condition(
    body_clicks: list[BodyClickPoint],
    description: str,
    pain_character: PainCharacter | None,
) -> GutCondition:
    """Score every condition from region signals + keyword signals, return winner."""
    scores: dict[GutCondition, float] = {c: 0.0 for c in GutCondition}

    # Region scores (primary candidate = 2.0, secondary = 1.0)
    for click in body_clicks:
        region_map  = _ANTERIOR_MAP if click.view == BodyView.anterior else _POSTERIOR_MAP
        candidates  = region_map.get(click.region, [GutCondition.general])
        for i, condition in enumerate(candidates):
            scores[condition] += 2.0 if i == 0 else 1.0

    # Keyword boosts from free-text description
    desc = description.lower()
    for keywords, condition, weight in _KEYWORD_WEIGHTS:
        if any(kw in desc for kw in keywords):
            scores[condition] += weight

    # Pain character boost
    if pain_character and pain_character in _CHARACTER_MAP:
        scores[_CHARACTER_MAP[pain_character]] += 1.0

    winner = max(scores, key=lambda c: scores[c])
    logger.debug("Condition scores: %s | winner: %s", scores, winner.value)
    return winner


def _search(condition: GutCondition, query: str) -> list[RetrievedChunk]:
    """
    Embed the query and search Qdrant filtered to the resolved condition.
    Falls back to an unfiltered search if the filtered query returns nothing.
    """
    store = _get_vector_store()

    # Qdrant payload filter — metadata fields are stored under 'metadata.*'
    qdrant_filter = Filter(
        must=[
            FieldCondition(
                key="metadata.condition",
                match=MatchValue(value=condition.value),
            )
        ]
    )

    results = store.similarity_search_with_relevance_scores(
        query=query,
        k=TOP_K,
        filter=qdrant_filter,
    )

    # Fallback: no results for this condition (collection may be partly indexed)
    if not results:
        logger.warning(
            "No results for condition='%s' — falling back to unfiltered search",
            condition.value,
        )
        results = store.similarity_search_with_relevance_scores(query=query, k=TOP_K)

    return [
        RetrievedChunk(
            text=doc.page_content,
            condition=doc.metadata.get("condition", "general"),
            source=doc.metadata.get("source", ""),
            title=doc.metadata.get("title", ""),
            pmid=doc.metadata.get("pmid", ""),
            year=doc.metadata.get("year", ""),
            relevance_score=round(score, 4),
        )
        for doc, score in results
    ]


# ── Public API ─────────────────────────────────────────────────────────────────

def retrieve(request: PainReliefRequest) -> RetrievalResult:
    """
    Main entry point called by the FastAPI endpoint (via asyncio.to_thread).

    Returns a RetrievalResult containing:
      - session_id       : stable ID for this interaction
      - condition        : identified gut condition
      - is_red_flag      : whether to skip generation and escalate
      - red_flag_reason  : human-readable escalation reason (if applicable)
      - chunks           : clinical evidence chunks to ground Claude's response
    """
    session_id = request.session_id or str(uuid.uuid4())

    # 1. Red flag — always checked first, never skipped
    is_red_flag, reason = _check_red_flags(request)
    if is_red_flag:
        logger.warning("Red flag | session=%s reason=%s", session_id, reason)
        return RetrievalResult(
            session_id=session_id,
            condition=GutCondition.general,
            is_red_flag=True,
            red_flag_reason=reason,
            chunks=[],
        )

    # 2. Resolve condition from body region + description signals
    condition = _resolve_condition(
        body_clicks=request.body_clicks,
        description=request.description,
        pain_character=request.pain_character,
    )
    logger.info("Condition resolved | session=%s condition=%s", session_id, condition.value)

    # 3. Retrieve from Qdrant
    chunks = _search(condition=condition, query=request.description)
    logger.info(
        "Chunks retrieved | session=%s count=%d top_score=%.4f",
        session_id,
        len(chunks),
        chunks[0].relevance_score if chunks else 0.0,
    )

    return RetrievalResult(
        session_id=session_id,
        condition=condition,
        is_red_flag=False,
        red_flag_reason=None,
        chunks=chunks,
    )
