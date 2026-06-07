"""
Conversation Orchestrator — finite state machine.

States: IDLE → LISTENING → USER_SPEAKING → THINKING → AI_SPEAKING
Barge-in: any state → LISTENING (cancels AI tasks)
"""

from __future__ import annotations

import asyncio
import logging
from enum import Enum
from typing import Awaitable, Callable, Dict, List, Optional

from models import OrchestratorState, SessionState

logger = logging.getLogger(__name__)


class OrchestratorEvent(str, Enum):
    SESSION_STARTED = "session_started"
    USER_STARTED_SPEAKING = "user_started_speaking"
    USER_STOPPED_SPEAKING = "user_stopped_speaking"
    TRANSCRIPT_READY = "transcript_ready"
    LLM_RESPONSE_READY = "llm_response_ready"
    AI_FINISHED_SPEAKING = "ai_finished_speaking"
    BARGE_IN = "barge_in"
    SESSION_ENDED = "session_ended"
    ERROR = "error"


_TRANSITIONS: Dict[OrchestratorState, List[OrchestratorState]] = {
    OrchestratorState.IDLE: [OrchestratorState.LISTENING],
    OrchestratorState.LISTENING: [OrchestratorState.USER_SPEAKING, OrchestratorState.IDLE],
    OrchestratorState.USER_SPEAKING: [OrchestratorState.THINKING, OrchestratorState.LISTENING, OrchestratorState.IDLE],
    OrchestratorState.THINKING: [OrchestratorState.AI_SPEAKING, OrchestratorState.LISTENING, OrchestratorState.IDLE],
    OrchestratorState.AI_SPEAKING: [OrchestratorState.LISTENING, OrchestratorState.IDLE],
}

_EVENT_TARGET: Dict[str, OrchestratorState] = {
    OrchestratorEvent.SESSION_STARTED: OrchestratorState.LISTENING,
    OrchestratorEvent.USER_STARTED_SPEAKING: OrchestratorState.USER_SPEAKING,
    OrchestratorEvent.USER_STOPPED_SPEAKING: OrchestratorState.THINKING,
    OrchestratorEvent.LLM_RESPONSE_READY: OrchestratorState.AI_SPEAKING,
    OrchestratorEvent.AI_FINISHED_SPEAKING: OrchestratorState.LISTENING,
    OrchestratorEvent.BARGE_IN: OrchestratorState.LISTENING,
    OrchestratorEvent.SESSION_ENDED: OrchestratorState.IDLE,
}


class Orchestrator:
    """FSM orchestrating the conversation pipeline. Supports barge-in."""

    def __init__(self) -> None:
        self.state = OrchestratorState.IDLE
        self.session = SessionState()
        self._on_state_change: Optional[Callable] = None
        self._llm_task: Optional[asyncio.Task] = None
        self._tts_task: Optional[asyncio.Task] = None

    @property
    def current_state(self) -> OrchestratorState:
        return self.state

    @property
    def is_speaking(self) -> bool:
        return self.state == OrchestratorState.AI_SPEAKING

    def on_state_change(self, cb: Callable) -> None:
        self._on_state_change = cb

    def _can_transition(self, target: OrchestratorState) -> bool:
        return target in _TRANSITIONS.get(self.state, [])

    async def _transition(self, new_state: OrchestratorState, reason: str = "") -> bool:
        if not self._can_transition(new_state):
            logger.warning(f"Blocked: {self.state.value} → {new_state.value}")
            return False
        old = self.state
        self.state = new_state
        self.session.state = new_state
        logger.info(f"State: {old.value} → {new_state.value} ({reason})")
        if self._on_state_change:
            try:
                await self._on_state_change(old, new_state, reason)
            except Exception:
                logger.exception("on_state_change failed")
        return True

    async def handle_event(self, event: OrchestratorEvent, data: Optional[Dict] = None) -> bool:
        logger.debug(f"Event {event.value} in state {self.state.value}")

        if event == OrchestratorEvent.BARGE_IN:
            return await self._handle_barge_in()

        if event == OrchestratorEvent.USER_STARTED_SPEAKING:
            if self.state != OrchestratorState.LISTENING:
                await self._handle_barge_in()
            return await self._transition(OrchestratorState.USER_SPEAKING, "user speaking")

        target = _EVENT_TARGET.get(event)
        if target is None:
            return False
        return await self._transition(target, event.value)

    async def _handle_barge_in(self) -> bool:
        logger.info("BARGE-IN: cancelling AI tasks")
        for task in [self._llm_task, self._tts_task]:
            if task and not task.done():
                task.cancel()
        self.session.barge_in_count += 1
        return await self._transition(OrchestratorState.LISTENING, "barge-in")

    def track_llm(self, task: asyncio.Task) -> None:
        self._llm_task = task

    def track_tts(self, task: asyncio.Task) -> None:
        self._tts_task = task
