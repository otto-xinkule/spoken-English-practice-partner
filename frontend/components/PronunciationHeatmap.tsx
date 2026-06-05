"use client";

import { motion } from "framer-motion";
import type { PronunciationResult } from "@/types";

function getColor(a: number): string {
  if (a >= 85) return "bg-green-500";
  if (a >= 70) return "bg-yellow-500";
  if (a >= 50) return "bg-orange-500";
  return "bg-red-500";
}

interface Props { result: PronunciationResult | null; }

export function PronunciationHeatmap({ result }: Props) {
  if (!result) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="p-4 bg-card/50 rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Pronunciation</span>
        <span className="text-2xl font-bold text-primary">{result.pronunciation_score.toFixed(0)}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.words.map((word, wi) => (
          <div key={wi} className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{word.word}</span>
            <div className="flex gap-0.5">
              {word.phonemes.map((p, pi) => (
                <motion.div key={pi} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: pi * 0.05 }}
                  className={`w-3 rounded-sm ${getColor(p.accuracy)}`}
                  style={{ height: `${Math.max(p.accuracy / 5, 4)}px` }}
                  title={`${p.phoneme}: ${p.accuracy.toFixed(0)}%`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{word.phonemes.map(p => p.phoneme).join(" ")}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
