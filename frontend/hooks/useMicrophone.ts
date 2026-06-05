"use client";

import { useRef, useCallback, useState } from "react";

interface UseMicrophoneOptions {
  sampleRate?: number;
  onAudioData?: (chunk: Float32Array) => void;
}

export function useMicrophone({ sampleRate = 16000, onAudioData }: UseMicrophoneOptions = {}) {
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate });
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        onAudioData?.(copy);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, [sampleRate, onAudioData]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    ctxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current = null;
    processorRef.current = null;
    setRecording(false);
  }, []);

  return { start, stop, recording, error };
}
