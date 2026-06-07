"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { WSMessage, OrchestratorState } from "@/types";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (msg: WSMessage) => void;
  onStateChange?: (state: OrchestratorState) => void;
}

export function useWebSocket({ url, onMessage, onStateChange }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 保存最新回调，避免 ws.onmessage 闭包过期
  const onMessageRef = useRef(onMessage);
  const onStateChangeRef = useRef(onStateChange);
  onMessageRef.current = onMessage;
  onStateChangeRef.current = onStateChange;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { setReady(true); setError(null); };
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === "state_change" && onStateChangeRef.current && msg.data) {
          const to = (msg.data as Record<string, unknown>).to;
          if (to && typeof to === "string") {
            onStateChangeRef.current(to as OrchestratorState);
          }
        }
        onMessageRef.current?.(msg);
      } catch (e) {
        console.warn("[WS] 消息处理失败:", e);
      }
    };
    ws.onerror = () => setError("WebSocket error");
    ws.onclose = () => setReady(false);
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setReady(false);
  }, []);

  const send = useCallback((type: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  useEffect(() => { return () => wsRef.current?.close(); }, []);

  return { connect, disconnect, send, ready, error };
}
