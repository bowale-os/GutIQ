import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def unique_email(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.mark.asyncio
class TestAuth:
    async def test_signup_success(self, client: AsyncClient):
        response = await client.post("/auth/signup", json={
            "name": "Test User",
            "email": unique_email("signup"),
            "password": "testpass123"
        })
        assert response.status_code == 201
        assert "access_token" in response.json()

    async def test_login_success(self, client: AsyncClient):
        email = unique_email("login")
        await client.post("/auth/signup", json={
            "name": "Login User",
            "email": email,
            "password": "testpass123"
        })

        response = await client.post("/auth/login", json={
            "email": email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

    async def test_login_fail(self, client: AsyncClient):
        response = await client.post("/auth/login", json={
            "email": unique_email("nonexistent"),
            "password": "wrongpassword"
        })
        assert response.status_code == 401
