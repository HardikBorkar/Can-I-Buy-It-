"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Shield,
  ArrowUp,
  Paperclip,
  Mic,
  MicOff,
  Copy,
  Check,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ChatMessage } from "./types";
import { ActionCardRenderer } from "./action-cards";

function ReasoningAccordion({ reasoning }: { reasoning: string }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-xl border border-violet-950/60 bg-[#0E0E14] overflow-hidden text-xs transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-violet-950/20 hover:bg-violet-950/30 transition text-zinc-300"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-zinc-200">
            Autonomous Reasoning &amp; Intent Analysis
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
            Chain-of-Thought
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-3.5 py-3 border-t border-violet-950/40 bg-zinc-950/60 font-mono text-[11px] leading-relaxed text-zinc-400 space-y-1.5 whitespace-pre-wrap">
          {reasoning}
        </div>
      )}
    </div>
  );
}

interface MessageStreamProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSend: (message: string) => void;
  onOpenAttach?: () => void;
}

export function CopilotMessageStream({
  messages,
  isGenerating,
  onSend,
  onOpenAttach,
}: MessageStreamProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

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

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setInputValue("Check balance and 90-day cash flow safety");
        setIsRecording(false);
      }, 2200);
    } else {
      setIsRecording(false);
    }
  };

  // Helper to render bold markdown and clean lists
  const renderMessageText = (rawText: string) => {
    return rawText.split("\n").map((line, idx) => {
      if (!line.trim()) return <div key={idx} className="h-1.5" />;

      const listMatch = line.match(/^(\s*)([\*\-•]|\d+\.)\s+(.*)$/);
      const isList = !!listMatch;
      const content = listMatch ? listMatch[3] : line;

      const renderInline = (str: string) => {
        const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
        return parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-semibold text-zinc-100">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code
                key={pIdx}
                className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-violet-300 font-mono text-[11px]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        });
      };

      if (isList) {
        return (
          <p key={idx} className="flex items-start gap-2 leading-relaxed text-sm text-zinc-300">
            <span className="text-violet-400 mt-1 shrink-0">•</span>
            <span>{renderInline(content)}</span>
          </p>
        );
      }

      return (
        <p key={idx} className="leading-relaxed text-sm text-zinc-300">
          {renderInline(content)}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 1. Scrollable Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full scrollbar-none">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex gap-3 animate-in fade-in duration-200 ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}

              <div className={`space-y-1.5 ${isUser ? "max-w-[80%]" : "max-w-[90%] flex-1"}`}>
                {/* User Message Bubble */}
                {isUser ? (
                  <div className="p-3.5 rounded-2xl rounded-tr-sm bg-zinc-800/90 border border-zinc-700/60 text-zinc-100 text-sm leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                ) : (
                  /* Assistant Response Body */
                  <div className="space-y-3">
                    {/* Collapsible Chain-of-Thought Reasoning Box */}
                    {msg.reasoning && (
                      <div className="pb-1">
                        <ReasoningAccordion reasoning={msg.reasoning} />
                      </div>
                    )}

                    <div className="text-sm leading-relaxed text-zinc-300 space-y-2">
                      {renderMessageText(msg.text)}
                    </div>

                    {/* Compact Centered Action Card */}
                    {msg.actionCard && (
                      <div className="pt-1">
                        <ActionCardRenderer
                          card={msg.actionCard}
                          onAuthorizeOrder={(orderId, amount) => {
                            onSend(`Authorize PayPal sandbox capture for order #${orderId} ($${amount})`);
                          }}
                        />
                      </div>
                    )}

                    {/* Copy Button */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="flex items-start gap-3 animate-in fade-in duration-150">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2 text-xs text-zinc-400">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-300" />
              </div>
              <span className="text-zinc-400 text-xs">
                Guardian Copilot is analyzing cash flow &amp; transaction safety...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 2. Docked Clean Input Container at Bottom */}
      <div className="p-4 bg-[#0A0A0C]/95 border-t border-zinc-850/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto w-full relative">
          <div className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-600 rounded-2xl shadow-xl transition-all duration-200 p-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask a follow-up or simulate transaction..."
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-1 pt-1 pb-2"
            />

            <div className="flex items-center justify-between pt-2 border-t border-zinc-850/60">
              {/* Left Attach Clip */}
              <button
                type="button"
                onClick={onOpenAttach}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                title="Attach Document"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Right Tools: Mic & Send Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-1.5 rounded-lg border transition ${
                    isRecording
                      ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
                    : "hover:bg-zinc-800 border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Voice input"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!inputValue.trim() || isGenerating}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:pointer-events-none text-zinc-950 font-bold transition flex items-center justify-center shadow"
                  title="Send (Enter)"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
