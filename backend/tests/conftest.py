import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Load .env for local dev; in CI these come from environment variables
load_dotenv(Path(__file__).parent.parent / ".env")

# Defaults so tests run without a full .env (CI supplies real values via secrets)
os.environ.setdefault("JWT_SECRET", "test-secret-key-not-for-production")
os.environ.setdefault("JWT_ALGORITHM", "HS256")

if not os.environ.get("DATABASE_URL"):
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env for local dev "
        "or as a GitHub Secret for CI."
    )

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


def unique_email(prefix: str = "user") -> str:
    """Generate a collision-free email address for each test run."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def registered_user(client: AsyncClient):
    """Sign up a fresh user and return {email, password, token}."""
    email = unique_email("fixture")
    password = "securepass123"
    resp = await client.post("/auth/signup", json={
        "name": "Fixture User",
        "email": email,
        "password": password,
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"email": email, "password": password, "token": token}


@pytest.fixture
def auth_headers(registered_user: dict) -> dict:
    return {"Authorization": f"Bearer {registered_user['token']}"}
