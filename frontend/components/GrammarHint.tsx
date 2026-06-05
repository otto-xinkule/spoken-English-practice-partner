"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GrammarHint as GrammarHintType } from "@/types";

interface Props { hint: GrammarHintType | null; onDismiss?: () => void; }

export function GrammarHint({ hint, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {hint?.has_error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
        >
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur">
            <p className="text-yellow-400 text-xs font-medium mb-1 uppercase">Grammar Hint</p>
            <p className="text-red-300 line-through text-sm">{hint.original}</p>
            <p className="text-green-300 text-sm font-medium">{hint.correction}</p>
            <p className="text-muted-foreground text-xs mt-1.5">{hint.explanation}</p>
            {onDismiss && (
              <button onClick={onDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">✕</button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
