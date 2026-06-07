# AI 英语口语练习伙伴

基于 AI 的实时英语口语对话练习应用，支持多种场景模拟（面试、点餐、商务会议），通过语音识别 + 大语言模型 + 语音合成实现端到端的口语对话训练。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS + Framer Motion |
| 后端 | Python / FastAPI + WebSocket |
| LLM | DeepSeek（兼容 OpenAI SDK） |
| ASR / TTS | 阿里云 NLS（支持 Mock 降级） |
| VAD | Silero ONNX（浏览器端） |

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端运行在 `http://localhost:8000`。

环境变量（可选，缺失时自动降级为 Mock）：

- `DEEPSEEK_API_KEY` — DeepSeek API 密钥
- `ALIBABA_ACCESS_KEY_ID` / `ALIBABA_ACCESS_KEY_SECRET` / `ALIBABA_NLS_APPKEY` — 阿里云语音服务凭证

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:3000`。

## 功能

- **实时语音对话**：说话 → ASR 转写 → LLM 回复 → TTS 朗读，支持随时打断（barge-in）
- **三种练习场景**：求职面试、餐厅点餐、商务会议
- **语法纠错提示**：实时检测语法错误并给出修改建议
- **发音评分**：音素级热力图展示发音准确度
- **会话总结**：六维雷达图（流利度、语法、词汇、发音、理解力、自信度）+ CEFR 等级
- **优雅降级**：API 密钥缺失时自动使用 Mock 数据，不影响体验
