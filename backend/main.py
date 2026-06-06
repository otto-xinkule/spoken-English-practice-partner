"""
AI Speaking Coach — FastAPI backend entry point.

WebSocket endpoint: /ws/speak
Protocol: JSON messages (see models/__init__.py for message types)

Quick start: python main.py  →  http://localhost:8000
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

if not os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_API_KEY") == "your_api_key_here":
    logging.warning("DEEPSEEK_API_KEY 未配置，LLM 服务将使用模拟数据")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from models import OrchestratorState, WSMsg
from orchestrator import Orchestrator, OrchestratorEvent
from services.asr_service import ASRService
from services.llm_service import LLMService
from services.tts_service import TTSService
from services.pronunciation_service import PronunciationService

# ── logging ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-speaking-coach")


# ── lifespan ─────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🎤 AI Speaking Coach starting...")
    yield
    logger.info("🎤 AI Speaking Coach shutting down...")


# ── app ──────────────────────────────────────────────────────────────

app = FastAPI(title="AI Speaking Coach", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── health ───────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-speaking-coach"}


# ── WebSocket: /ws/speak ─────────────────────────────────────────────


@app.websocket("/ws/speak")
async def speak_endpoint(ws: WebSocket):
    """
    Main WebSocket endpoint for conversational AI pipeline.

    Client → Server: audio chunks, VAD events, control
    Server → Client: ASR, LLM tokens, TTS audio, grammar, pronunciation
    """
    await ws.accept()
    logger.info("Client connected")

    orchestrator = Orchestrator()
    asr = ASRService()
    llm = LLMService()
    tts = TTSService()
    pronunciation = PronunciationService()

    session_alive = True

    # ── helper: send JSON ──────────────────────────────────────────

    async def send(msg_type: str, data: dict | None = None) -> bool:
        nonlocal session_alive
        try:
            payload = {"type": msg_type}
            if data is not None:
                payload["data"] = data
            await ws.send_json(payload)
            return True
        except Exception:
            session_alive = False
            return False

    # ── state change callback ───────────────────────────────────────

    async def on_state_change(old, new, reason):
        await send(WSMsg.STATE_CHANGE, {
            "from": old.value, "to": new.value, "reason": reason,
        })

    orchestrator.on_state_change(on_state_change)

    # ── message loop ────────────────────────────────────────────────

    try:
        while session_alive:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")
            data = msg.get("data", {})

            orchestrator.session.message_count += 1

            # ── START ─────────────────────────────────────────────
            if msg_type == WSMsg.START_SESSION:
                await orchestrator.handle_event(OrchestratorEvent.SESSION_STARTED)
                await send(WSMsg.STATE_CHANGE, {
                    "from": "IDLE", "to": "LISTENING", "reason": "started"
                })

            # ── AUDIO ─────────────────────────────────────────────
            elif msg_type == WSMsg.AUDIO:
                audio_bytes = base64.b64decode(data.get("audio", ""))
                result = await asr.process_audio(audio_bytes)
                if result:
                    await send(WSMsg.ASR_RESULT, result)

            # ── VAD EVENT ─────────────────────────────────────────
            elif msg_type == WSMsg.VAD_EVENT:
                vad_status = data.get("status", "")

                if vad_status == "speech_start":
                    await orchestrator.handle_event(
                        OrchestratorEvent.USER_STARTED_SPEAKING
                    )

                elif vad_status == "speech_end":
                    await orchestrator.handle_event(
                        OrchestratorEvent.USER_STOPPED_SPEAKING
                    )

                    # 1. Finalize ASR
                    final = await asr.finalize()
                    final_text = final.get("text", "")
                    if final_text:
                        await send(WSMsg.ASR_RESULT, final)

                    if not final_text.strip():
                        await asr.reset()
                        continue

                    # 2. Grammar check (parallel, non-blocking)
                    grammar_task = asyncio.create_task(llm.check_grammar(final_text))

                    # 3. LLM streaming
                    await orchestrator.handle_event(OrchestratorEvent.LLM_RESPONSE_READY)
                    try:
                        async for token in llm.generate_response(final_text):
                            if not session_alive:
                                break
                            await send(WSMsg.LLM_TOKEN, {"token": token})
                        await send(WSMsg.LLM_DONE, {})
                    except asyncio.CancelledError:
                        await send(WSMsg.LLM_DONE, {"cancelled": True})

                    # 4. TTS streaming
                    if llm.full_response and session_alive:
                        try:
                            async for chunk in tts.generate_speech(llm.full_response):
                                if not session_alive:
                                    break
                                await send(WSMsg.TTS_AUDIO, {
                                    "audio": base64.b64encode(chunk).decode()
                                })
                            await send(WSMsg.TTS_DONE, {})
                        except asyncio.CancelledError:
                            await send(WSMsg.TTS_DONE, {"cancelled": True})

                    # 5. Transition back to listening
                    await orchestrator.handle_event(OrchestratorEvent.AI_FINISHED_SPEAKING)

                    # 6. Collect grammar result
                    try:
                        grammar = await grammar_task
                        if grammar and grammar.get("has_error"):
                            orchestrator.session.grammar_errors.append(grammar)
                            await send(WSMsg.GRAMMAR_HINT, grammar)
                    except Exception:
                        logger.exception("Grammar check failed")

                    # 7. Pronunciation
                    try:
                        pron = await pronunciation.evaluate(final_text, bytes(asr._buffer))
                        if pron:
                            orchestrator.session.pronunciation_scores.append(pron)
                            await send(WSMsg.PRONUNCIATION_RESULT, pron)
                    except Exception:
                        logger.exception("Pronunciation failed")

                    # 8. Store transcript
                    orchestrator.session.transcript.append({
                        "user": final_text,
                        "ai": llm.full_response,
                    })

                    await asr.reset()

            # ── BARGE IN ─────────────────────────────────────────
            elif msg_type == WSMsg.BARGE_IN:
                await tts.stop()
                await llm.stop()
                await orchestrator.handle_event(OrchestratorEvent.BARGE_IN)
                await asr.reset()

            # ── END SESSION ──────────────────────────────────────
            elif msg_type == WSMsg.END_SESSION:
                await orchestrator.handle_event(OrchestratorEvent.SESSION_ENDED)
                await send(WSMsg.SESSION_SUMMARY, {
                    "session_id": orchestrator.session.session_id,
                    "message_count": orchestrator.session.message_count,
                    "barge_in_count": orchestrator.session.barge_in_count,
                    "grammar_errors": orchestrator.session.grammar_errors,
                    "pronunciation_scores": orchestrator.session.pronunciation_scores,
                    "transcript": orchestrator.session.transcript,
                })
                break

            else:
                logger.warning(f"Unknown message: {msg_type}")

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("WebSocket error")
        await send(WSMsg.ERROR, {"message": "Internal server error"})
    finally:
        session_alive = False
        if orchestrator.current_state != OrchestratorState.IDLE:
            await orchestrator.handle_event(OrchestratorEvent.SESSION_ENDED)
        logger.info("Session cleaned up")


# ── debug page ───────────────────────────────────────────────────────


@app.get("/")
async def root():
    """Simple HTML debug page for testing the WebSocket."""
    return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>AI Speaking Coach</title>
<style>
body{font-family:system-ui;max-width:600px;margin:50px auto;padding:20px;background:#111;color:#eee}
button{padding:10px 20px;margin:5px;font-size:16px;cursor:pointer;border:none;border-radius:6px;
background:#333;color:#fff}
button:hover{background:#555}
#log{background:#1a1a2e;color:#0f0;padding:15px;border-radius:8px;height:300px;
overflow-y:auto;font-family:monospace;font-size:13px;white-space:pre-wrap}
.state{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:bold;font-size:14px}
.IDLE{background:#666}.LISTENING{background:#4CAF50}.USER_SPEAKING{background:#2196F3}
.THINKING{background:#FF9800}.AI_SPEAKING{background:#9C27B0}
</style></head>
<body>
<h1>🎤 AI Speaking Coach</h1>
<p>State: <span id="state" class="state IDLE">IDLE</span></p>
<div>
<button onclick="startSession()">▶ Start Session</button>
<button onclick="simulateSpeech()">🗣 Simulate Speech</button>
<button onclick="bargeIn()">✋ Barge In</button>
<button onclick="endSession()">⏹ End Session</button>
</div>
<div id="log"></div>
<script>
const ws = new WebSocket('ws://localhost:8000/ws/speak');
const log = document.getElementById('log');
const stateEl = document.getElementById('state');
ws.onopen = () => logMsg('✅ Connected to /ws/speak');
ws.onclose = () => logMsg('❌ Disconnected');
ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state_change') {
        stateEl.textContent = msg.data.to;
        stateEl.className = 'state ' + msg.data.to;
    }
    logMsg('← ' + msg.type + (msg.data ? ' ' + JSON.stringify(msg.data).slice(0,120) : ''));
};
function send(type, data={}) { ws.send(JSON.stringify({type, data})); logMsg('→ '+type); }
function logMsg(m) { log.textContent += m + '\\n'; log.scrollTop = log.scrollHeight; }
function startSession() { send('start_session'); }
function simulateSpeech() {
    send('vad_event', {status:'speech_start'});
    setTimeout(() => send('vad_event', {status:'speech_end', text:'Tell me about yourself.'}), 500);
}
function bargeIn() { send('barge_in'); }
function endSession() { send('end_session'); }
</script></body></html>""")


# ── entry point ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
