"""
Alibaba Cloud ASR service — real-time speech recognition.

Production: Alibaba Cloud NLS (Nui) streaming ASR via WebSocket.
Fallback: returns mock transcripts when no credentials.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict, Optional

logger = logging.getLogger(__name__)

AK_ID = os.getenv("ALIBABA_ACCESS_KEY_ID", "")
AK_SECRET = os.getenv("ALIBABA_ACCESS_KEY_SECRET", "")
APPKEY = os.getenv("ALIBABA_NLS_APPKEY", "")
REGION = os.getenv("ALIBABA_NLS_REGION", "cn-shanghai")
NLS_URL = f"wss://nls-gateway-{REGION}.aliyuncs.com/ws/v1"

_HAS_ALIBABA_NLS = False
try:
    import nls
    _HAS_ALIBABA_NLS = True
except ImportError:
    pass

_HAS_CREDENTIALS = bool(AK_ID and AK_ID != "your_key_here" and AK_SECRET)

# ── Token 缓存 ─────────────────────────────────────────────────────
_nls_token_cache: str = ""
_nls_token_expire: float = 0


def _get_nls_token() -> str:
    """获取阿里云 NLS Token（带缓存，过期自动刷新）"""
    import time
    global _nls_token_cache, _nls_token_expire
    now = time.time()
    if _nls_token_cache and now < _nls_token_expire - 60:
        return _nls_token_cache
    from nls.token import getToken
    _nls_token_cache = getToken(AK_ID, AK_SECRET, domain=REGION)
    _nls_token_expire = now + 1800
    return _nls_token_cache


class ASRService:
    """阿里云实时语音识别 / mock 降级"""

    def __init__(self) -> None:
        self._buffer: bytearray = bytearray()
        # 用于回调 → async 桥接
        self._result_event: asyncio.Event = asyncio.Event()
        self._result_text: str = ""

    async def process_audio(self, audio_chunk: bytes) -> Optional[Dict]:
        """Feed raw PCM audio."""
        self._buffer.extend(audio_chunk)
        return None

    async def finalize(self) -> Dict:
        """Stop and get final transcript."""
        if len(self._buffer) < 1600:
            return {"text": "", "is_final": True}

        if _HAS_ALIBABA_NLS and _HAS_CREDENTIALS:
            return await self._finalize_alibaba()

        return await self._finalize_mock()

    async def _finalize_alibaba(self) -> Dict:
        """阿里云 NLS 实时识别"""
        import nls

        self._result_text = ""
        self._result_event.clear()
        audio_data = bytes(self._buffer)

        def on_result(message, *args):
            """NLS 识别结果回调（SDK 内部线程调用）"""
            try:
                raw = str(message)
                import json
                data = json.loads(raw)
                text = data.get("payload", {}).get("result", "")
                if text:
                    self._result_text = text
            except Exception:
                pass

        def on_completed(message, *args):
            self._result_event.set()

        def on_error(message, *args):
            logger.warning(f"[ASR] 阿里云错误: {message}")
            self._result_event.set()

        sr = nls.NlsSpeechRecognizer(
            url=NLS_URL,
            token=_get_nls_token(),
            appkey=APPKEY,
            on_start=lambda *_: None,
            on_result_changed=on_result,
            on_completed=on_completed,
            on_error=on_error,
            on_close=lambda *_: None,
        )

        try:
            sr.start(aformat="pcm", sample_rate=16000)
            sr.send_audio(audio_data)
            sr.stop()

            await asyncio.wait_for(self._result_event.wait(), timeout=5)
        except asyncio.TimeoutError:
            logger.warning("[ASR] NLS 识别超时")
        except Exception as e:
            logger.error(f"[ASR] NLS 异常: {e}")
        finally:
            try:
                sr.shutdown()
            except Exception:
                pass

        if self._result_text:
            logger.info(f"[ASR] {self._result_text}")
            return {"text": self._result_text, "is_final": True}
        else:
            return await self._finalize_mock()

    async def _finalize_mock(self) -> Dict:
        """降级 mock transcript — 轮播面试对话句"""
        await asyncio.sleep(0.1)
        mock_phrases = [
            "Hello, I'm here for the job interview. Thank you for having me.",
            "I've been working as a software engineer for about five years, mostly on backend systems.",
            "My greatest achievement was leading a team that rebuilt our core platform from scratch.",
            "I think my biggest strength is problem solving. I enjoy breaking down complex issues into manageable pieces.",
            "In five years, I hope to be in a senior technical role, maybe mentoring junior developers.",
            "Yes, I do have a question. What does the day-to-day work look like on your engineering team?",
        ]
        idx = getattr(self, "_mock_idx", 0)
        setattr(self, "_mock_idx", (idx + 1) % len(mock_phrases))
        text = mock_phrases[idx]
        return {"text": text, "is_final": True}

    async def reset(self) -> None:
        """Clear buffers between utterances."""
        self._buffer = bytearray()
        self._result_text = ""
