"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, PhoneOff, Play, Sparkles, MessageCircle,
  ChevronDown, Waves, Bot, User, Volume2, Palette
} from "lucide-react";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVAD } from "@/hooks/useVAD";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

import { AudioVisualizer } from "./AudioVisualizer";
import { GrammarHint } from "./GrammarHint";
import { PronunciationHeatmap } from "./PronunciationHeatmap";
import { SceneSelector } from "./SceneSelector";
import dynamic from "next/dynamic";
const SessionRadar = dynamic(() => import("./SessionRadar").then(m => ({ default: m.SessionRadar })), { ssr: false });
import { Button } from "./ui/button";
import { Card } from "./ui/card";

import type {
  OrchestratorState, GrammarHint as GrammarHintType,
  PronunciationResult, SceneInfo, SessionSummary,
} from "@/types";

const WS_URL = "ws://localhost:8000/ws/speak";

// ── 场景图标映射 ────────────────────────────────────────────────────
const sceneIcons: Record<string, string> = {
  interview: "💼",
  ordering: "🍽️",
  meeting: "📊",
};

const sceneGradients: Record<string, string> = {
  interview: "from-blue-600/20 to-violet-600/20",
  ordering: "from-orange-500/20 to-rose-500/20",
  meeting: "from-emerald-500/20 to-teal-500/20",
};

const sceneBorders: Record<string, string> = {
  interview: "border-blue-500/30",
  ordering: "border-orange-500/30",
  meeting: "border-emerald-500/30",
};

const sceneTexts: Record<string, string> = {
  interview: "text-blue-400",
  ordering: "text-orange-400",
  meeting: "text-emerald-400",
};

const sceneBGs: Record<string, string> = {
  interview: "bg-blue-500/10",
  ordering: "bg-orange-500/10",
  meeting: "bg-emerald-500/10",
};

// ── 背景主题 ────────────────────────────────────────────────────────
const themes = [
  { id: "dark", name: "暗夜", bg: "from-gray-950 via-gray-900 to-gray-950", accent: "bg-violet-500", dot: "bg-violet-400" },
  { id: "ocean", name: "深海", bg: "from-slate-950 via-blue-950 to-slate-950", accent: "bg-cyan-500", dot: "bg-cyan-400" },
  { id: "forest", name: "森林", bg: "from-zinc-950 via-emerald-950 to-zinc-950", accent: "bg-emerald-500", dot: "bg-emerald-400" },
  { id: "sunset", name: "日落", bg: "from-stone-950 via-rose-950 to-stone-950", accent: "bg-amber-500", dot: "bg-amber-400" },
  { id: "aurora", name: "极光", bg: "from-indigo-950 via-purple-950 to-indigo-950", accent: "bg-fuchsia-500", dot: "bg-fuchsia-400" },
  { id: "midnight", name: "午夜", bg: "from-neutral-950 via-neutral-900 to-neutral-950", accent: "bg-sky-500", dot: "bg-sky-400" },
];

