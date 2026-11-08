"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  ExternalLink,
  Maximize2,
} from "lucide-react";

interface ActionCardData {
  type: "balance" | "affordability" | "commitments" | "invoice_prompt";
  balance?: number;
  buffer?: number;
  discretionary?: number;
  outflows?: number;
  item?: string;
  amount?: number;
  installment?: number;
  payInFullSafe?: boolean;
  payInFullLowest?: number;
  payIn4Safe?: boolean;
  payIn4Lowest?: number;
  defaultRecipient?: string;
  defaultAmount?: number;
  defaultDescription?: string;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  actionCard?: ActionCardData;
  timestamp: string;
}

export function CopilotChat() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: "👋 Hi! I am your **PayPal Guardian Financial Copilot**.\n\nI have real-time visibility into your PayPal balance, upcoming recurring bills, and mathematical 90-day cash flow projections. Ask me anything or test any purchase!",
      timestamp: "Just now",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: data.reply,
        actionCard: data.actionCard,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: "I encountered an error connecting to the financial engine. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAuthorizeOrder = async (itemName: string, amount: number, usePayIn4: boolean) => {
    try {
      setIsProcessingOrder(true);
      setOrderFeedback("Authorizing order through PayPal Sandbox Orders v2 API...");

      const res = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "USD",
          itemName,
          payIn4: usePayIn4,
        }),
      });

      if (!res.ok) throw new Error("Order creation failed");
      const order = await res.json();

      setOrderFeedback(
        usePayIn4
          ? `Order #${order.orderId} Authorized! PayPal Pay in 4 activated (4 payments of $${(amount / 4).toFixed(2)}).`
          : `Order #${order.orderId} Authorized! Paid in full: $${amount.toFixed(2)} USD.`
      );

      if (order.approveUrl) {
        setTimeout(() => {
          window.open(order.approveUrl, "_blank", "noopener,noreferrer");
        }, 800);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to authorize";
      setOrderFeedback(`Order Error: ${message}`);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  if (!mounted || pathname === "/copilot") return null;

  return (
    <>
      {/* Floating Copilot Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold text-xs shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 group"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-cyan-200 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="tracking-wide">Guardian Financial Copilot</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 uppercase tracking-wider font-extrabold">
            AI
          </span>
        </button>
      )}

      {/* Floating Copilot Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] flex flex-col bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-tight">Guardian Copilot</h3>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">PayPal REST v2 &amp; 90-Day Cash Flow Engine</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/copilot"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Open Dedicated Copilot Workspace"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Close Copilot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-md ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  <div className="space-y-1.5">
                    {msg.text.split("\n").map((line, idx) => {
                      if (!line.trim()) return <div key={idx} className="h-1" />;

                      // Detect list items: lines starting with "* " or "• " or "- " or digits like "1. "
                      const listMatch = line.match(/^(\s*)([\*\-•]|\d+\.)\s+(.*)$/);
                      const displayLine = listMatch ? listMatch[3] : line;
                      const isList = !!listMatch;

                      // Format bold **text** into <strong>
                      const renderInline = (text: string) => {
                        const parts = text.split(/(\*\*.*?\*\*)/g);
                        return parts.map((part, pIdx) => {
                          if (part.startsWith("**") && part.endsWith("**")) {
                            return (
                              <strong key={pIdx} className="font-semibold text-white">
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return part;
                        });
                      };

                      if (isList) {
                        return (
                          <p key={idx} className="leading-relaxed flex gap-1.5">
                            <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                            <span>{renderInline(displayLine)}</span>
                          </p>
                        );
                      }
                      return (
                        <p key={idx} className="leading-relaxed">
                          {renderInline(displayLine)}
                        </p>
                      );
                    })}
                  </div>

                  {/* Render Action Card if present */}
                  {msg.actionCard && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-2">
                      {/* Balance Card */}
                      {msg.actionCard.type === "balance" && (
                        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Verified Balance</span>
                            <span className="text-emerald-400 font-bold font-mono text-xs">
                              ${msg.actionCard.balance?.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Safety Buffer Floor</span>
                            <span className="text-amber-400 font-mono font-medium">
                              ${msg.actionCard.buffer?.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Safe Discretionary Spend</span>
                            <span className="text-cyan-400 font-bold font-mono">
                              ${msg.actionCard.discretionary?.toFixed(2)}
                            </span>
                          </div>
                          <Link
                            href="/dashboard"
                            className="mt-2 block text-center py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-[11px] border border-blue-500/30 transition"
                          >
                            Open AG Grid Financial Command →
                          </Link>
                        </div>
                      )}

                      {/* Affordability Simulation Card */}
                      {msg.actionCard.type === "affordability" && (
                        <div className="bg-slate-950/80 rounded-xl p-3 border border-indigo-900/50 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{msg.actionCard.item}</span>
                            <span className="font-mono font-bold text-white">
                              ${msg.actionCard.amount?.toFixed(2)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block mb-0.5">Pay in Full Dip</span>
                              <span
                                className={`font-mono font-bold ${
                                  msg.actionCard.payInFullSafe ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                ${msg.actionCard.payInFullLowest?.toFixed(2)}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/40">
                              <span className="text-indigo-300 block mb-0.5">Pay in 4 Floor</span>
                              <span className="font-mono font-bold text-indigo-300">
                                ${msg.actionCard.payIn4Lowest?.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {msg.actionCard.payIn4Safe && (
                            <button
                              type="button"
                              disabled={isProcessingOrder}
                              onClick={() =>
                                handleAuthorizeOrder(
                                  msg.actionCard?.item || "Product Purchase",
                                  msg.actionCard?.amount || 100,
                                  true
                                )
                              }
                              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow-md transition flex items-center justify-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>
                                {isProcessingOrder
                                  ? "Contacting Sandbox..."
                                  : `Authorize PayPal Pay in 4 ($${msg.actionCard.installment?.toFixed(2)} Today)`}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Invoice Prompt Card */}
                      {msg.actionCard.type === "invoice_prompt" && (
                        <div className="bg-slate-950/80 rounded-xl p-3 border border-indigo-900/50 space-y-2">
                          <div className="flex items-center justify-between text-white font-semibold">
                            <span className="flex items-center gap-1.5 text-indigo-300">
                              <Receipt className="w-4 h-4" />
                              PayPal Invoice (REST v2)
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                              ${msg.actionCard.defaultAmount?.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 space-y-1 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <div><span className="text-slate-400">Recipient:</span> {msg.actionCard.defaultRecipient}</div>
                            <div><span className="text-slate-400">Service:</span> {msg.actionCard.defaultDescription}</div>
                          </div>
                          <Link
                            href="/dashboard"
                            className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-md transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Invoicing Console on Dashboard →</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="block text-[9px] text-slate-400 text-right mt-1 opacity-70">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce delay-200" />
                <span className="text-[11px] text-slate-400 ml-1">Simulating 90-day cash flow...</span>
              </div>
            )}

            {orderFeedback && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
                <span>{orderFeedback}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => handleSend("What is my PayPal balance and safe discretionary spend?")}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 border border-slate-700/60 transition flex items-center gap-1"
            >
              💳 Balance
            </button>
            <button
              type="button"
              onClick={() => handleSend("Can I afford to buy an $850 Sony Camera?")}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 border border-slate-700/60 transition flex items-center gap-1"
            >
              📸 Afford $850?
            </button>
            <button
              type="button"
              onClick={() => handleSend("What recurring bills are coming up this month?")}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 border border-slate-700/60 transition flex items-center gap-1"
            >
              📅 Bills
            </button>
            <button
              type="button"
              onClick={() => handleSend("Draft a PayPal invoice for $450 to my client")}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 border border-slate-700/60 transition flex items-center gap-1"
            >
              🧾 Invoice
            </button>
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-900 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Guardian about your finances or test a purchase..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition shadow-md shadow-blue-500/20 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

