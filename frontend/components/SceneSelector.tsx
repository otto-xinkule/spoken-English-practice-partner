"use client";

import { motion } from "framer-motion";
import { Briefcase, Utensils, Presentation, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { SceneInfo } from "@/types";

const iconMap: Record<string, React.ReactNode> = {
  briefcase: <Briefcase size={16} />,
  utensils: <Utensils size={16} />,
  presentation: <Presentation size={16} />,
};

const diffLabels: Record<string, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

const diffColors: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  advanced: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

interface Props {
  scenes: SceneInfo[];
  currentSceneId: string;
  onSelect: (sceneId: string) => void;
  disabled?: boolean;
}

export function SceneSelector({ scenes, currentSceneId, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const current = scenes.find((s) => s.id === currentSceneId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg
                   hover:bg-accent transition-colors text-sm disabled:opacity-50"
      >
        {current && iconMap[current.icon]}
        <span>{current?.name ?? "选择场景"}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 left-0 z-20 w-64 bg-card border border-border rounded-xl
                       shadow-xl overflow-hidden"
          >
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => {
                  onSelect(scene.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent
                            transition-colors ${scene.id === currentSceneId ? "bg-accent" : ""}`}
              >
                <span className="text-muted-foreground">{iconMap[scene.icon]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{scene.name}</div>
                  <div className="text-xs text-muted-foreground">{scene.name_zh}</div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${diffColors[scene.difficulty] ?? ""}`}
                >
                  {diffLabels[scene.difficulty] ?? scene.difficulty}
                </span>
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
