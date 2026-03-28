"""
Unit tests for red_flag_check.semantic_red_flag_check()

Strategy: mock the Anthropic client so no real API calls are made.
We test the boolean parsing logic (the CodeRabbit fix) and the
fail-safe behaviour on API errors.

Coverage:
  - raw bool True  → is_flag True
  - raw bool False → is_flag False
  - raw str "true" → is_flag True   (case-insensitive)
  - raw str "false"→ is_flag False
  - raw str "True" → is_flag True   (mixed case)
  - unknown type   → is_flag False (safe default)
  - API exception  → returns (None, "unavailable") sentinel
  - reason is None when red_flag is false
  - reason is returned when red_flag is true
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch


def _make_api_response(red_flag, reason=None):
    """Build a mock Anthropic response object."""
    payload = {"red_flag": red_flag, "reason": reason}
    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]
    return msg


def _run(coro):
    return asyncio.run(coro)


# ── Boolean parsing ────────────────────────────────────────────────────────────

class TestBooleanParsing:

    def test_raw_bool_true(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response(True, "Sudden severe onset.")
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, reason = _run(semantic_red_flag_check("I collapsed", 9, ["abdomen"]))
        assert is_flag is True
        assert reason == "Sudden severe onset."

    def test_raw_bool_false(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response(False, None)
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, reason = _run(semantic_red_flag_check("mild bloating", 3, ["abdomen"]))
        assert is_flag is False
        assert reason is None

    def test_raw_string_true_lowercase(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response("true", "Signs of peritoneal irritation.")
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, _ = _run(semantic_red_flag_check("rigid abdomen", 8, ["abdomen"]))
        assert is_flag is True

    def test_raw_string_false_lowercase(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response("false", None)
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, _ = _run(semantic_red_flag_check("dull ache", 4, ["lower left"]))
        assert is_flag is False

    def test_raw_string_true_mixed_case(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response("True", "Referred shoulder tip pain.")
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, _ = _run(semantic_red_flag_check("shoulder tip pain", 7, ["shoulder"]))
        assert is_flag is True

    def test_unknown_type_defaults_false(self):
        """An integer or None from the API should not crash — defaults to False."""
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(
                return_value=_make_api_response(1, None)
            )
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, _ = _run(semantic_red_flag_check("pain", 5, []))
        assert is_flag is False


# ── Fail-safe on API errors ────────────────────────────────────────────────────

class TestFailSafe:

    def test_api_exception_returns_none_sentinel(self):
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(side_effect=Exception("timeout"))
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, reason = _run(semantic_red_flag_check("pain", 5, []))
        assert is_flag is None
        assert reason == "unavailable"

    def test_malformed_json_returns_none_sentinel(self):
        content_block = MagicMock()
        content_block.text = "not valid json {{{"
        msg = MagicMock()
        msg.content = [content_block]
        with patch("app.ai_llm.red_flag_check._client") as mock_client:
            mock_client.messages.create = AsyncMock(return_value=msg)
            from app.ai_llm.red_flag_check import semantic_red_flag_check
            is_flag, reason = _run(semantic_red_flag_check("pain", 5, []))
        assert is_flag is None
        assert reason == "unavailable"
