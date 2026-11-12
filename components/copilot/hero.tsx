"use client";

import React, { useState } from "react";
import {
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  ShieldCheck,
  Receipt,
  AlertTriangle,
} from "lucide-react";

interface HeroProps {
  onSend: (message: string) => void;
  isGenerating?: boolean;
  onOpenAttach?: () => void;
}

const SUGGESTION_CHIPS = [
  {
    id: "chip-verify-order",
    label: "Verify Sandbox Order",
    prompt: "Verify PayPal sandbox transaction safety and capture readiness for order #8492.",
    icon: ShieldCheck,
  },
  {
    id: "chip-draft-invoice",
    label: "Draft PayPal Invoice",
    prompt: "Draft a PayPal invoice for $450 to client@example.com for software architecture.",
    icon: Receipt,
  },
  {
    id: "chip-audit-risk",
    label: "Audit Transaction Risk",
    prompt: "Audit dispute risk and 30-day cash flow safety against my $500 buffer.",
    icon: AlertTriangle,
  },
];

export function CopilotHero({
  onSend,
  isGenerating = false,
  onOpenAttach,
}: HeroProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isGenerating) return;
    onSend(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setInputValue("Verify PayPal sandbox transaction safety for order #8492");
        setIsRecording(false);
      }, 2200);
    } else {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-3xl mx-auto w-full text-center animate-in fade-in zoom-in-95 duration-200">
      {/* 1. Symmetrical Guardian Copilot Identity Logo */}
      <div className="flex flex-col items-center justify-center mb-6 select-none">
        <div className="relative group p-1.5 rounded-2xl bg-gradient-to-b from-teal-500/20 via-zinc-900/60 to-black/80 border border-zinc-800 shadow-[0_0_50px_-15px_rgba(20,184,166,0.3)] backdrop-blur-xl">
          <img
            src="/guardian-logo.jpg"
            alt="Guardian Copilot - AI Transaction Safety & Sandbox Audit"
            className="w-72 sm:w-88 md:w-[380px] h-auto object-contain rounded-xl block mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
          />
        </div>
      </div>

      {/* 2. Subtitle & Context */}
      <div className="space-y-1.5 mb-7 max-w-xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
          How can Guardian protect you today?
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
          Autonomous merchant safety, $500 cash-flow invariant defense, and PayPal Sandbox settlements.
        </p>
      </div>

      {/* 2. Floating Clean Input Container */}
      <div className="w-full relative group">
        <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-600 rounded-2xl shadow-xl transition-all duration-200 overflow-hidden text-left p-3">
          {/* Textarea */}
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Ask anything or paste an order/invoice link..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-1 pt-1 pb-2"
          />

          {/* Bottom Bar: Attach Clip on Left, Audio & Send on Right */}
          <div className="flex items-center justify-between pt-2">
            {/* Left Attach Clip */}
            <button
              type="button"
              onClick={onOpenAttach}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Attach Document or Receipt"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Right Tools: Mic & Send Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2 rounded-lg border transition ${
                  isRecording
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
                    : "hover:bg-zinc-800 border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
                title={isRecording ? "Listening..." : "Voice input"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!inputValue.trim() || isGenerating}
                className="w-9 h-9 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:pointer-events-none text-zinc-950 font-bold transition flex items-center justify-center shadow"
                title="Send Prompt (Enter)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Three Clean Suggestion Chips */}
      <div className="mt-5 flex items-center justify-center gap-2.5 flex-wrap">
        {SUGGESTION_CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSend(chip.prompt)}
              className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 transition shadow-sm"
            >
              <Icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
