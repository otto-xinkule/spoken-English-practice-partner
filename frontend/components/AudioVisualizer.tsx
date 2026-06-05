"use client";

import { useEffect, useRef } from "react";

interface Props { speaking: boolean; className?: string; }

export function AudioVisualizer({ speaking, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array.from({ length: 40 }, () => 4));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const barW = (W / barsRef.current.length) - 2;
    let animId = 0;

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < barsRef.current.length; i++) {
        barsRef.current[i] += ((speaking ? Math.random() * H * 0.8 + 4 : 4) - barsRef.current[i]) * 0.3;
      }
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, "#3b82f6"); g.addColorStop(0.5, "#8b5cf6"); g.addColorStop(1, "#ec4899");
      ctx.fillStyle = g;
      for (let i = 0; i < barsRef.current.length; i++) {
        const h = barsRef.current[i];
        ctx.fillRect(i * (barW + 2), H - h, barW, h);
      }
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [speaking]);

  return <canvas ref={canvasRef} width={400} height={120} className={className} style={{ width: "100%", height: "100%" }} />;
}
