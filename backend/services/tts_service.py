"""
ElevenLabs TTS service (stub).

Production: streams MP3 chunks via ElevenLabs WebSocket API.
Supports immediate cancellation for barge-in.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class TTSService:
    """Streaming TTS via ElevenLabs. Cancellable for barge-in."""

    def __init__(self) -> None:
        self._abort = False

    async def generate_speech(self, text: str) -> AsyncIterator[bytes]:
        """Stream TTS audio chunks. Stub yields silence frames."""
        self._abort = False
        await asyncio.sleep(0.2)

        chunks = max(1, len(text) // 20)
        for _ in range(chunks):
            if self._abort:
                logger.info("TTS aborted (barge-in)")
                return
            yield b"\x00" * 640
            await asyncio.sleep(0.1)

    async def stop(self) -> None:
        """Immediately stop TTS generation."""
        self._abort = True
