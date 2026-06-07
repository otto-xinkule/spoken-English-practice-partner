"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { RadarScores, CEFRLevel } from "@/types";

interface SessionRadarProps {
  scores: RadarScores;
  cefrLevel?: CEFRLevel;
  strengths?: string[];
  weaknesses?: string[];
}

const AXIS_LABELS: Record<keyof RadarScores, string> = {
  fluency: "流畅度",
  grammar: "语法",
  vocabulary: "词汇",
  pronunciation: "发音",
  comprehension: "理解",
  confidence: "自信",
};

const CEFR_LABELS: Record<CEFRLevel, string> = {
  A1: "入门 A1",
  A2: "基础 A2",
  B1: "进阶 B1",
  B2: "中高级 B2",
  C1: "流利 C1",
  C2: "精通 C2",
};

export function SessionRadar({
  scores,
  cefrLevel,
  strengths,
  weaknesses,
}: SessionRadarProps) {
  const data = Object.entries(AXIS_LABELS).map(([key, label]) => ({
    axis: label,
    value: scores[key as keyof RadarScores],
    fullMark: 100,
  }));

  return (
    <div className="space-y-4">
      {/* 雷达图 */}
      <div className="bg-black/20 rounded-xl p-3 border border-white/5">
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data}>
            <PolarGrid
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            />
            <Radar
              name="评分"
              dataKey="value"
              stroke="rgba(139, 92, 246, 0.8)"
              fill="rgba(139, 92, 246, 0.2)"
              fillOpacity={0.5}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* CEFR 等级 */}
      {cefrLevel && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-xs text-gray-500">综合等级</span>
          <span className="px-3 py-1 bg-purple-500/15 border border-purple-500/30 rounded-full text-sm font-semibold text-purple-300">
            {CEFR_LABELS[cefrLevel]}
          </span>
        </div>
      )}

      {/* 优势 / 不足 */}
      {(strengths && strengths.length > 0 || weaknesses && weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {strengths && strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-400 mb-1.5">优势</p>
              {strengths.map((s, i) => (
                <p key={i} className="text-xs text-gray-300 leading-relaxed">
                  {s}
                </p>
              ))}
            </div>
          )}
          {weaknesses && weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-400 mb-1.5">待提升</p>
              {weaknesses.map((w, i) => (
                <p key={i} className="text-xs text-gray-300 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
