"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Bot, User, MessageCircle, Mic, MicOff, PhoneOff, ChevronDown } from "lucide-react";

const SessionRadar = dynamic(
  () => import("@/components/SessionRadar").then((m) => ({ default: m.SessionRadar })),
  { ssr: false }
);

type Phase = "welcome" | "conversation" | "summary";

const MOCK_MESSAGES: Array<{ user: string; ai: string }> = [
  {
    user: "Hello! I'm here for the job interview.",
    ai: "Welcome! Thank you for coming today. Could you tell me a bit about yourself?",
  },
  {
    user: "I've been working in software engineering for five years. I enjoy building products that solve real-world problems.",
    ai: "That sounds great! What would you say is your proudest professional achievement?",
  },
  {
    user: "I led a team that rebuilt our core platform. We improved performance by 40% and cut customer complaints in half.",
    ai: "Impressive! How did you manage the team and handle the challenges along the way?",
  },
  {
    user: "I mapped out bottlenecks first, then assigned tasks based on each member's strengths. Weekly check-ins kept things moving.",
    ai: "Excellent leadership approach. Last question — where do you see yourself in five years?",
  },
  {
    user: "I want to grow into a technical lead role. I enjoy mentoring others while staying hands-on with architecture.",
    ai: "That's a solid career vision! Thank you for the great conversation. Do you have any questions for me?",
  },
];

const SUMMARY_DATA = {
  session_id: "test-session",
  message_count: 10,
  barge_in_count: 1,
  grammar_errors: [
    {
      has_error: true,
      original: "I have been working here since five years",
      correction: "I have been working here for five years",
      explanation: "since + 时间点，for + 时间段",
      error_type: "preposition",
    },
    {
      has_error: true,
      original: "The performance improved at 40%",
      correction: "The performance improved by 40%",
      explanation: "'improve by' 表示变化的幅度",
      error_type: "preposition",
    },
  ],
  radar_scores: {
    fluency: 78,
    grammar: 62,
    vocabulary: 82,
    pronunciation: 70,
    comprehension: 88,
    confidence: 75,
  },
  cefr_level: "B2" as const,
  strengths: ["表达流畅，逻辑清晰", "听力理解能力强", "能主动用数据支撑论点"],
  weaknesses: ["介词使用偶有混淆", "部分技术术语发音需加强"],
  transcription: [],
  pronunciation_scores: [],
};

export default function TestPage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [msgIndex, setMsgIndex] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<Array<{ user: string; ai: string }>>([]);
  const [showSummary, setShowSummary] = useState(false);

  const startConversation = useCallback(() => {
    setPhase("conversation");
    setMsgIndex(0);
    setVisibleMessages([]);
    // 逐条展示对话
    let i = 0;
    const timer = setInterval(() => {
      if (i < MOCK_MESSAGES.length) {
        setVisibleMessages((prev) => [...prev, MOCK_MESSAGES[i]]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 1500);
  }, []);

  const endConversation = useCallback(() => {
    setPhase("summary");
    setShowSummary(true);
  }, []);

  const reset = useCallback(() => {
    setPhase("welcome");
    setMsgIndex(0);
    setVisibleMessages([]);
    setShowSummary(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {phase === "welcome" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/30 border-2 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-black/20">💼</div>
            <h2 className="text-2xl font-bold mb-2">AI 口语教练 — 测试页面</h2>
            <p className="text-gray-400 text-sm mb-8">模拟完整对话流程，结尾查看雷达图总结</p>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={startConversation}
              className="px-10 py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 mx-auto">
              <MessageCircle size={20} />开始模拟对话
            </motion.button>
          </motion.div>
        </div>
      )}

      {phase === "conversation" && (
        <div className="flex flex-col h-screen">
          <header className="z-20 flex items-center justify-between px-5 py-3 bg-gray-900/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-lg">💼</div>
              <div>
                <h1 className="text-sm font-semibold text-white">AI 口语教练</h1>
                <p className="text-[11px] text-gray-500">模拟对话中...</p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">面试练习</div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <AnimatePresence>
              {visibleMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">等待模拟对话开始...</div>
              )}
              {visibleMessages.map((entry, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">
                  <div className="flex justify-end gap-2">
                    <div className="max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/30">
                      <p className="text-sm text-white/90">{entry.user}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-blue-400" />
                    </div>
                  </div>
                  <div className="flex justify-start gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Bot size={14} className="text-purple-400" />
                    </div>
                    <div className="max-w-[70%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-white/5 border border-white/10">
                      <p className="text-sm text-gray-200">{entry.ai}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-t from-gray-950 to-transparent">
            <button className="p-3 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all">
              <Mic size={20} />
            </button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={endConversation}
              className="p-3 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all">
              <PhoneOff size={20} />
            </motion.button>
          </div>
        </div>
      )}

      {/* 总结弹窗 */}
      <AnimatePresence>
        {showSummary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl">💼</div>
                <div>
                  <h2 className="text-lg font-bold">会话总结</h2>
                  <p className="text-xs text-gray-500">{SUMMARY_DATA.message_count} 条消息 · {SUMMARY_DATA.barge_in_count} 次打断</p>
                </div>
              </div>

              <SessionRadar scores={SUMMARY_DATA.radar_scores} cefrLevel={SUMMARY_DATA.cefr_level} strengths={SUMMARY_DATA.strengths} weaknesses={SUMMARY_DATA.weaknesses} />

              {SUMMARY_DATA.grammar_errors.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium text-amber-400">语法错误</p>
                  {SUMMARY_DATA.grammar_errors.map((e, i) => (
                    <div key={i} className="text-xs bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                      <p className="line-through text-red-300/70 mb-1">{e.original}</p>
                      <p className="text-green-400 flex items-center gap-1"><ChevronDown size={12} className="rotate-[-90deg]" />{e.correction}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowSummary(false)} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10">关闭</button>
                <button onClick={reset} className="flex-1 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-sm hover:bg-purple-500/25">重新测试</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
