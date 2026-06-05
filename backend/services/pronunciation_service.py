"""
Azure Pronunciation Assessment service (stub).

Production: Azure Speech SDK phoneme-level scoring.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class PronunciationService:
    """Azure Pronunciation Assessment (stub)."""

    async def evaluate(self, reference_text: str, audio_bytes: bytes) -> Optional[Dict]:
        """Evaluate pronunciation. Returns phoneme-level scores."""
        await asyncio.sleep(0.3)
        return {
            "accuracy_score": 78.5,
            "fluency_score": 82.0,
            "completeness_score": 90.0,
            "pronunciation_score": 80.2,
            "words": [
                {
                    "word": "software",
                    "accuracy": 85.0,
                    "error_type": "None",
                    "phonemes": [
                        {"phoneme": "s", "accuracy": 90.0},
                        {"phoneme": "ao", "accuracy": 78.0},
                        {"phoneme": "f", "accuracy": 88.0},
                        {"phoneme": "t", "accuracy": 85.0},
                        {"phoneme": "w", "accuracy": 92.0},
                        {"phoneme": "eh", "accuracy": 75.0},
                        {"phoneme": "r", "accuracy": 80.0},
                    ],
                },
                {
                    "word": "engineer",
                    "accuracy": 72.0,
                    "error_type": "Pronunciation",
                    "phonemes": [
                        {"phoneme": "eh", "accuracy": 80.0},
                        {"phoneme": "n", "accuracy": 85.0},
                        {"phoneme": "jh", "accuracy": 60.0},
                        {"phoneme": "ih", "accuracy": 75.0},
                        {"phoneme": "n", "accuracy": 82.0},
                        {"phoneme": "ih", "accuracy": 70.0},
                        {"phoneme": "r", "accuracy": 65.0},
                    ],
                },
            ],
        }
