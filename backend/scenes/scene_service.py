"""
场景配置加载器

从 scenes/ 目录加载 JSON 场景配置文件。
每个场景定义了独立的系统提示词、开场问候语、关键词和评估参数。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_SCENES_DIR = Path(__file__).parent


@dataclass
class SceneConfig:
    """单个场景配置"""
    id: str
    name: str
    name_zh: str
    icon: str
    system_prompt: str
    greeting: str
    keywords: List[str] = field(default_factory=list)
    evaluation_bias: str = "neutral"
    difficulty: str = "intermediate"


class SceneService:
    """场景配置加载与管理"""

    def __init__(self) -> None:
        self._scenes: Dict[str, SceneConfig] = {}
        self._load_all()

    def _load_all(self) -> None:
        for path in sorted(_SCENES_DIR.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                config = SceneConfig(**data)
                self._scenes[config.id] = config
                logger.info(f"已加载场景: {config.id} ({config.name})")
            except Exception as e:
                logger.error(f"加载场景失败 {path.name}: {e}")

    def get(self, scene_id: str) -> Optional[SceneConfig]:
        """获取指定场景配置"""
        return self._scenes.get(scene_id)

    def get_default(self) -> Optional[SceneConfig]:
        """返回第一个场景作为默认值"""
        if not self._scenes:
            return None
        first_key = next(iter(self._scenes))
        return self._scenes[first_key]

    def list_scenes(self) -> List[SceneConfig]:
        """列出所有可用场景"""
        return [self._scenes[k] for k in sorted(self._scenes)]

    def to_client_payload(self) -> List[dict]:
        """返回前端用的轻量场景列表（不含提示词）"""
        return [
            {
                "id": s.id,
                "name": s.name,
                "name_zh": s.name_zh,
                "icon": s.icon,
                "difficulty": s.difficulty,
            }
            for s in self.list_scenes()
        ]
