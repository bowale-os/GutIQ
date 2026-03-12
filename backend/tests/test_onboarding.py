"""
Comprehensive onboarding tests — status checks, complete flow, validation, isolation.

Coverage:
  GET /onboarding/status:  auth required, fresh user incomplete, correct missing fields,
                           complete after onboarding, response shape
  POST /onboarding/complete: success, all valid enum values, invalid enums, goal length,
                             missing fields, empty body, re-onboarding, user isolation
"""
import uuid
import pytest
from httpx import AsyncClient

from tests.conftest import unique_email


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def signup_and_get_headers(client: AsyncClient, name: str = "Onboard User") -> dict:
    """Sign up a fresh user and return Bearer auth headers."""
    resp = await client.post("/auth/signup", json={
        "name": name,
        "email": unique_email("onboard"),
        "password": "strongpass1",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


VALID_PAYLOAD = {
    "digestive_condition": "GERD",
    "goal": "Identify my food triggers",
    "age_range": "30-40",
}


# ─── GET /onboarding/status ───────────────────────────────────────────────────

class TestOnboardingStatus:

    async def test_requires_auth_returns_403(self, client: AsyncClient):
        resp = await client.get("/onboarding/status")
        assert resp.status_code == 403

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": "Bearer not.a.real.token"}
        )
        assert resp.status_code == 401

    async def test_wrong_scheme_returns_403(self, client: AsyncClient):
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": "Basic dXNlcjpwYXNz"}
        )
        assert resp.status_code == 403

    async def test_fresh_user_returns_200(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.get("/onboarding/status", headers=headers)
        assert resp.status_code == 200

    async def test_fresh_user_is_not_complete(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.get("/onboarding/status", headers=headers)
        assert resp.json()["is_complete"] is False

    async def test_fresh_user_all_three_fields_missing(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        missing = (await client.get("/onboarding/status", headers=headers)).json()["missing"]
        assert missing["digestive_condition"] is True
        assert missing["goal"] is True
        assert missing["age_range"] is True

    async def test_response_has_is_complete_and_missing_keys(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        data = (await client.get("/onboarding/status", headers=headers)).json()
        assert "is_complete" in data
        assert "missing" in data

    async def test_missing_dict_has_all_three_keys(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        missing = (await client.get("/onboarding/status", headers=headers)).json()["missing"]
        assert "digestive_condition" in missing
        assert "goal" in missing
        assert "age_range" in missing

    async def test_is_complete_after_onboarding(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        resp = await client.get("/onboarding/status", headers=headers)
        assert resp.json()["is_complete"] is True

    async def test_missing_fields_all_false_after_onboarding(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        missing = (await client.get("/onboarding/status", headers=headers)).json()["missing"]
        assert missing["digestive_condition"] is False
        assert missing["goal"] is False
        assert missing["age_range"] is False


# ─── POST /onboarding/complete ────────────────────────────────────────────────

class TestOnboardingComplete:

    async def test_success_returns_200(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        assert resp.status_code == 200

    async def test_response_contains_message(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        assert "message" in resp.json()
        assert isinstance(resp.json()["message"], str)

    async def test_response_contains_user_id(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        assert "user_id" in resp.json()

    async def test_user_id_is_valid_uuid(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        uuid.UUID(resp.json()["user_id"])  # raises if not valid UUID

    async def test_requires_auth_returns_403(self, client: AsyncClient):
        resp = await client.post("/onboarding/complete", json=VALID_PAYLOAD)
        assert resp.status_code == 403

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        resp = await client.post(
            "/onboarding/complete",
            json=VALID_PAYLOAD,
            headers={"Authorization": "Bearer bad.token.here"}
        )
        assert resp.status_code == 401

    # ── digestive_condition enum ─────────────────────────────────────────────

    @pytest.mark.parametrize("condition", ["GERD", "IBS", "Ulcer", "Other"])
    async def test_accepts_all_valid_conditions(self, client: AsyncClient, condition: str):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "digestive_condition": condition
        }, headers=headers)
        assert resp.status_code == 200

    async def test_rejects_unknown_condition(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "digestive_condition": "Crohns"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_rejects_lowercase_condition(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "digestive_condition": "gerd"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_rejects_empty_string_condition(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "digestive_condition": ""
        }, headers=headers)
        assert resp.status_code == 422

    # ── age_range enum ───────────────────────────────────────────────────────

    @pytest.mark.parametrize("age_range", ["Under 20", "20-30", "30-40", "40-50", "50+"])
    async def test_accepts_all_valid_age_ranges(self, client: AsyncClient, age_range: str):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "age_range": age_range
        }, headers=headers)
        assert resp.status_code == 200

    async def test_rejects_unknown_age_range(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "age_range": "18-25"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_rejects_numeric_age_range(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "age_range": 30
        }, headers=headers)
        assert resp.status_code == 422

    async def test_rejects_empty_string_age_range(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "age_range": ""
        }, headers=headers)
        assert resp.status_code == 422

    # ── goal validation ──────────────────────────────────────────────────────

    async def test_accepts_short_goal(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "goal": "Track symptoms"
        }, headers=headers)
        assert resp.status_code == 200

    async def test_accepts_goal_at_max_150_chars(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "goal": "A" * 150
        }, headers=headers)
        assert resp.status_code == 200

    async def test_rejects_goal_over_150_chars(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "goal": "A" * 151
        }, headers=headers)
        assert resp.status_code == 422

    async def test_rejects_goal_at_200_chars(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            **VALID_PAYLOAD, "goal": "A" * 200
        }, headers=headers)
        assert resp.status_code == 422

    # ── missing / empty payloads ─────────────────────────────────────────────

    async def test_missing_condition_returns_422(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            "goal": "Track symptoms", "age_range": "30-40"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_missing_goal_returns_422(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            "digestive_condition": "GERD", "age_range": "30-40"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_missing_age_range_returns_422(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={
            "digestive_condition": "GERD", "goal": "Track symptoms"
        }, headers=headers)
        assert resp.status_code == 422

    async def test_empty_body_returns_422(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        resp = await client.post("/onboarding/complete", json={}, headers=headers)
        assert resp.status_code == 422

    # ── re-onboarding ────────────────────────────────────────────────────────

    async def test_re_onboarding_returns_200(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        second = {"digestive_condition": "IBS", "goal": "Monitor stress", "age_range": "40-50"}
        resp = await client.post("/onboarding/complete", json=second, headers=headers)
        assert resp.status_code == 200

    async def test_re_onboarding_still_shows_complete(self, client: AsyncClient):
        headers = await signup_and_get_headers(client)
        await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        second = {"digestive_condition": "IBS", "goal": "Monitor stress", "age_range": "40-50"}
        await client.post("/onboarding/complete", json=second, headers=headers)
        status = (await client.get("/onboarding/status", headers=headers)).json()
        assert status["is_complete"] is True

    # ── user isolation ───────────────────────────────────────────────────────

    async def test_completing_onboarding_does_not_affect_other_user(self, client: AsyncClient):
        headers_a = await signup_and_get_headers(client, "User A")
        headers_b = await signup_and_get_headers(client, "User B")
        await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers_a)
        status_b = (await client.get("/onboarding/status", headers=headers_b)).json()
        assert status_b["is_complete"] is False

    async def test_two_users_can_onboard_independently(self, client: AsyncClient):
        headers_a = await signup_and_get_headers(client, "User A2")
        headers_b = await signup_and_get_headers(client, "User B2")
        payload_a = {**VALID_PAYLOAD, "digestive_condition": "GERD"}
        payload_b = {**VALID_PAYLOAD, "digestive_condition": "IBS"}
        r_a = await client.post("/onboarding/complete", json=payload_a, headers=headers_a)
        r_b = await client.post("/onboarding/complete", json=payload_b, headers=headers_b)
        assert r_a.status_code == 200
        assert r_b.status_code == 200
        # Both report complete with no cross-contamination
        assert (await client.get("/onboarding/status", headers=headers_a)).json()["is_complete"] is True
        assert (await client.get("/onboarding/status", headers=headers_b)).json()["is_complete"] is True

    async def test_user_id_in_response_matches_token_sub(self, client: AsyncClient):
        resp_signup = await client.post("/auth/signup", json={
            "name": "Sub Match", "email": unique_email("submatch"), "password": "strongpass1"
        })
        from jose import jwt as jose_jwt
        from app.core.config import settings
        token = resp_signup.json()["access_token"]
        payload = jose_jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        headers = {"Authorization": f"Bearer {token}"}
        resp_onboard = await client.post("/onboarding/complete", json=VALID_PAYLOAD, headers=headers)
        assert resp_onboard.json()["user_id"] == payload["sub"]
