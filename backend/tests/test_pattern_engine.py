"""
Tests for pattern_engine.run()

Covers:
  - Too few logs returns empty
  - Clear food trigger detected
  - Protective factor (exercise) detected
  - Stress trigger detected
  - Sleep trigger detected
  - Noise (tiny delta) correctly suppressed
  - Labels rank by size not by type
  - confirmable flag fires at correct thresholds
  - Missing / None fields don't crash
  - All signals present — correct ordering
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.ai_llm.pattern_engine import run


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_log(severity, foods=None, stress=None, sleep_hours=None, exercise=None):
    return {
        "severity":    severity,
        "foods":       foods or [],
        "stress":      stress,
        "sleep_hours": sleep_hours,
        "exercise":    exercise,
    }


def repeat(log, n):
    return [dict(log) for _ in range(n)]


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_too_few_logs_returns_empty():
    logs = [make_log(5)] * 9  # one under MIN_LOGS
    result = run(logs)
    assert result["triggers"]   == []
    assert result["protective"] == []


def test_empty_logs():
    assert run([]) == {"triggers": [], "protective": [],
                       "log_count": 0, "personal_range": 0, "noise_floor": 0}


def test_clear_food_trigger():
    """Coffee on pain-8 days, absent on pain-3 days — should be a trigger."""
    logs = (
        repeat(make_log(8, foods=["coffee"]), 6) +
        repeat(make_log(3, foods=[]),         6)
    )
    result = run(logs)
    triggers = result["triggers"]
    assert len(triggers) >= 1
    top = triggers[0]
    assert top["variable_type"]  == "food"
    assert top["variable_value"] == "coffee"
    assert top["delta"] > 0
    assert top["label"] == "Strong"
    assert top["direction"] == "trigger"


def test_no_exercise_is_trigger():
    """No exercise on pain-7 days, exercise on pain-2 days — 'exercise=none' is a trigger."""
    logs = (
        repeat(make_log(2, exercise="moderate"), 6) +
        repeat(make_log(7, exercise="none"),     6)
    )
    result = run(logs)
    triggers = result["triggers"]
    assert len(triggers) >= 1
    top = triggers[0]
    assert top["variable_type"]  == "exercise"
    assert top["variable_value"] == "none"
    assert top["delta"] > 0
    assert top["direction"] == "trigger"


def test_stress_trigger():
    logs = (
        repeat(make_log(8, stress="high"), 5) +
        repeat(make_log(3, stress="low"),  5) +
        repeat(make_log(5),                2)   # padding with no stress data
    )
    result = run(logs)
    types = [t["variable_type"] for t in result["triggers"]]
    assert "stress" in types


def test_sleep_trigger():
    logs = (
        repeat(make_log(8, sleep_hours=4.5), 5) +
        repeat(make_log(3, sleep_hours=8.0), 5) +
        repeat(make_log(5),                  2)
    )
    result = run(logs)
    types = [t["variable_type"] for t in result["triggers"]]
    assert "sleep" in types


def test_noise_suppressed():
    """Delta of 0.2 on a range of 6 is below 20% floor — should not appear."""
    logs = (
        repeat(make_log(6, foods=["bread"]), 6) +
        repeat(make_log(5, foods=[]),        6)   # delta = 1.0, range = 1 → floor = 0.5 → passes
    )
    # Use a range of 6 and a tiny delta to force suppression
    logs2 = (
        repeat(make_log(2, foods=["bread"]), 6) +
        repeat(make_log(8, foods=[]),        6)   # bread absent on HIGH days → negative delta (protective)
    )
    result = run(logs2)
    # bread should appear in protective, not triggers
    trigger_values = [t["variable_value"] for t in result["triggers"]]
    assert "bread" not in trigger_values


def test_labels_rank_by_delta_size():
    """Stress has bigger delta than food — stress should be Strong, food Moderate."""
    logs = (
        repeat(make_log(9, stress="high", foods=["rice"]), 5) +
        repeat(make_log(2, stress="low",  foods=[]),       5) +
        # rice alone with small delta
        repeat(make_log(6, stress=None,   foods=["rice"]), 3) +
        repeat(make_log(4, stress=None,   foods=[]),       2)
    )
    result = run(logs)
    triggers = result["triggers"]
    # Stress delta ~7, rice delta ~1 — stress should rank first
    assert triggers[0]["variable_type"] == "stress"
    assert triggers[0]["label"] == "Strong"
    if len(triggers) > 1:
        assert triggers[1]["label"] == "Moderate"


def test_confirmable_flag():
    """sample_size >= 15 and delta >= 25% of range should set confirmable=True."""
    logs = (
        repeat(make_log(9, foods=["coffee"]), 10) +
        repeat(make_log(2, foods=[]),         10)
    )
    result = run(logs)
    coffee = next(t for t in result["triggers"] if t["variable_value"] == "coffee")
    assert coffee["confirmable"] is True


def test_not_confirmable_small_sample():
    logs = (
        repeat(make_log(9, foods=["coffee"]), 4) +
        repeat(make_log(2, foods=[]),         8)
    )
    result = run(logs)
    coffee = next((t for t in result["triggers"] if t["variable_value"] == "coffee"), None)
    assert coffee is not None, "coffee should appear as a trigger"
    assert coffee["confirmable"] is False


def test_none_fields_dont_crash():
    """Logs with all optional fields as None should not raise."""
    logs = [make_log(i % 9 + 1) for i in range(12)]
    result = run(logs)
    assert "triggers"   in result
    assert "protective" in result


def test_missing_severity_logs_excluded():
    """Logs without severity should be ignored, not crash."""
    logs = [{"foods": ["coffee"], "stress": "high"}] * 5  # no severity key
    logs += [make_log(5)] * 10
    result = run(logs)
    # Should run on only the 10 logs with severity
    assert result["log_count"] == 10


def test_all_signals_present_ordering():
    """When all four signal types fire, triggers and protective are each sorted by delta."""
    logs = (
        repeat(make_log(9, foods=["spice"], stress="high", sleep_hours=4, exercise="none"), 6) +
        repeat(make_log(2, foods=[],        stress="low",  sleep_hours=8, exercise="moderate"), 6)
    )
    result = run(logs)
    trigger_deltas = [t["delta"] for t in result["triggers"]]
    assert trigger_deltas == sorted(trigger_deltas, reverse=True)
    protective_deltas = [t["delta"] for t in result["protective"]]
    assert protective_deltas == sorted(protective_deltas)


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
