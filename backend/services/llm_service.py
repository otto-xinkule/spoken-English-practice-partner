"""
GPT-4o LLM service (stub).

Production: async streaming via OpenAI SDK with barge-in cancellation.
Grammar check runs on GPT-4o mini in parallel, non-blocking.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, Dict, Optional

from prompts.interview_coach import SYSTEM_PROMPT, GRAMMAR_CHECK_PROMPT

logger = logging.getLogger(__name__)

_MOCK_RESPONSES = [
    "That's interesting! Could you tell me more about your experience with team leadership?",
    "Great. What would you say is your biggest technical strength?",
    "Tell me about a time you had to deal with a difficult teammate.",
    "Why do you want to leave your current position?",
]


class LLMService:
    """Streaming LLM service (GPT-4o). Supports cancellation for barge-in."""

    def __init__(self) -> None:
        self._abort = False
        self._history: list = []
        self.full_response: str = ""
        self._idx: int = 0

    async def generate_response(self, user_text: str) -> AsyncIterator[str]:
        """Stream LLM tokens. In production: OpenAI streaming chat API."""
        self._abort = False
        self.full_response = ""

        await asyncio.sleep(0.3)  # simulate LLM latency

        mock = _MOCK_RESPONSES[self._idx % len(_MOCK_RESPONSES)]
        self._idx += 1

        for word in mock.split(" "):
            if self._abort:
                logger.info("LLM aborted (barge-in)")
                return
            self.full_response += word + " "
            yield word + " "
            await asyncio.sleep(0.06)

        self._history.append({"role": "user", "content": user_text})
        self._history.append({"role": "assistant", "content": self.full_response})

    async def check_grammar(self, user_text: str) -> Optional[Dict]:
        """Parallel grammar check via GPT-4o mini. Non-blocking."""
        await asyncio.sleep(0.15)
        return None  # stub: no errors

    async def stop(self) -> None:
        """Cancel generation (barge-in)."""
        self._abort = True

    async def reset(self) -> None:
        self._abort = False
        self._history = []
        self.full_response = ""
        self._idx = 0
