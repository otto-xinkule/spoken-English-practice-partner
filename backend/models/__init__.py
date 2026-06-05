"""
WebSocket message protocol and session state models.

All communication between frontend and backend uses JSON messages
with a { "type": "...", "data": {...} } envelope.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# State machine states
# ---------------------------------------------------------------------------

class OrchestratorState(str, Enum):
    """States the conversation orchestrator can be in."""

    IDLE = "IDLE"
    LISTENING = "LISTENING"
    USER_SPEAKING = "USER_SPEAKING"
    THINKING = "THINKING"
    AI_SPEAKING = "AI_SPEAKING"


# ---------------------------------------------------------------------------
# WebSocket message type constants
# ---------------------------------------------------------------------------

class WSMsg:
    """String constants for the ``type`` field in WS JSON messages."""

    # Client → Server
    START_SESSION = "start_session"
    END_SESSION = "end_session"
    AUDIO = "audio"
    VAD_EVENT = "vad_event"
    BARGE_IN = "barge_in"

    # Server → Client
    ASR_RESULT = "asr_result"
    LLM_TOKEN = "llm_token"
    LLM_DONE = "llm_done"
    TTS_AUDIO = "tts_audio"
    TTS_DONE = "tts_done"
    PRONUNCIATION_RESULT = "pronunciation_result"
    GRAMMAR_HINT = "grammar_hint"
    STATE_CHANGE = "state_change"
    ERROR = "error"
    SESSION_SUMMARY = "session_summary"


# ---------------------------------------------------------------------------
# Session state (server-side, in-memory)
# ---------------------------------------------------------------------------

@dataclass
class SessionState:
    """Per-session mutable state held by the orchestrator."""

    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    state: OrchestratorState = OrchestratorState.IDLE

    # Accumulated data for session summary
    transcript: List[Dict[str, Any]] = field(default_factory=list)
    grammar_errors: List[Dict[str, Any]] = field(default_factory=list)
    pronunciation_scores: List[Dict[str, Any]] = field(default_factory=list)

    # Metrics
    message_count: int = 0
    barge_in_count: int = 0
    total_user_speech_ms: int = 0
