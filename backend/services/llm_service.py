"""
大语言模型服务 — 通过 OpenAI 兼容 SDK 接入 DeepSeek API

支持流式对话生成和非流式语法检查（JSON 模式）
未配置 DEEPSEEK_API_KEY 时自动降级为模拟数据
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncIterator, Dict, Optional

from openai import AsyncOpenAI

from prompts.interview_coach import SYSTEM_PROMPT, GRAMMAR_CHECK_PROMPT

logger = logging.getLogger(__name__)

_MOCK_RESPONSES = [
    "That's interesting! Could you tell me more about your experience with team leadership?",
    "Great. What would you say is your biggest technical strength?",
    "Tell me about a time you had to deal with a difficult teammate.",
    "Why do you want to leave your current position?",
]


class LLMService:
    """流式大模型服务，默认接入 DeepSeek，未配置密钥时使用模拟数据"""

    def __init__(self) -> None:
        self._abort = False
        self._history: list = []
        self.full_response: str = ""
        self._idx: int = 0

        api_key = os.getenv("DEEPSEEK_API_KEY", "")
        base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self._model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

        if api_key and api_key != "your_api_key_here":
            self._client: Optional[AsyncOpenAI] = AsyncOpenAI(
                api_key=api_key, base_url=base_url
            )
            self._use_mock = False
            logger.info(f"LLM 服务已连接 DeepSeek ({self._model})")
        else:
            self._client = None
            self._use_mock = True
            logger.warning("DEEPSEEK_API_KEY 未设置 — 使用模拟数据")

    # ── 流式对话 ──────────────────────────────────────────────────────

    async def generate_response(self, user_text: str) -> AsyncIterator[str]:
        """流式输出 LLM token"""
        self._abort = False
        self.full_response = ""

        if self._use_mock or self._client is None:
            async for token in self._mock_generate():
                yield token
            return

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(self._history[-10:])
        messages.append({"role": "user", "content": user_text})

        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=200,
            )
            async for chunk in stream:
                if self._abort:
                    logger.info("LLM 已中止（用户打断）")
                    try:
                        await stream.response.aclose()
                    except Exception:
                        pass
                    return
                delta = chunk.choices[0].delta
                if delta.content:
                    self.full_response += delta.content
                    yield delta.content

            self._history.append({"role": "user", "content": user_text})
            if self.full_response:
                self._history.append(
                    {"role": "assistant", "content": self.full_response}
                )
        except Exception as e:
            logger.error(f"LLM API 调用失败: {e}")
            if not self.full_response:
                async for token in self._mock_generate():
                    yield token

    async def _mock_generate(self) -> AsyncIterator[str]:
        """API 不可用时的模拟回复"""
        await asyncio.sleep(0.3)
        mock = _MOCK_RESPONSES[self._idx % len(_MOCK_RESPONSES)]
        self._idx += 1
        for word in mock.split(" "):
            if self._abort:
                logger.info("模拟 LLM 已中止")
                return
            self.full_response += word + " "
            yield word + " "
            await asyncio.sleep(0.06)

    # ── 语法检查 ──────────────────────────────────────────────────────

    async def check_grammar(self, user_text: str) -> Optional[Dict]:
        """DeepSeek JSON 模式语法检查"""
        if self._use_mock or self._client is None:
            await asyncio.sleep(0.15)
            return None

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "system",
                        "content": GRAMMAR_CHECK_PROMPT.format(user_text=user_text),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=300,
            )
            content = response.choices[0].message.content
            if not content:
                return None
            return self._parse_grammar_json(content)
        except Exception as e:
            logger.error(f"语法检查失败: {e}")
            return None

    @staticmethod
    def _parse_grammar_json(raw: str) -> Optional[Dict]:
        """解析语法检查 JSON，剥离 markdown 代码块"""
        text = raw.strip()
        for fence in ("```json", "```"):
            if text.startswith(fence):
                text = text[len(fence):].strip()
                if text.endswith("```"):
                    text = text[:-3].strip()
                break
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"语法检查返回非 JSON 格式: {raw[:80]}")
            # 尝试提取第一个 JSON 对象
            start = text.find("{")
            if start != -1:
                try:
                    return json.loads(text[start:])
                except json.JSONDecodeError:
                    pass
            return None

    # ── 生命周期 ──────────────────────────────────────────────────────

    async def stop(self) -> None:
        """取消生成（用户打断）"""
        self._abort = True

    async def reset(self) -> None:
        """重置对话历史和状态"""
        self._abort = False
        self._history = []
        self.full_response = ""
        self._idx = 0
