"""
Pattern Engine — detects what makes a user's bad days bad and good days good.

For each signal (food, stress, sleep, exercise): compute average pain on days
where the signal is present vs absent. Filter noise relative to the user's own
pain range. Rank by delta size — labels mean rank within this person's data,
not clearance of a population benchmark.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

MIN_LOGS               = 10
MIN_GROUP_SIZE         = 2
NOISE_FLOOR_FRACTION   = 0.20
NOISE_FLOOR_MINIMUM    = 0.5
CONFIRM_MIN_SAMPLE     = 15
CONFIRM_MIN_DELTA_FRAC = 0.25


def _mean(logs: list[dict]) -> float:
    return sum(l["severity"] for l in logs) / len(logs)


def _label(rank: int) -> str:
    return ["Strong", "Moderate", "Notable", "Notable"][min(rank, 3)]


def _readable(variable_type: str, variable_value: str, direction: str) -> str:
    hi = direction == "trigger"
    if variable_type == "food":
        return f"{variable_value.title()} tends to appear on your {'highest' if hi else 'lowest'} pain days"
    if variable_type == "stress":
        return f"{'High' if hi else 'Low'} stress days tend to be your {'highest' if hi else 'lowest'} pain days"
    if variable_type == "sleep":
        return ("Poor sleep (under 6h) tends to coincide with your highest pain days" if hi
                else "Good sleep (7h or more) tends to coincide with your lowest pain days")
    if variable_type == "exercise":
        return ("Days without exercise tend to be your highest pain days" if hi
                else "Days with exercise tend to be your lowest pain days")
    return f"{variable_value} correlates with {'higher' if hi else 'lower'} pain"


def _signal(
    with_group: list[dict],
    without_group: list[dict],
    variable_type: str,
    variable_value: str,
    floor: float,
) -> dict | None:
    """Core computation shared by all signal types. Returns candidate or None."""
    if len(with_group) < MIN_GROUP_SIZE or len(without_group) < MIN_GROUP_SIZE:
        return None
    delta = _mean(with_group) - _mean(without_group)
    if abs(delta) < floor:
        return None
    return {
        "variable_type":  variable_type,
        "variable_value": variable_value,
        "delta":          round(delta, 2),
        "avg_with":       round(_mean(with_group), 2),
        "avg_without":    round(_mean(without_group), 2),
        "sample_size":    len(with_group) + len(without_group),
    }


def run(logs: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Args:
        logs: list of dicts with keys:
            severity    (int)
            foods       (list[str])
            stress      (str | None)  "low" | "medium" | "high"
            sleep_hours (float | None)
            exercise    (str | None)  "none" | "light" | "moderate" | "intense"

    Returns:
        { triggers, protective, log_count, personal_range, noise_floor }
    """
    with_sev = [l for l in logs if l.get("severity") is not None]

    if len(with_sev) < MIN_LOGS:
        return {"triggers": [], "protective": [], "log_count": len(logs),
                "personal_range": 0, "noise_floor": 0}

    severities     = [l["severity"] for l in with_sev]
    personal_range = max(severities) - min(severities)
    floor          = max(personal_range * NOISE_FLOOR_FRACTION, NOISE_FLOOR_MINIMUM)
    confirm_floor  = max(personal_range * CONFIRM_MIN_DELTA_FRAC, NOISE_FLOOR_MINIMUM)

    candidates: list[dict] = []

    # Food — one candidate per unique food item
    all_foods = list({f for l in with_sev for f in (l.get("foods") or [])})
    for food in all_foods:
        c = _signal(
            [l for l in with_sev if food in (l.get("foods") or [])],
            [l for l in with_sev if food not in (l.get("foods") or [])],
            "food", food, floor,
        )
        if c:
            candidates.append(c)

    # Stress
    c = _signal(
        [l for l in with_sev if l.get("stress") == "high"],
        [l for l in with_sev if l.get("stress") == "low"],
        "stress", "high", floor,
    )
    if c:
        candidates.append(c)

    # Sleep
    c = _signal(
        [l for l in with_sev if (l.get("sleep_hours") or 99) < 6],
        [l for l in with_sev if (l.get("sleep_hours") or 0) >= 7],
        "sleep", "sleep_lt_6", floor,
    )
    if c:
        candidates.append(c)

    # Exercise
    c = _signal(
        [l for l in with_sev if l.get("exercise") == "none"],
        [l for l in with_sev if l.get("exercise") in ("light", "moderate", "intense")],
        "exercise", "none", floor,
    )
    if c:
        candidates.append(c)

    # Split by direction, rank by absolute delta, assign labels
    triggers   = sorted([c for c in candidates if c["delta"] > 0], key=lambda x: -x["delta"])
    protective = sorted([c for c in candidates if c["delta"] < 0], key=lambda x:  x["delta"])

    def enrich(signals: list[dict], direction: str) -> list[dict]:
        return [
            {**s, "direction": direction, "label": _label(i),
             "text": _readable(s["variable_type"], s["variable_value"], direction),
             "confirmable": s["sample_size"] >= CONFIRM_MIN_SAMPLE and abs(s["delta"]) >= confirm_floor}
            for i, s in enumerate(signals)
        ]

    return {
        "triggers":       enrich(triggers,   "trigger"),
        "protective":     enrich(protective, "protective"),
        "log_count":      len(with_sev),
        "personal_range": round(personal_range, 2),
        "noise_floor":    round(floor, 2),
    }
