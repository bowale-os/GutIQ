"""
Comprehensive auth tests — signup, login, JWT validation, edge cases.

Coverage:
  Signup:  success, duplicate email, field validation (missing/invalid/length)
  Login:   success, wrong password, unknown user, field validation
  JWT:     structure, claims (sub/exp/iat), token_type, cross-request usage
  Security: 401/403 on bad tokens, WWW-Authenticate header, user isolation
"""
import uuid
import pytest
from httpx import AsyncClient
from jose import jwt

from app.core.config import settings
from tests.conftest import unique_email


# ─── Signup ─────────────────────────────────────────────────────────────────

class TestSignup:

    async def test_returns_201(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Alice Smith",
            "email": unique_email("alice"),
            "password": "strongpass1",
        })
        assert resp.status_code == 201

    async def test_response_contains_access_token(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Bob Jones",
            "email": unique_email("bob"),
            "password": "strongpass1",
        })
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0

    async def test_token_type_is_bearer(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Carol White",
            "email": unique_email("carol"),
            "password": "strongpass1",
        })
        assert resp.json()["token_type"] == "bearer"

    async def test_token_is_valid_decodable_jwt(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Dave Black",
            "email": unique_email("dave"),
            "password": "strongpass1",
        })
        token = resp.json()["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert "sub" in payload
        assert "exp" in payload
        assert "iat" in payload

    async def test_token_sub_is_valid_uuid(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Eve Grey",
            "email": unique_email("eve"),
            "password": "strongpass1",
        })
        token = resp.json()["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        uuid.UUID(payload["sub"])  # raises ValueError if not a valid UUID

    async def test_token_exp_is_in_the_future(self, client: AsyncClient):
        import time
        resp = await client.post("/auth/signup", json={
            "name": "Frank Ray",
            "email": unique_email("frank"),
            "password": "strongpass1",
        })
        token = resp.json()["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert payload["exp"] > time.time()

    async def test_duplicate_email_returns_400(self, client: AsyncClient):
        email = unique_email("dup")
        body = {"name": "First", "email": email, "password": "strongpass1"}
        await client.post("/auth/signup", json=body)
        resp = await client.post("/auth/signup", json=body)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    async def test_duplicate_email_second_attempt_has_no_token(self, client: AsyncClient):
        email = unique_email("dup2")
        body = {"name": "First", "email": email, "password": "strongpass1"}
        await client.post("/auth/signup", json=body)
        resp = await client.post("/auth/signup", json=body)
        assert "access_token" not in resp.json()

    async def test_missing_email_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "No Email", "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_missing_password_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "No Pass", "email": unique_email("nopass")
        })
        assert resp.status_code == 422

    async def test_missing_name_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "email": unique_email("noname"), "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_invalid_email_format_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Bad Email", "email": "not-an-email", "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_email_missing_tld_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Bad TLD", "email": "user@domain", "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_password_too_short_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Short Pass", "email": unique_email("sp"), "password": "abc"
        })
        assert resp.status_code == 422

    async def test_password_exactly_8_chars_is_accepted(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Min Pass", "email": unique_email("minpass"), "password": "abcd1234"
        })
        assert resp.status_code == 201

    async def test_name_too_short_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "A", "email": unique_email("shortname"), "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_name_too_long_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "A" * 51, "email": unique_email("longname"), "password": "strongpass1"
        })
        assert resp.status_code == 422

    async def test_name_exactly_2_chars_is_accepted(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Jo", "email": unique_email("jo"), "password": "strongpass1"
        })
        assert resp.status_code == 201

    async def test_name_exactly_50_chars_is_accepted(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "A" * 50, "email": unique_email("maxname"), "password": "strongpass1"
        })
        assert resp.status_code == 201

    async def test_empty_body_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={})
        assert resp.status_code == 422

    async def test_two_users_get_different_subs(self, client: AsyncClient):
        r1 = await client.post("/auth/signup", json={
            "name": "User One", "email": unique_email("u1"), "password": "strongpass1"
        })
        r2 = await client.post("/auth/signup", json={
            "name": "User Two", "email": unique_email("u2"), "password": "strongpass1"
        })
        p1 = jwt.decode(r1.json()["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        p2 = jwt.decode(r2.json()["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert p1["sub"] != p2["sub"]


# ─── Login ───────────────────────────────────────────────────────────────────

class TestLogin:

    async def test_returns_200(self, client: AsyncClient):
        email = unique_email("loginok")
        await client.post("/auth/signup", json={"name": "Login User", "email": email, "password": "strongpass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        assert resp.status_code == 200

    async def test_response_contains_access_token(self, client: AsyncClient):
        email = unique_email("logintoken")
        await client.post("/auth/signup", json={"name": "Token User", "email": email, "password": "strongpass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)

    async def test_token_type_is_bearer(self, client: AsyncClient):
        email = unique_email("bearerlogin")
        await client.post("/auth/signup", json={"name": "Bearer User", "email": email, "password": "strongpass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        assert resp.json()["token_type"] == "bearer"

    async def test_token_is_valid_jwt(self, client: AsyncClient):
        email = unique_email("jwtlogin")
        await client.post("/auth/signup", json={"name": "JWT User", "email": email, "password": "strongpass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        token = resp.json()["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert "sub" in payload

    async def test_signup_and_login_tokens_share_same_sub(self, client: AsyncClient):
        email = unique_email("samesub")
        r_signup = await client.post("/auth/signup", json={"name": "Same Sub", "email": email, "password": "strongpass1"})
        r_login = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        p_signup = jwt.decode(r_signup.json()["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        p_login = jwt.decode(r_login.json()["access_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert p_signup["sub"] == p_login["sub"]

    async def test_wrong_password_returns_401(self, client: AsyncClient):
        email = unique_email("wrongpw")
        await client.post("/auth/signup", json={"name": "Wrong PW", "email": email, "password": "strongpass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "totallyWrong99"})
        assert resp.status_code == 401

    async def test_nonexistent_user_returns_401(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={
            "email": unique_email("ghost"), "password": "strongpass1"
        })
        assert resp.status_code == 401

    async def test_401_includes_www_authenticate_header(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={
            "email": unique_email("noauth"), "password": "wrongpass"
        })
        assert resp.status_code == 401
        assert "WWW-Authenticate" in resp.headers

    async def test_missing_email_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"password": "strongpass1"})
        assert resp.status_code == 422

    async def test_missing_password_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"email": "user@example.com"})
        assert resp.status_code == 422

    async def test_invalid_email_format_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"email": "bademail", "password": "strongpass1"})
        assert resp.status_code == 422

    async def test_empty_body_returns_422(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={})
        assert resp.status_code == 422

    async def test_case_sensitive_password(self, client: AsyncClient):
        email = unique_email("casepw")
        await client.post("/auth/signup", json={"name": "Case User", "email": email, "password": "StrongPass1"})
        resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        assert resp.status_code == 401

    async def test_sequential_logins_both_succeed(self, client: AsyncClient):
        email = unique_email("twologin")
        await client.post("/auth/signup", json={"name": "Multi Login", "email": email, "password": "strongpass1"})
        r1 = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        r2 = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        assert r1.status_code == 200
        assert r2.status_code == 200


# ─── Token usage on protected routes ─────────────────────────────────────────

class TestTokenUsage:

    async def test_signup_token_grants_access_to_protected_route(self, client: AsyncClient):
        resp = await client.post("/auth/signup", json={
            "name": "Protected User", "email": unique_email("prot"), "password": "strongpass1"
        })
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        status_resp = await client.get("/onboarding/status", headers=headers)
        assert status_resp.status_code == 200

    async def test_login_token_grants_access_to_protected_route(self, client: AsyncClient):
        email = unique_email("loginprot")
        await client.post("/auth/signup", json={"name": "Login Prot", "email": email, "password": "strongpass1"})
        login_resp = await client.post("/auth/login", json={"email": email, "password": "strongpass1"})
        token = login_resp.json()["access_token"]
        status_resp = await client.get("/onboarding/status", headers={"Authorization": f"Bearer {token}"})
        assert status_resp.status_code == 200

    async def test_no_token_on_protected_route_returns_403(self, client: AsyncClient):
        resp = await client.get("/onboarding/status")
        assert resp.status_code == 403

    async def test_garbage_token_on_protected_route_returns_401(self, client: AsyncClient):
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": "Bearer garbage.token.value"}
        )
        assert resp.status_code == 401

    async def test_wrong_scheme_on_protected_route_returns_403(self, client: AsyncClient):
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": "Basic dXNlcjpwYXNz"}
        )
        assert resp.status_code == 403

    async def test_expired_token_is_rejected(self, client: AsyncClient):
        from datetime import timedelta
        from app.core.security import create_access_token
        expired_token = create_access_token("fake-user-id", expires_delta=timedelta(seconds=-1))
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert resp.status_code == 401

    async def test_token_with_nonexistent_user_id_is_rejected(self, client: AsyncClient):
        from datetime import timedelta
        from app.core.security import create_access_token
        fake_id = str(uuid.uuid4())
        token = create_access_token(fake_id, expires_delta=timedelta(hours=1))
        resp = await client.get(
            "/onboarding/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 401
