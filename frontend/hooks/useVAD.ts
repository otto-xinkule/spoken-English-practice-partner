"use client";

import { useRef, useCallback, useState } from "react";
import type { VADEvent } from "@/types";

interface UseVADOptions {
  threshold?: number;
  silenceMs?: number;
  onVADEvent?: (event: VADEvent) => void;
}

export function useVAD({ silenceMs = 800, onVADEvent }: UseVADOptions = {}) {
  const [speaking, setSpeaking] = useState(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpeakingRef = useRef(false);

  const processAudio = useCallback(
    (audioChunk: Float32Array) => {
      // Simple energy-based VAD (stub — production uses Silero ONNX in Web Worker)
      let sum = 0;
      for (let i = 0; i < audioChunk.length; i++) sum += audioChunk[i] * audioChunk[i];
      const rms = Math.sqrt(sum / audioChunk.length);
      const detected = rms > 0.01;

      if (detected && !isSpeakingRef.current) {
        isSpeakingRef.current = true;
        setSpeaking(true);
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        onVADEvent?.({ status: "speech_start", probability: Math.min(rms * 50, 1) });
      }

      if (!detected && isSpeakingRef.current) {
        if (!silenceTimer.current) {
          silenceTimer.current = setTimeout(() => {
            isSpeakingRef.current = false;
            setSpeaking(false);
            silenceTimer.current = null;
            onVADEvent?.({ status: "speech_end", probability: 0 });
          }, silenceMs);
        }
      }
    },
    [silenceMs, onVADEvent]
  );

  return { processAudio, speaking };
}
