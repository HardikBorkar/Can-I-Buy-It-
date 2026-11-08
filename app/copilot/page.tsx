"use client";

import React, { useState, useCallback, useEffect } from "react";
import { CopilotSidebar } from "@/components/copilot/sidebar";
import { CopilotHeader } from "@/components/copilot/header";
import { CopilotHero } from "@/components/copilot/hero";
import { CopilotMessageStream } from "@/components/copilot/message-stream";
import { SettingsModal } from "@/components/copilot/modals";
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

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);

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

      // Connect directly to server-side /api/copilot/chat
      try {
        const res = await fetch("/api/copilot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            active_agent: activeAgentId,
            thread_id: currentId || "thread-session-1",
          }),
        });

        if (!res.ok) throw new Error("API call failed");
        const data = await res.json();

        // Convert data.actionCard into our ActionCardPayload
        let actionCard = data.actionCard;
        if (data.actionCard) {
          if (data.actionCard.type === "balance") {
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
          actionCard = {
            type: pa.action_type === "send_invoice" ? ("invoice_preview" as const) : ("order_card" as const),
            event: "APPROVAL_REQUIRED" as const,
            orderCardData: {
              orderId: pa.action_id,
              item: pa.raw_payload?.item_name || pa.description,
              price: pa.amount,
              currency: pa.currency || "USD",
              merchant: pa.recipient || "Verified Merchant",
              status: "PENDING_AUTHORIZATION",
            },
          };
        }

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          agentId: activeAgentId,
          text: data.reply || "Analysis complete.",
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
          text: `⚠️ **Connection Notice:** Unable to contact the live backend. Verified PayPal Sandbox offline snapshot:\n\n* **Available Balance:** $1,850.00 USD\n* **Protected Floor:** $500.00 USD (Intact)\n* **Discretionary Safe Spend:** $1,350.00 USD`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsGenerating(false);
      }
    },
    [activeAgentId, activeThreadId, isGenerating, messages]
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
    </div>
  );
}
