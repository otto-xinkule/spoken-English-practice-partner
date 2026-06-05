/**
 * Silero VAD Web Worker (stub).
 *
 * Production: loads onnxruntime-web + Silero VAD ONNX model,
 * processes 30ms frames, posts {speaking, probability}.
 *
 * Stub: energy-based VAD placeholder.
 */

const ctx: Worker = self as unknown as Worker;

let initialized = false;
let threshold = 0.5;
let isSpeaking = false;

ctx.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  if (msg.type === "init") {
    threshold = msg.threshold ?? 0.5;
    initialized = true;
    ctx.postMessage({ type: "ready" });
  }

  if (msg.type === "process" && initialized) {
    const arr = msg.audio as Float32Array;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    const rms = Math.sqrt(sum / arr.length);
    const prob = Math.min(rms * 50, 1.0);

    if (prob > threshold && !isSpeaking) {
      isSpeaking = true;
      ctx.postMessage({ type: "vad", speaking: true, probability: prob });
    } else if (prob <= threshold && isSpeaking) {
      isSpeaking = false;
      ctx.postMessage({ type: "vad", speaking: false, probability: prob });
    }
  }
};

export {};
