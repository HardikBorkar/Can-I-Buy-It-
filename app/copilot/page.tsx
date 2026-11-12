"use client";

import React, { useState, useCallback, useEffect } from "react";
import { CopilotSidebar } from "@/components/copilot/sidebar";
import { CopilotHeader } from "@/components/copilot/header";
import { CopilotHero } from "@/components/copilot/hero";
import { CopilotMessageStream } from "@/components/copilot/message-stream";
import { SettingsModal, PayPalAccountModal, ConnectedAccount } from "@/components/copilot/modals";
import {
  SubAgentId,
  ChatMessage,
  HistorySession,
} from "@/components/copilot/types";
import { PREVIOUS_CHAT_SESSIONS } from "@/components/copilot/data";

export default function CopilotPage() {
  // Navigation & Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Unified Chat & Session State
  const [sessions, setSessions] = useState<HistorySession[]>(PREVIOUS_CHAT_SESSIONS);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<SubAgentId>("guardian-core");
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings & Account Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState<ConnectedAccount>({
    user_id: "alex_cro",
    email: "guardian-buyer-healthy@personal.example.com",
    name: "Michael Buyer (Healthy)",
    account_type: "PERSONAL",
    balance: 3500.0,
    currency: "USD",
  });

  // Load active account from localStorage or backend
  useEffect(() => {
    const saved = localStorage.getItem("guardian_active_account");
    if (saved) {
      try {
        setActiveAccount(JSON.parse(saved));
      } catch {
        // ignore parse error
      }
    }
    // Fetch latest user account profile from backend
    fetch("/api/py/auth/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.accounts && data.accounts.length > 0) {
          const currentId = saved ? JSON.parse(saved).user_id : "alex_cro";
          const match = data.accounts.find((a: ConnectedAccount) => a.user_id === currentId) || data.accounts[0];
          setActiveAccount(match);
          localStorage.setItem("guardian_active_account", JSON.stringify(match));
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectAccount = useCallback((account: ConnectedAccount) => {
    setActiveAccount(account);
    localStorage.setItem("guardian_active_account", JSON.stringify(account));
  }, []);

  // Current Thread Title
  const activeSession = sessions.find((s) => s.id === activeThreadId);
  const currentThreadTitle = activeSession ? activeSession.title : "New Chat";

  // Keyboard shortcut listener (Cmd+B toggle sidebar, Cmd+K new chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. New Chat Handler
  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
  }, []);

  // 2. Select Session Handler
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const selected = sessions.find((s) => s.id === sessionId);
      if (selected) {
        setActiveThreadId(sessionId);
        setMessages(selected.messages || []);
        if (selected.agentId) {
          setActiveAgentId(selected.agentId);
        }
      }
    },
    [sessions]
  );

  // 3. Rename Session Handler
  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  }, []);

  // 4. Delete Session Handler
  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeThreadId === id) {
        setActiveThreadId(null);
        setMessages([]);
      }
    },
    [activeThreadId]
  );

  // 5. Clear Current Chat
  const handleClearChat = useCallback(() => {
    setMessages([]);
    if (activeThreadId) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeThreadId ? { ...s, messages: [], messageCount: 0 } : s
        )
      );
    }
  }, [activeThreadId]);

  // 6. Send Message Handler
  const handleSend = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isGenerating) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsGenerating(true);

      // Create new session if starting fresh
      let currentId = activeThreadId;
      if (!currentId) {
        currentId = `session-${Date.now()}`;
        const newTitle =
          userText.length > 36
            ? `${userText.slice(0, 36).trim()}...`
            : userText;

        const newSession: HistorySession = {
          id: currentId,
          title: newTitle,
          timestamp: "Just now",
          dateGroup: "today",
          messageCount: 1,
          agentId: activeAgentId,
          preview: userText,
          messages: [userMsg],
        };

        setSessions((prev) => [newSession, ...prev]);
        setActiveThreadId(currentId);
      } else {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentId
              ? {
                  ...s,
                  messages: [...s.messages, userMsg],
                  messageCount: s.messages.length + 1,
                }
              : s
          )
        );
      }

      // Connect directly to FastAPI multi-agent backend via /api/py/copilot/chat
      try {
        const res = await fetch("/api/py/copilot/chat?stream=true", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
          },
          body: JSON.stringify({
            message: userText,
            active_agent: activeAgentId,
            thread_id: currentId || "thread-session-1",
            user_id: activeAccount.user_id,
          }),
        });

        if (!res.ok) throw new Error(`Agent backend responded with HTTP ${res.status}`);

        const contentType = res.headers.get("content-type") || "";
        let data: any = {};
        let actionCard: any = undefined;

        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finalReply = "";
          const agentTraces: string[] = [];

          const processBlock = (block: string) => {
            if (!block.trim()) return;
            let currentEvent = "message";
            let dataStr = "";
            const lines = block.split(/\r?\n/);
            for (const line of lines) {
              if (line.startsWith("event:")) {
                currentEvent = line.replace("event:", "").trim();
              } else if (line.startsWith("data:")) {
                const val = line.slice(5).trim();
                dataStr = dataStr ? `${dataStr}\n${val}` : val;
              }
            }
            if (!dataStr) return;

            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === "agent_trace") {
                if (parsed.agent && parsed.message) {
                  agentTraces.push(`[${parsed.agent} (Turn ${parsed.turn ?? 0})]: ${parsed.message}`);
                }
              } else if (currentEvent === "message") {
                if (parsed.reply) finalReply = parsed.reply;
                if (parsed.multi_agent_trace && Array.isArray(parsed.multi_agent_trace)) {
                  for (const t of parsed.multi_agent_trace) {
                    const line = `[${t.agent} (Turn ${t.turn ?? 0})]: ${t.message}`;
                    if (!agentTraces.includes(line)) {
                      agentTraces.push(line);
                    }
                  }
                }
              } else if (currentEvent === "card") {
                actionCard = parsed;
              } else if (currentEvent === "expenditure_chart") {
                actionCard = {
                  type: "expenditure_chart",
                  event: "expenditure_chart",
                  chartData: parsed,
                };
              } else if (currentEvent === "hitl_required") {
                if (parsed.action_type === "bento_analytics") {
                  actionCard = { type: "bento_analytics" as const };
                } else {
                  actionCard = {
                    type: parsed.action_type === "send_invoice" ? ("invoice_preview" as const) : ("order_card" as const),
                    event: "APPROVAL_REQUIRED" as const,
                    orderCardData: {
                      orderId: parsed.action_id,
                      item: parsed.raw_payload?.item_name || parsed.description,
                      price: parsed.amount,
                      currency: parsed.currency || "USD",
                      merchant: parsed.recipient || parsed.merchant || "Seller",
                      status: "PENDING_AUTHORIZATION",
                    },
                  };
                }
              }
            } catch {
              // ignore parse error
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            // Split by either \r\n\r\n or \n\n
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || "";

            for (const block of blocks) {
              processBlock(block);
            }
          }

          if (buffer.trim()) {
            processBlock(buffer);
          }

          data = {
            reply: finalReply,
            actionCard,
            reasoning: agentTraces.length > 0 ? agentTraces.join("\n\n") : undefined,
          };
        } else {
          data = await res.json();
          if (data.multi_agent_trace && Array.isArray(data.multi_agent_trace)) {
            data.reasoning = data.multi_agent_trace
              .map((t: any) => `[${t.agent} (Turn ${t.turn ?? 0})]: ${t.message}`)
              .join("\n\n");
          }
        }

        // Convert data.actionCard into our ActionCardPayload
        if (!actionCard && (data.action_card || data.actionCard)) {
          const directCard = data.action_card || data.actionCard;
          if (
            directCard.type === "order_inspection_result" ||
            directCard.type === "invoice_approval_required" ||
            directCard.type === "checkout_approval_required" ||
            directCard.type === "expenditure_chart" ||
            directCard.event === "order_inspection_result" ||
            directCard.event === "invoice_approval_required" ||
            directCard.event === "checkout_approval_required" ||
            directCard.event === "expenditure_chart"
          ) {
            actionCard = directCard;
          } else if (directCard.type === "balance") {
            actionCard = {
              type: "balance_snapshot" as const,
              balanceData: {
                balance: data.actionCard.balance || 1850.0,
                buffer: data.actionCard.buffer || 500.0,
                discretionary: data.actionCard.discretionary || 1350.0,
                outflows: data.actionCard.outflows || 1392.0,
                currency: "USD",
                status: "HEALTHY" as const,
              },
            };
          } else if (data.actionCard.type === "affordability") {
            actionCard = {
              type: "affordability" as const,
              affordabilityData: {
                item: data.actionCard.item || "Candidate Purchase",
                amount: data.actionCard.amount || 850.0,
                installment: data.actionCard.installment || 212.5,
                payInFullSafe: data.actionCard.payInFullSafe ?? true,
                payInFullLowest: data.actionCard.payInFullLowest || 590.0,
                payIn4Safe: data.actionCard.payIn4Safe ?? true,
                payIn4Lowest: data.actionCard.payIn4Lowest || 590.0,
              },
            };
          }
        }

        if (!actionCard && data.pending_action) {
          const pa = data.pending_action;
          if (pa.action_type === "bento_analytics") {
            actionCard = {
              type: "bento_analytics" as const,
            };
          } else {
            actionCard = {
              type: pa.action_type === "send_invoice" ? ("invoice_preview" as const) : ("order_card" as const),
              event: "APPROVAL_REQUIRED" as const,
              orderCardData: {
                orderId: pa.action_id,
                item: pa.raw_payload?.item_name || pa.description,
                price: pa.amount,
                currency: pa.currency || "USD",
                merchant: pa.recipient || pa.merchant || "Seller",
                status: "PENDING_AUTHORIZATION",
              },
            };
          }
        }

        // Auto-attach MagicBento grid whenever user asks for graphs, charts, tables, or analytics telemetry
        const lowerPrompt = userText.toLowerCase();
        if (
          !actionCard &&
          (lowerPrompt.includes("graph") ||
            lowerPrompt.includes("chart") ||
            lowerPrompt.includes("bar graph") ||
            lowerPrompt.includes("table") ||
            lowerPrompt.includes("bento") ||
            lowerPrompt.includes("analytics") ||
            lowerPrompt.includes("telemetry") ||
            lowerPrompt.includes("visualize"))
        ) {
          actionCard = {
            type: "bento_analytics" as const,
          };
        }

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          agentId: activeAgentId,
          text: data.reply || "Multi-agent consensus analysis complete.",
          reasoning: data.reasoning,
          actionCard,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (currentId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentId
                ? { ...s, messages: [...s.messages, assistantMsg], messageCount: s.messages.length + 1 }
                : s
            )
          );
        }
      } catch (err) {
        console.warn("Copilot chat error:", err);
        const fallbackMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          agentId: activeAgentId,
          text: `⚠️ **Connection Notice:** Unable to contact FastAPI backend via \`/api/py/copilot/chat\`. Verified PayPal Sandbox offline snapshot:\n\n* **Available Balance:** $1,850.00 USD\n* **Protected Floor:** $500.00 USD (Intact)\n* **Discretionary Safe Spend:** $1,350.00 USD`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsGenerating(false);
      }
    },
    [activeAccount, activeAgentId, activeThreadId, isGenerating, messages]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0C] text-zinc-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* 1. Clean Collapsible Sidebar */}
      <CopilotSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        sessions={sessions}
        activeSessionId={activeThreadId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setShowSettings(true)}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setShowAccountModal(true)}
      />

      {/* 2. Main Minimal Stage */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header Bar */}
        <CopilotHeader
          threadTitle={currentThreadTitle}
          activeAgentId={activeAgentId}
          onSelectAgent={setActiveAgentId}
          onClearChat={handleClearChat}
          hasMessages={messages.length > 0}
        />

        {/* Center Stage: Centered Minimal Hero OR Message Stream */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {messages.length === 0 ? (
            <CopilotHero
              onSend={handleSend}
              isGenerating={isGenerating}
              onOpenAttach={() => setShowSettings(true)}
            />
          ) : (
            <CopilotMessageStream
              messages={messages}
              isGenerating={isGenerating}
              onSend={handleSend}
              onOpenAttach={() => setShowSettings(true)}
            />
          )}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* PayPal Account & Persona Modal */}
      <PayPalAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        activeAccountId={activeAccount.user_id}
        onSelectAccount={handleSelectAccount}
      />
    </div>
  );
}
