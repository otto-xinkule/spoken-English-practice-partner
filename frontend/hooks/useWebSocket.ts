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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { setReady(true); setError(null); };
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === "state_change" && onStateChange) {
          onStateChange((msg.data as { to: OrchestratorState }).to);
        }
        onMessage?.(msg);
      } catch { /* malformed */ }
    };
    ws.onerror = () => setError("WebSocket error");
    ws.onclose = () => setReady(false);
  }, [url, onMessage, onStateChange]);

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
