"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Play } from "lucide-react";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVAD } from "@/hooks/useVAD";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

import { AudioVisualizer } from "./AudioVisualizer";
import { GrammarHint } from "./GrammarHint";
import { PronunciationHeatmap } from "./PronunciationHeatmap";
import { SceneSelector } from "./SceneSelector";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

import type {
  OrchestratorState, GrammarHint as GrammarHintType,
  PronunciationResult, SceneInfo, SessionSummary,
} from "@/types";

const WS_URL = "ws://localhost:8000/ws/speak";

export function ConversationPanel() {
  const [sessionActive, setSessionActive] = useState(false);
  const [state, setState] = useState<OrchestratorState>("IDLE");
  const [transcript, setTranscript] = useState<Array<{ user: string; ai: string }>>([]);
  const [currentLLMText, setCurrentLLMText] = useState("");
  const currentLLMTextRef = useRef("");
  useEffect(() => { currentLLMTextRef.current = currentLLMText; }, [currentLLMText]);
  const [interimText, setInterimText] = useState("");
  const [grammarHint, setGrammarHint] = useState<GrammarHintType | null>(null);
  const [pronResult, setPronResult] = useState<PronunciationResult | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState("interview");

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
          console.error("Server error:", msg.data); break;
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
    ws.send("set_scene", { scene_id: sceneId });
  }, [ws]);

  const startSession = useCallback(() => {
    ws.connect();
    setTimeout(() => { ws.send("start_session"); setSessionActive(true); mic.start(); }, 300);
  }, [ws, mic]);

  const endSession = useCallback(() => {
    ws.send("end_session"); mic.stop(); player.stop(); setSessionActive(false);
  }, [ws, mic, player]);

  const bargeIn = useCallback(() => { ws.send("barge_in"); player.stop(); }, [ws, player]);

  const stateLabel: Record<OrchestratorState, string> = {
    IDLE: "Ready", LISTENING: "Listening...", USER_SPEAKING: "You're speaking",
    THINKING: "Thinking...", AI_SPEAKING: "AI speaking",
  };
  const stateColor: Record<OrchestratorState, string> = {
    IDLE: "bg-gray-500", LISTENING: "bg-green-500", USER_SPEAKING: "bg-blue-500",
    THINKING: "bg-orange-500", AI_SPEAKING: "bg-purple-500",
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h1 className="text-lg font-bold">🎤 AI 口语教练</h1>
          <p className="text-xs text-muted-foreground">
            <SceneSelector
              scenes={scenes}
              currentSceneId={currentSceneId}
              onSelect={handleSceneSelect}
              disabled={sessionActive}
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stateColor[state]} animate-pulse`} />
          <span className="text-sm text-muted-foreground">{stateLabel[state]}</span>
        </div>
      </header>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {transcript.map((entry, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-primary/20 rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
                  <p className="text-sm">{entry.user}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                  <p className="text-sm">{entry.ai}</p>
                </div>
              </div>
            </motion.div>
          ))}
          {interimText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="flex justify-end">
              <div className="bg-primary/10 rounded-2xl px-4 py-2 italic">
                <p className="text-sm text-muted-foreground">{interimText}</p>
              </div>
            </motion.div>
          )}
          {currentLLMText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
                <p className="text-sm">{currentLLMText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pronunciation */}
      <PronunciationHeatmap result={pronResult} />

      {/* Audio Visualizer */}
      <Card className="mx-4 h-24 overflow-hidden">
        <AudioVisualizer speaking={state === "USER_SPEAKING"} className="w-full h-full" />
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4">
        {!sessionActive ? (
          <Button size="lg" onClick={startSession} className="gap-2 rounded-full px-8">
            <Play size={18} /> Start Interview
          </Button>
        ) : (
          <>
            <Button size="lg" variant={mic.recording ? "default" : "destructive"}
              onClick={() => mic.recording ? mic.stop() : mic.start()}
              className="rounded-full w-14 h-14">
              {mic.recording ? <Mic size={22} /> : <MicOff size={22} />}
            </Button>
            <Button size="lg" variant="outline" onClick={bargeIn}
              disabled={state !== "AI_SPEAKING"} className="rounded-full px-6">
              ✋ Interrupt
            </Button>
            <Button size="lg" variant="destructive" onClick={endSession} className="rounded-full w-14 h-14">
              <PhoneOff size={22} />
            </Button>
          </>
        )}
      </div>

      {/* Grammar Hint Overlay */}
      <GrammarHint hint={grammarHint} onDismiss={() => setGrammarHint(null)} />

      {/* Summary Modal */}
      <AnimatePresence>
        {summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setSummary(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="bg-card border border-border rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold">Session Summary</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Messages: {summary.message_count} · Barge-ins: {summary.barge_in_count}
              </p>
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium">Grammar Errors:</p>
                {summary.grammar_errors.map((e, i) => (
                  <div key={i} className="text-xs bg-red-500/10 rounded p-2">
                    <span className="line-through text-red-300">{e.original}</span>
                    {" → "}<span className="text-green-300">{e.correction}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={() => setSummary(null)}>Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────

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
