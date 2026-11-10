import { useState, useCallback, useRef } from "react";
import { ChatMessage, ActionCardPayload, SubAgentId } from "@/components/copilot/types";

export interface StreamStatus {
  status: string;
  message: string;
}

export interface UseCopilotStreamOptions {
  apiEndpoint?: string;
  onActionRequired?: (action: any) => void;
  onError?: (err: Error) => void;
}

export function useCopilotStream(options: UseCopilotStreamOptions = {}) {
  const apiEndpoint = options.apiEndpoint || "/api/py/copilot/chat";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StreamStatus | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      userText: string,
      activeAgent: SubAgentId | string = "guardian-core",
      threadId: string = "thread-session-1"
    ) => {
      if (!userText.trim() || isGenerating) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsGenerating(true);
      setCurrentStatus({ status: "connecting", message: "Connecting to LangGraph agent swarm..." });

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${apiEndpoint}?stream=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: userText,
            active_agent: activeAgent,
            thread_id: threadId,
            user_id: "alex_cro",
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Agent backend responded with HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        // Fallback for standard JSON response if proxy does not support streaming
        if (!contentType.includes("text/event-stream") && response.body) {
          const data = await response.json();
          let actionCard: ActionCardPayload | undefined;
          if (data.pending_action) {
            const pa = data.pending_action;
            actionCard = {
              type: pa.action_type === "send_invoice" ? "invoice_preview" : "order_card",
              event: "APPROVAL_REQUIRED",
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
            agentId: activeAgent as SubAgentId,
            text: data.reply || "Multi-agent analysis complete.",
            actionCard,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setCurrentStatus(null);
          setIsGenerating(false);
          return;
        }

        // SSE Streaming reader
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable.");

        const decoder = new TextDecoder();
        let buffer = "";
        let finalReply = "";
        let actionCard: ActionCardPayload | undefined;
        let pendingHitl: any = null;

        const processBlock = (block: string) => {
          if (!block.trim()) return;
          let currentEvent = "message";
          let dataStr = "";

          const lineParts = block.split(/\r?\n/);
          for (const line of lineParts) {
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

            if (currentEvent === "status") {
              setCurrentStatus({
                status: parsed.status,
                message: parsed.message,
              });
            } else if (currentEvent === "hitl_required") {
              pendingHitl = parsed;
              actionCard = {
                type: parsed.action_type === "send_invoice" ? "invoice_preview" : "order_card",
                event: "APPROVAL_REQUIRED",
                orderCardData: {
                  orderId: parsed.action_id,
                  item: parsed.raw_payload?.item_name || parsed.description,
                  price: parsed.amount,
                  currency: parsed.currency || "USD",
                  merchant: parsed.recipient || "Verified Merchant",
                  status: "PENDING_AUTHORIZATION",
                },
              };
              if (options.onActionRequired) {
                options.onActionRequired(parsed);
              }
            } else if (currentEvent === "card") {
              // Scraped card or preview
              if (parsed.type === "scraped_merchant" && parsed.data) {
                actionCard = {
                  type: "order_card",
                  event: "APPROVAL_REQUIRED",
                  orderCardData: {
                    orderId: `scrape-${Date.now()}`,
                    item: parsed.data.title || "Discovered Product",
                    price: parsed.data.price || 100.0,
                    currency: parsed.data.currency || "USD",
                    merchant: parsed.data.vendor_name || "Online Merchant",
                    status: "PENDING_AUTHORIZATION",
                  },
                };
              }
            } else if (currentEvent === "message") {
              if (parsed.reply) {
                finalReply = parsed.reply;
              }
            } else if (currentEvent === "done") {
              setCurrentStatus(null);
            }
          } catch (err) {
            console.warn("Failed to parse SSE JSON block:", err, dataStr);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n\r?\n/);
          buffer = lines.pop() || "";

          for (const block of lines) {
            processBlock(block);
          }
        }

        if (buffer.trim()) {
          processBlock(buffer);
        }

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          agentId: activeAgent as SubAgentId,
          text: finalReply || "Multi-agent consensus validation complete.",
          actionCard,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Copilot stream aborted by user");
        } else {
          console.warn("Copilot SSE stream error:", err);
          const fallbackMsg: ChatMessage = {
            id: `asst-${Date.now()}`,
            sender: "assistant",
            agentId: activeAgent as SubAgentId,
            text: `⚠️ **Connection Notice:** Unable to reach FastAPI LangGraph multi-agent backend.\n\n* **Status:** Offline fallback active\n* **Target:** ${apiEndpoint}\n* **Details:** ${err?.message || "Network error"}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, fallbackMsg]);
          if (options.onError) options.onError(err);
        }
      } finally {
        setIsGenerating(false);
        setCurrentStatus(null);
      }
    },
    [apiEndpoint, isGenerating, options]
  );

  const decideAction = useCallback(
    async (actionId: string, decision: "approve" | "reject", feedback?: string) => {
      try {
        const res = await fetch(`/api/actions/${actionId}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, feedback }),
        });
        if (!res.ok) {
          throw new Error(`Failed to decide action: ${res.statusText}`);
        }
        return await res.json();
      } catch (err) {
        console.error("Action decision error:", err);
        throw err;
      }
    },
    []
  );

  return {
    messages,
    setMessages,
    isGenerating,
    currentStatus,
    sendMessage,
    decideAction,
  };
}
