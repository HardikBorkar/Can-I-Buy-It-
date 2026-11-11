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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "./types";
import { ActionCardRenderer } from "./action-cards";

function ReasoningAccordion({ reasoning }: { reasoning: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden text-xs transition-all duration-200 my-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/50 hover:bg-zinc-850/60 transition text-zinc-400 hover:text-zinc-200"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-xs text-zinc-200">
            Multi-Agent Reasoning &amp; Swarm Audit
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
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
        <div className="px-4 py-3 border-t border-zinc-800/60 bg-zinc-950/70 font-mono text-[11px] leading-relaxed text-zinc-400 space-y-1.5 whitespace-pre-wrap">
          {reasoning}
        </div>
      )}
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-[14.5px] leading-relaxed text-zinc-200 space-y-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-lg font-bold text-zinc-100 mt-4 mb-2 tracking-tight" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-base font-semibold text-zinc-100 mt-3 mb-1.5 tracking-tight" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-sm font-semibold text-zinc-100 mt-3 mb-1 tracking-tight text-violet-300 flex items-center gap-1.5" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="leading-relaxed text-zinc-200 mb-2.5 last:mb-0" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="space-y-1.5 my-2 pl-5 list-disc marker:text-violet-400 text-zinc-300 text-sm" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="space-y-2 my-2 pl-5 list-decimal marker:text-violet-400 marker:font-semibold text-zinc-200 text-sm" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-relaxed pl-1 text-[14px] text-zinc-300" {...props} />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold text-zinc-100" {...props} />
          ),
          em: ({ ...props }) => (
            <em className="text-zinc-300 italic" {...props} />
          ),
          hr: ({ ...props }) => (
            <hr className="my-3.5 border-zinc-800" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-2 border-violet-500/60 pl-3.5 py-1 text-zinc-300 italic text-sm my-2 bg-violet-950/10 rounded-r" {...props} />
          ),
          code: ({ children, ...props }: any) => {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-violet-300 font-mono text-[12px]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 1. Scrollable Message Feed with generous ChatGPT/Claude/Gemini layout */}
      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-7 max-w-3xl mx-auto w-full scrollbar-none">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 animate-in fade-in duration-200 ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600/20 to-teal-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Shield className="w-4 h-4 text-violet-400" />
                </div>
              )}

              <div className={`space-y-2 ${isUser ? "max-w-[78%]" : "max-w-[92%] flex-1 min-w-0"}`}>
                {/* User Message Bubble */}
                {isUser ? (
                  <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-zinc-800 text-zinc-100 text-[14.5px] leading-relaxed shadow-sm border border-zinc-700/50">
                    {msg.text}
                  </div>
                ) : (
                  /* Assistant Response Body */
                  <div className="space-y-3">
                    {/* Collapsible Chain-of-Thought Reasoning Box */}
                    {msg.reasoning && (
                      <ReasoningAccordion reasoning={msg.reasoning} />
                    )}

                    <MarkdownMessage content={msg.text} />

                    {/* Compact Centered Action Card */}
                    {msg.actionCard && (
                      <div className="pt-2">
                        <ActionCardRenderer
                          card={msg.actionCard}
                          onAuthorizeOrder={(orderId, amount) => {
                            onSend(`Authorize PayPal sandbox capture for order #${orderId} ($${amount})`);
                          }}
                        />
                      </div>
                    )}

                    {/* Copy and Meta Toolbar */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5 text-zinc-300">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="flex items-start gap-3.5 animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-violet-400 animate-pulse" />
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-400 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-300" />
              </div>
              <span className="text-zinc-300 text-xs font-medium">
                Guardian Copilot swarm evaluating proposal &amp; invariants...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 2. Docked Clean Input Container at Bottom (ChatGPT / Claude / Gemini style) */}
      <div className="p-4 bg-[#0A0A0C]/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto w-full relative">
          <div className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 focus-within:border-zinc-600 rounded-2xl shadow-xl transition-all duration-200 p-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask a follow-up, compare products, or authorize a payment..."
              className="w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-1 pt-1 pb-2"
            />

            <div className="flex items-center justify-between pt-2">
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
