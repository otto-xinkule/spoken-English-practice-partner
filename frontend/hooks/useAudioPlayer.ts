"use client";

import { useRef, useCallback, useState } from "react";

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const [playing, setPlaying] = useState(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext({ sampleRate: 24000 });
    return ctxRef.current;
  }, []);

  const enqueue = useCallback((audioData: ArrayBuffer) => {
    const ctx = getCtx();
    ctx.decodeAudioData(audioData.slice(0), (buffer) => {
      queueRef.current.push(buffer);
      playNext();
    });
  }, [getCtx]);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) { setPlaying(false); return; }
    setPlaying(true);
    const buffer = queueRef.current.shift()!;
    const source = getCtx().createBufferSource();
    source.buffer = buffer;
    source.connect(getCtx().destination);
    source.onended = () => {
      if (queueRef.current.length > 0) playNext();
      else setPlaying(false);
    };
    source.start();
  }, [getCtx]);

  const stop = useCallback(() => {
    ctxRef.current?.close();
    ctxRef.current = null;
    queueRef.current = [];
    setPlaying(false);
  }, []);

  return { enqueue, stop, playing };
}
