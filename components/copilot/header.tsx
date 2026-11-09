"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  Trash2,
  TrendingUp,
  Receipt,
  Check,
} from "lucide-react";
import { SubAgentId } from "./types";

interface HeaderProps {
  threadTitle: string;
  activeAgentId: SubAgentId;
  onSelectAgent: (id: SubAgentId) => void;
  onClearChat: () => void;
  hasMessages: boolean;
}

const AGENT_MODES: Array<{
  id: SubAgentId;
  name: string;
  icon: typeof Sparkles;
  description: string;
}> = [
  {
    id: "guardian-core",
    name: "Guardian Core",
    icon: Sparkles,
    description: "Financial buffer defense & purchase safety",
  },
  {
    id: "autonomous-trader",
    name: "Trader Agent",
    icon: TrendingUp,
    description: "Guarded order execution & price negotiations",
  },
  {
    id: "merchant-invoicing",
    name: "Invoicing Agent",
    icon: Receipt,
    description: "Automated PayPal Invoicing REST v2 dispatch",
  },
];

export function CopilotHeader({
  threadTitle,
  activeAgentId,
  onSelectAgent,
  onClearChat,
  hasMessages,
}: HeaderProps) {
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);

  const currentMode =
    AGENT_MODES.find((m) => m.id === activeAgentId) || AGENT_MODES[0];
  const CurrentIcon = currentMode.icon;

  return (
    <header className="h-14 border-b border-zinc-800/60 bg-[#0A0A0C]/90 backdrop-blur-md sticky top-0 z-20 select-none px-5 flex items-center justify-between gap-4">
      {/* Left: Dynamic Thread Title / Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-zinc-400 shrink-0">
          Guardian Copilot
        </span>
        <span className="text-zinc-600">/</span>
        <span className="text-xs font-medium text-zinc-200 truncate max-w-[200px] sm:max-w-md">
          {threadTitle || "Current Chat"}
        </span>
      </div>

      {/* Right: Sandbox Status, Minimal Mode Selector, Clear Chat */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Sandbox Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Sandbox Ready</span>
        </div>

        {/* Minimal Agent Mode Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setModeDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition"
            title="Switch Agent Mode"
          >
            <CurrentIcon className="w-3.5 h-3.5 text-violet-400" />
            <span>{currentMode.name}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {modeDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 p-1.5 rounded-xl bg-[#141418] border border-zinc-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Agent Mode
              </div>
              {AGENT_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = mode.id === activeAgentId;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      onSelectAgent(mode.id);
                      setModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition text-left ${
                      isSelected
                        ? "bg-zinc-800 text-zinc-100 font-semibold"
                        : "hover:bg-zinc-850 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <div>
                        <div className="font-medium text-xs">{mode.name}</div>
                        <div className="text-[10px] text-zinc-500">{mode.description}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear Chat Button */}
        {hasMessages && (
          <button
            type="button"
            onClick={onClearChat}
            className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-rose-400 transition"
            title="Clear current messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