export function ConversationPanel() {
  const [sessionActive, setSessionActive] = useState(false);
  const [state, setState] = useState<OrchestratorState>("IDLE");
  const [currentTheme, setCurrentTheme] = useState("dark");
  const [themeOpen, setThemeOpen] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ user: string; ai: string }>>([]);
  const [currentLLMText, setCurrentLLMText] = useState("");
  const currentLLMTextRef = useRef("");
  useEffect(() => { currentLLMTextRef.current = currentLLMText; }, [currentLLMText]);
  const [interimText, setInterimText] = useState("");
  const [grammarHint, setGrammarHint] = useState<GrammarHintType | null>(null);
  const [pronResult, setPronResult] = useState<PronunciationResult | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [scenes, setScenes] = useState<SceneInfo[]>([
    { id: "interview", name: "Job Interview", name_zh: "面试练习", icon: "💼", difficulty: "medium" },
    { id: "ordering", name: "Restaurant Ordering", name_zh: "餐厅点餐", icon: "🍽️", difficulty: "easy" },
    { id: "meeting", name: "Business Meeting", name_zh: "商务会议", icon: "📊", difficulty: "hard" },
  ]);
  const [currentSceneId, setCurrentSceneId] = useState("interview");
  const [showScenes, setShowScenes] = useState(false);

  const ws = useWebSocket({
    url: WS_URL,
    onMessage: (msg) => {
      switch (msg.type) {
        case "scene_list": {
          const d = msg.data as unknown as { scenes: SceneInfo[] };
          setScenes(d.scenes ?? []);
          break;
        }
        case "asr_result": {
          const d = msg.data as unknown as { text: string; is_final: boolean };
          if (d.is_final) setInterimText(""); else setInterimText(d.text);
          break;
        }
        case "llm_token": {
          setCurrentLLMText((prev) => prev + (msg.data as unknown as { token: string }).token);
          break;
        }
        case "llm_done": {
          setTranscript((prev) => [...prev, { user: "[speech]", ai: currentLLMTextRef.current }]);
          setCurrentLLMText("");
          break;
        }
        case "grammar_hint":
          setGrammarHint(msg.data as unknown as GrammarHintType); break;
        case "pronunciation_result":
          setPronResult(msg.data as unknown as PronunciationResult); break;
        case "session_summary":
          setSummary(msg.data as unknown as SessionSummary); break;
        case "error":
          console.error("服务器错误:", msg.data); break;
      }
    },
    onStateChange: (s) => setState(s),
  });

  const mic = useMicrophone({
    sampleRate: 16000,
    onAudioData: (chunk) => {
      ws.send("audio", { audio: arrayBufferToBase64(float32ToPCM(chunk)) });
      vad.processAudio(chunk);
    },
  });

  const vad = useVAD({
    silenceMs: 800,
    onVADEvent: (e) => ws.send("vad_event", { status: e.status, probability: e.probability }),
  });

  const player = useAudioPlayer();

  const handleSceneSelect = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId);
  }, []);

  const startSession = useCallback(() => {
    ws.connect();
    setTimeout(() => {
      ws.send("start_session", { scene_id: currentSceneId });
      setSessionActive(true);
      mic.start();
    }, 300);
  }, [ws, mic, currentSceneId]);

  const endSession = useCallback(() => {
    ws.send("end_session"); mic.stop(); player.stop(); setSessionActive(false);
  }, [ws, mic, player]);

  const bargeIn = useCallback(() => { ws.send("barge_in"); player.stop(); }, [ws, player]);

  const stateLabel: Record<OrchestratorState, string> = {
    IDLE: "就绪", LISTENING: "正在听...", USER_SPEAKING: "你正在说话",
    THINKING: "思考中...", AI_SPEAKING: "AI 说话中",
  };

  const stateRingColor: Record<OrchestratorState, string> = {
    IDLE: "ring-gray-500/30", LISTENING: "ring-green-500/60",
    USER_SPEAKING: "ring-blue-500/60", THINKING: "ring-amber-500/60",
    AI_SPEAKING: "ring-purple-500/60",
  };

  const sceneId = currentSceneId || "interview";
  const sceneGradient = sceneGradients[sceneId] ?? sceneGradients.interview;
  const sceneBorder = sceneBorders[sceneId] ?? sceneBorders.interview;
  const sceneText = sceneTexts[sceneId] ?? sceneTexts.interview;
  const sceneBG = sceneBGs[sceneId] ?? sceneBGs.interview;
  const theme = themes.find(t => t.id === currentTheme) ?? themes[0];
  const themeBg = theme.bg;
  const containerClass = `flex flex-col h-screen bg-gradient-to-b ${themeBg}`;

  return (
    <div className={containerClass}>
      {/* ─── 顶部导航栏 ─── */}
      <header className="relative z-20 flex items-center justify-between px-5 py-3
                         bg-gray-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl ${sceneBG} ${sceneBorder} border
                           flex items-center justify-center text-lg`}>
            {sceneIcons[sceneId]}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">AI 口语教练</h1>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${state === "IDLE" ? "bg-gray-500" : "bg-green-400 animate-pulse"}`} />
              {stateLabel[state]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!sessionActive && (
            <SceneSelector
              scenes={scenes}
              currentSceneId={currentSceneId}
              onSelect={handleSceneSelect}
              disabled={sessionActive}
            />
          )}
          {sessionActive && (
            <div className={`px-3 py-1 rounded-full text-[11px] font-medium ${sceneBG} ${sceneText} ${sceneBorder} border`}>
              {scenes.find(s => s.id === sceneId)?.name ?? "面试练习"}
            </div>
          )}

          {/* 主题切换 */}
          <div className="relative">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center
                         hover:bg-white/10 transition-colors"
              title="切换背景"
            >
              <Palette size={15} className="text-gray-400" />
            </button>
            {themeOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setThemeOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-0 top-full mt-2 z-40 bg-gray-800/95 backdrop-blur-xl
                             border border-white/10 rounded-2xl p-3 shadow-2xl"
                >
                  <p className="text-[10px] text-gray-500 mb-2 px-1">背景主题</p>
                  <div className="flex gap-1.5">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setCurrentTheme(t.id); setThemeOpen(false); }}
                        className={`w-7 h-7 rounded-full ${t.accent} transition-all duration-200 hover:scale-110 ${t.id === currentTheme ? "ring-2 ring-white/60 scale-110" : "opacity-70 hover:opacity-100"}`}
                        title={t.name}
                      />
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>
      {/* ─── 主内容区 ─── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!sessionActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className={`w-20 h-20 rounded-3xl ${sceneBG} ${sceneBorder} border-2
                               flex items-center justify-center text-4xl mx-auto mb-6
                               shadow-lg shadow-black/20`}>
                {sceneIcons[sceneId]}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {scenes.find(s => s.id === sceneId)?.name ?? "AI 口语教练"}
              </h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                {scenes.find(s => s.id === sceneId)?.name_zh ?? "选择场景开始练习"}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {scenes.map((s) => (
                  <motion.button
                    key={s.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSceneSelect(s.id)}
                    className={`p-3 rounded-2xl border transition-all duration-200 text-left
                      ${s.id === sceneId
                        ? `${sceneBorders[s.id] ?? "border-blue-500/50"} ${sceneBGs[s.id] ?? "bg-blue-500/10"} border-2`
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                  >
                    <div className="text-2xl mb-1">{sceneIcons[s.id]}</div>
                    <div className="text-xs font-medium text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-gray-500">{s.name_zh}</div>
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startSession}
                className={`relative overflow-hidden px-10 py-4 rounded-2xl font-semibold text-white
                            bg-gradient-to-r ${sceneId === "interview" ? "from-blue-600 to-violet-600" :
                            sceneId === "ordering" ? "from-orange-500 to-rose-500" :
                            "from-emerald-500 to-teal-500"}
                            shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/30
                            transition-all duration-300 flex items-center gap-2 mx-auto`}
              >
                <MessageCircle size={20} />
                开始对话
              </motion.button>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
              <AnimatePresence>
                {transcript.length === 0 && !currentLLMText && !interimText && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <div className={`w-16 h-16 rounded-3xl ${sceneBG} border ${sceneBorder}
                                     flex items-center justify-center mb-4`}>
                      <Volume2 size={28} className={sceneText} />
                    </div>
                    <p className="text-gray-400 text-sm">开始说话吧，我在听...</p>
                    <p className="text-gray-600 text-xs mt-1">你的每句话都会得到 AI 回应</p>
                  </motion.div>
                )}

                {transcript.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <div className="flex justify-end gap-2">
                      <div className={`max-w-[78%] rounded-2xl rounded-br-md px-4 py-2.5
                                       bg-gradient-to-br ${sceneGradient} border ${sceneBorder}`}>
                        <p className="text-sm text-white/90 leading-relaxed">{entry.user}</p>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20
                                      border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-blue-400" />
                      </div>
                    </div>

                    <div className="flex justify-start gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20
                                      border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={14} className="text-purple-400" />
                      </div>
                      <div className="max-w-[78%] rounded-2xl rounded-bl-md px-4 py-2.5
                                      bg-white/5 border border-white/10">
                        <p className="text-sm text-gray-200 leading-relaxed">{entry.ai}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {interimText && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} className="flex justify-end gap-2">
                    <div className="max-w-[78%] rounded-2xl px-4 py-2.5 bg-white/5 border border-white/10 italic">
                      <p className="text-sm text-gray-500">{interimText}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-gray-600" />
                    </div>
                  </motion.div>
                )}

                {currentLLMText && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={14} className="text-purple-400 animate-pulse" />
                    </div>
                    <div className="max-w-[78%] rounded-2xl rounded-bl-md px-4 py-2.5
                                    bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                      <p className="text-sm text-gray-200 leading-relaxed">{currentLLMText}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <PronunciationHeatmap result={pronResult} />

            <div className="mx-4 mb-1">
              <Card className="h-20 overflow-hidden bg-black/30 border-white/10 rounded-2xl">
                <AudioVisualizer speaking={state === "USER_SPEAKING"} className="w-full h-full" />
              </Card>
            </div>

            <div className="flex items-center justify-center gap-3 px-4 py-3
                            bg-gradient-to-t from-gray-950 via-gray-900/90 to-transparent">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => mic.recording ? mic.stop() : mic.start()}
                className={`p-3 rounded-full transition-all duration-300
                  ${mic.recording
                    ? `bg-gradient-to-br ${sceneId === "interview" ? "from-blue-500 to-violet-500" :
                        sceneId === "ordering" ? "from-orange-500 to-rose-500" :
                        "from-emerald-500 to-teal-500"} shadow-lg shadow-current/25 animate-pulse-soft`
                    : "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                  }`}
              >
                {mic.recording ? <Mic size={20} className="text-white" /> : <MicOff size={20} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={bargeIn}
                disabled={state !== "AI_SPEAKING"}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200
                  ${state === "AI_SPEAKING"
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                    : "bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed"
                  }`}
              >
                ✋ 打断
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={endSession}
                className="p-3 rounded-full bg-red-500/20 border border-red-500/30
                           text-red-400 hover:bg-red-500/30 transition-all duration-300"
              >
                <PhoneOff size={20} />
              </motion.button>
            </div>
          </>
        )}
      </div>

      <GrammarHint hint={grammarHint} onDismiss={() => setGrammarHint(null)} />

      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSummary(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full
                         max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-2xl ${sceneBG} ${sceneBorder} border
                                 flex items-center justify-center text-xl`}>
                  {sceneIcons[sceneId]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">会话总结</h2>
                  <p className="text-xs text-gray-500">
                    {summary.message_count} 条消息 · {summary.barge_in_count} 次打断
                  </p>
                </div>
              </div>

              {/* 雷达图 + CEFR */}
              {summary.radar_scores && (
                <SessionRadar
                  scores={summary.radar_scores}
                  cefrLevel={summary.cefr_level}
                  strengths={summary.strengths}
                  weaknesses={summary.weaknesses}
                />
              )}

              {summary.grammar_errors.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-amber-400">语法错误</p>
                  {summary.grammar_errors.map((e, i) => (
                    <div key={i} className="text-xs bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                      <p className="line-through text-red-300/70 mb-1">{e.original}</p>
                      <p className="text-green-400 flex items-center gap-1">
                        <ChevronDown size={12} className="rotate-[-90deg]" />
                        {e.correction}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full border-white/10 text-gray-300 hover:bg-white/5 rounded-xl"
                onClick={() => setSummary(null)}
              >
                关闭
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 辅助函数 ────────────────────────────────────────────────────────

function float32ToPCM(f32: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(f32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buf;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
