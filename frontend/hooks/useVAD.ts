"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { VADEvent } from "@/types";

interface UseVADOptions {
  silenceMs?: number;
  onVADEvent?: (event: VADEvent) => void;
}

// ── Silero VAD 模型配置 ──────────────────────────────────────────
const MODEL_URL = "https://models.silero.ai/vad_models/silero_vad.onnx";
const FRAME_SIZE = 512; // 512 samples @ 16kHz = 32ms
const SPEECH_THRESHOLD = 0.5; // 语音概率 > 0.5 判定为说话
const SILENCE_THRESHOLD = 0.3; // 低于 0.3 开始计时静音

// ── 模块级单例：ONNX Session 只加载一次 ──────────────────────────
let _session: import("onnxruntime-web").InferenceSession | null = null;
let _loading = false;
let _loadError = false;

async function ensureSession(): Promise<
  import("onnxruntime-web").InferenceSession | null
> {
  if (_session) return _session;
  if (_loadError) return null;
  if (_loading) {
    while (_loading) await new Promise((r) => setTimeout(r, 50));
    return _session;
  }
  _loading = true;
  try {
    const { InferenceSession, env } = await import("onnxruntime-web");
    // 从 CDN 加载 WASM 文件
    env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
    _session = await InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    });
    console.log("[VAD] Silero VAD model loaded");
  } catch (err) {
    console.warn("[VAD] Failed to load Silero model, falling back to energy VAD:", err);
    _loadError = true;
  } finally {
    _loading = false;
  }
  return _session;
}

// ── 能量 VAD（降级方案） ─────────────────────────────────────────
function energyVAD(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  const rms = Math.sqrt(sum / frame.length);
  return Math.min(rms * 50, 1);
}

// ── Hook ─────────────────────────────────────────────────────────
export function useVAD(
  { silenceMs = 800, onVADEvent }: UseVADOptions = {}
) {
  const [speaking, setSpeaking] = useState(false);
  /** LSTM 隐状态（每个 VAD 实例独立） */
  const hRef = useRef<Float32Array | null>(null);
  const cRef = useRef<Float32Array | null>(null);
  /** 静音计时器 */
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpeakingRef = useRef(false);
  /** 序列化推理防竞态 */
  const processingRef = useRef(false);
  const queueRef = useRef<Float32Array[]>([]);

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const session = await ensureSession();
    const { Tensor } = session ? await import("onnxruntime-web") : { Tensor: null as any };

    while (queueRef.current.length > 0) {
      const frame = queueRef.current.shift()!;
      let prob: number;

      if (session) {
        // ── Silero ONNX 推理 ──
        const input = new Tensor("float32", new Float32Array(frame), [
          1, FRAME_SIZE,
        ]);
        const sr = new Tensor("int64", [BigInt(16000)], [1]);

        const feeds: Record<string, any> = { input, sr };
        if (hRef.current && cRef.current) {
          feeds.h = new Tensor("float32", hRef.current, [2, 1, 64]);
          feeds.c = new Tensor("float32", cRef.current, [2, 1, 64]);
        }

        const results = await session.run(feeds);
        prob = (results.output.data as Float32Array)[0];

        // 保存隐状态给下一帧
        if (results.hn)
          hRef.current = new Float32Array(results.hn.data as Float32Array);
        if (results.cn)
          cRef.current = new Float32Array(results.cn.data as Float32Array);
      } else {
        // ── 降级：能量 VAD ──
        prob = energyVAD(frame);
      }

      // ── 语音/静音判定 ──
      if (prob > SPEECH_THRESHOLD && !isSpeakingRef.current) {
        // 开始说话
        isSpeakingRef.current = true;
        setSpeaking(true);
        if (silenceTimer.current) {
          clearTimeout(silenceTimer.current);
          silenceTimer.current = null;
        }
        onVADEvent?.({ status: "speech_start", probability: prob });
      } else if (prob < SILENCE_THRESHOLD && isSpeakingRef.current) {
        // 开始静音计时
        if (!silenceTimer.current) {
          silenceTimer.current = setTimeout(() => {
            isSpeakingRef.current = false;
            setSpeaking(false);
            silenceTimer.current = null;
            onVADEvent?.({ status: "speech_end", probability: 0 });
          }, silenceMs);
        }
      }
    }

    processingRef.current = false;
  }, [silenceMs, onVADEvent]);

  /** 外部调用：送入音频数据 */
  const processAudio = useCallback(
    (audioChunk: Float32Array) => {
      for (let i = 0; i + FRAME_SIZE <= audioChunk.length; i += FRAME_SIZE) {
        queueRef.current.push(audioChunk.slice(i, i + FRAME_SIZE));
      }
      drainQueue();
    },
    [drainQueue]
  );

  // 重置 LSTM 状态
  const reset = useCallback(() => {
    hRef.current = null;
    cRef.current = null;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
    isSpeakingRef.current = false;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  return { processAudio, speaking, reset };
}
