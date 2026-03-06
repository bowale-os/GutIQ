# tests/conftest.py
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env for local dev; in CI these come from GitHub Secrets
load_dotenv(Path(__file__).parent.parent / ".env")

if not os.environ.get("DATABASE_URL"):
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env for local dev "
        "or as a GitHub Secret for CI."
    )

os.environ.setdefault("JWT_SECRET", "test-secret-key-not-for-production")
