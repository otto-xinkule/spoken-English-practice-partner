"""
Deepgram ASR service (stub).

In production: wraps Deepgram WebSocket for streaming STT with
interim + final results. Stub: returns canned transcripts.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class ASRService:
    """Streaming ASR via Deepgram (stub)."""

    def __init__(self) -> None:
        self._buffer: bytearray = bytearray()
        self._interim_text: str = ""

    async def process_audio(self, audio_chunk: bytes) -> Optional[Dict]:
        """Feed raw PCM audio. Returns {"text": str, "is_final": bool} or None."""
        self._buffer.extend(audio_chunk)
        if len(self._buffer) % 8000 == 0:
            self._interim_text = "[Listening...]"
            return {"text": self._interim_text, "is_final": False}
        return None

    async def finalize(self) -> Dict:
        """Called on VAD speech_end. Returns final transcript."""
        if len(self._buffer) < 1000:
            return {"text": "", "is_final": True}
        return {
            "text": "[Mock] I've been working as a software engineer for about five years.",
            "is_final": True,
        }

    async def reset(self) -> None:
        """Clear buffers between utterances."""
        self._buffer = bytearray()
        self._interim_text = ""
