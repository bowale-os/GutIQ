"""
Unit tests for retriever._check_red_flags() and _resolve_condition()

No Qdrant or embedding calls — we test only the deterministic logic layers.

Coverage:
  _check_red_flags:
    - Plain keyword patterns fire correctly
    - "rebound tenderness" fires (not just "rebound")
    - "rebound pain" fires
    - "gas pain" does NOT match "gastroparesis" (CodeRabbit fix)
    - "gas pain" does NOT fire a red flag (it is a keyword weight, not a red flag pattern)
    - Appendicitis structural rule (lower_right + high intensity)
    - Appendicitis rule does NOT fire at low intensity
    - No flags returns (False, None)

  _resolve_condition:
    - Region signal picks correct condition
    - Keyword boosts override weak region signal
    - Pain character applies boost
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest

from app.rag.retriever import _check_red_flags, _resolve_condition
from app.schemas.pain_relief import (
    AnteriorRegion, BodyClickPoint, BodyView,
    GutCondition, PainCharacter, PainReliefRequest, PosteriorRegion,
)


def _req(description, intensity=5, region=AnteriorRegion.central, view=BodyView.anterior, pain_character=None):
    return PainReliefRequest(
        body_clicks=[BodyClickPoint(region=region, view=view)],
        description=description,
        intensity=intensity,
        pain_character=pain_character,
    )


# ── _check_red_flags ──────────────────────────────────────────────────────────

class TestCheckRedFlags:

    def test_vomiting_blood_fires(self):
        is_flag, reason = _check_red_flags(_req("I am vomiting blood all over", 8))
        assert is_flag is True
        assert reason is not None

    def test_rebound_tenderness_fires(self):
        is_flag, _ = _check_red_flags(_req("I have rebound tenderness in my abdomen", 7))
        assert is_flag is True

    def test_rebound_pain_fires(self):
        is_flag, _ = _check_red_flags(_req("there is rebound pain when I release pressure", 6))
        assert is_flag is True

    def test_bare_rebound_word_does_not_fire(self):
        """'rebound' alone (e.g. acid rebound) should not trigger a red flag."""
        is_flag, _ = _check_red_flags(_req("acid rebound after meals", 4))
        assert is_flag is False

    def test_gas_pain_fires(self):
        is_flag, _ = _check_red_flags(_req("I have terrible gas pain right now", 7))
        # "gas pain" is in _RED_FLAG_PATTERNS only if explicitly added;
        # if not a red flag pattern, this should NOT fire
        # (gas pain is a KEYWORD_WEIGHT, not a red flag)
        assert is_flag is False

    def test_gastroparesis_does_not_trigger_gas_keyword(self):
        """'gastroparesis' must not match the 'gas pain' weight token."""
        # This is a _resolve_condition test more than red flags, but confirm
        # the description doesn't accidentally fire a flag
        is_flag, _ = _check_red_flags(_req("I have gastroparesis and feel bloated", 4))
        assert is_flag is False

    def test_doubled_over_fires(self):
        is_flag, _ = _check_red_flags(_req("I am doubled over in pain", 9))
        assert is_flag is True

    def test_shoulder_tip_fires(self):
        is_flag, _ = _check_red_flags(_req("I have shoulder tip pain with stomach cramps", 6))
        assert is_flag is True

    def test_appendicitis_structural_high_intensity(self):
        req = PainReliefRequest(
            body_clicks=[BodyClickPoint(region=AnteriorRegion.lower_right, view=BodyView.anterior)],
            description="sharp pain here",
            intensity=8,
        )
        is_flag, reason = _check_red_flags(req)
        assert is_flag is True
        assert "appendicitis" in reason.lower()

    def test_appendicitis_structural_low_intensity_no_flag(self):
        req = PainReliefRequest(
            body_clicks=[BodyClickPoint(region=AnteriorRegion.lower_right, view=BodyView.anterior)],
            description="mild ache lower right",
            intensity=3,
        )
        is_flag, _ = _check_red_flags(req)
        assert is_flag is False

    def test_no_flags_returns_false_none(self):
        is_flag, reason = _check_red_flags(_req("mild bloating after lunch", 3))
        assert is_flag is False
        assert reason is None


# ── _resolve_condition ────────────────────────────────────────────────────────

class TestResolveCondition:

    def test_gas_pain_keyword_scores_gas_bloating(self):
        req = _req("I have terrible gas pain and feel bloated", 4)
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        assert condition == GutCondition.gas_bloating

    def test_gastroparesis_does_not_score_gas_bloating_via_gas_token(self):
        """'gastroparesis' must not trigger the gas_bloating keyword weight."""
        req = _req("I have gastroparesis", 4, region=AnteriorRegion.upper_center)
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        # gastroparesis text alone shouldn't push gas_bloating to the top
        # upper_center maps to acid_reflux as primary — that should win
        assert condition == GutCondition.acid_reflux

    def test_heartburn_keyword_scores_acid_reflux(self):
        req = _req("terrible heartburn after eating pizza", 5, region=AnteriorRegion.upper_center)
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        assert condition == GutCondition.acid_reflux

    def test_burning_character_boosts_acid_reflux(self):
        req = _req(
            "burning feeling in my chest and throat",
            pain_character=PainCharacter.burning,
            region=AnteriorRegion.upper_center,
        )
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        assert condition == GutCondition.acid_reflux

    def test_cramping_character_boosts_ibs(self):
        req = _req(
            "cramping abdominal pain comes and goes",
            pain_character=PainCharacter.cramping,
            region=AnteriorRegion.lower_left,
        )
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        assert condition == GutCondition.ibs_cramping

    def test_constipation_keyword_scores_constipation(self):
        req = _req("I haven't had a bowel movement in five days, very constipated", 5, region=AnteriorRegion.lower_center)
        condition = _resolve_condition(req.body_clicks, req.description, req.pain_character)
        assert condition == GutCondition.constipation
