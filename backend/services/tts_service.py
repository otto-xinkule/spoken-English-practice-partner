"""
Alibaba Cloud TTS service — speech synthesis.

Production: Alibaba Cloud NLS (Nui) TTS via WebSocket.
Fallback: yields silence frames when no credentials.
Supports immediate cancellation for barge-in.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import AsyncIterator

logger = logging.getLogger(__name__)

AK_ID = os.getenv("ALIBABA_ACCESS_KEY_ID", "")
AK_SECRET = os.getenv("ALIBABA_ACCESS_KEY_SECRET", "")
APPKEY = os.getenv("ALIBABA_NLS_APPKEY", "")
REGION = os.getenv("ALIBABA_NLS_REGION", "cn-shanghai")
NLS_URL = f"wss://nls-gateway-{REGION}.aliyuncs.com/ws/v1"
DEFAULT_VOICE = "zhitian_emo"

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
    import time
    global _nls_token_cache, _nls_token_expire
    now = time.time()
    if _nls_token_cache and now < _nls_token_expire - 60:
        return _nls_token_cache
    from nls.token import getToken
    _nls_token_cache = getToken(AK_ID, AK_SECRET, domain=REGION)
    _nls_token_expire = now + 1800
    return _nls_token_cache


class TTSService:
    """阿里云语音合成 / 静音降级"""

    def __init__(self, voice: str = DEFAULT_VOICE) -> None:
        self._abort = False
        self._voice = voice
        if _HAS_ALIBABA_NLS and _HAS_CREDENTIALS:
            logger.info(f"TTS 使用阿里云 NLS ({voice})")
        else:
            logger.warning("阿里云 NLS SDK 未安装或无 Key，使用静音 TTS")

    async def generate_speech(self, text: str) -> AsyncIterator[bytes]:
        """Stream TTS audio chunks. Supports barge-in abort."""
        self._abort = False

        if not text.strip():
            return

        if _HAS_ALIBABA_NLS and _HAS_CREDENTIALS:
            try:
                async for chunk in self._stream_alibaba(text):
                    if self._abort:
                        return
                    yield chunk
                return
            except Exception as e:
                logger.error(f"阿里云 TTS 失败，降级为静音: {e}")

        # ── 降级：静音帧 ──
        await asyncio.sleep(0.2)
        chunks = max(1, len(text) // 20)
        for _ in range(chunks):
            if self._abort:
                return
            yield b"\x00" * 640
            await asyncio.sleep(0.1)

    async def _stream_alibaba(self, text: str) -> AsyncIterator[bytes]:
        """阿里云 NLS TTS 流式输出"""
        import nls

        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        done = asyncio.Event()

        def on_audio(data, *args):
            """SDK 内部线程回调"""
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                pass

        def on_completed(message, *args):
            done.set()

        def on_error(message, *args):
            logger.warning(f"[TTS] 阿里云错误: {message}")
            done.set()

        synthesizer = nls.NlsSpeechSynthesizer(
            url=NLS_URL,
            token=_get_nls_token(),
            appkey=APPKEY,
            on_metainfo=lambda *_: None,
            on_data=on_audio,
            on_completed=on_completed,
            on_error=on_error,
            on_close=lambda *_: None,
        )

        try:
            synthesizer.start(text, voice=self._voice, sample_rate=16000)

            # 从队列中取音频数据，直到完成或打断
            while not done.is_set():
                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=0.5)
                    if self._abort:
                        break
                    yield chunk
                except asyncio.TimeoutError:
                    pass

        except Exception as e:
            logger.error(f"[TTS] 异常: {e}")
        finally:
            try:
                synthesizer.shutdown()
            except Exception:
                pass

    async def stop(self) -> None:
        """Immediately stop TTS generation (barge-in)."""
        self._abort = True
