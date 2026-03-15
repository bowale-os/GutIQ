from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as a naive datetime (tzinfo stripped for DB compatibility)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
