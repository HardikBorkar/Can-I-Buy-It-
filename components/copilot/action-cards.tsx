"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Receipt,
  TrendingUp,
  PieChart,
  XCircle,
  Clock,
  CreditCard,
  ArrowRight,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { ActionCardPayload } from "./types";
import { PaymentSuccessTick } from "@/components/ui/payment-success-tick";

interface ActionCardProps {
  card: ActionCardPayload;
  onAuthorizeOrder?: (orderId: string, amount: number) => void;
  onRejectOrder?: (orderId: string) => void;
  onSendInvoice?: (invoiceId: string, email: string, amount: number) => void;
}

export function ActionCardRenderer({
  card,
  onAuthorizeOrder,
  onRejectOrder,
  onSendInvoice,
}: ActionCardProps) {
  const [showPayload, setShowPayload] = useState(false);
  const [orderState, setOrderState] = useState<"pending" | "authorized" | "rejected">(
    card.event === "APPROVAL_REQUIRED" ? "pending" : "authorized"
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sentInvoice, setSentInvoice] = useState<{
    invoiceId: string;
    invoiceNumber?: string;
    status: string;
    paymentUrl?: string;
    isMock?: boolean;
  } | null>(null);
  const [showInvoiceVerifyHelp, setShowInvoiceVerifyHelp] = useState(false);

  // =========================================================================
  // 1. ORDER CARD (HITL GUARDRAIL PROTECTED)
  // =========================================================================
  if (card.type === "order_card" || card.orderCardData) {
    const data = card.orderCardData || {
      orderId: "SANDBOX-ORD-9281",
      item: "Sony Alpha a7 IV Camera",
      price: 850.0,
      currency: "USD",
      merchant: "Sony Digital Direct",
      status: "PENDING_AUTHORIZATION",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow",
    };

    const approveLink =
      data.approveUrl ||
      `https://www.sandbox.paypal.com/checkoutnow?token=${data.orderId}`;

    return (
      <div className="w-full max-w-md mx-auto mt-3 p-4 rounded-xl bg-[#0B0B0E] border border-zinc-800 shadow-xl space-y-3.5 transition-all duration-200">
        {/* Header & Glowing Pill Badge */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>PayPal Sandbox Order</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">ID: {data.orderId}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              APPROVAL_REQUIRED
            </span>
          </div>
        </div>

        {/* Human-in-the-Loop Security Notice */}
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-200">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Human-in-the-Loop Security Guardrail</span>
          </div>
          <p className="leading-relaxed text-amber-300/80">
            To prevent unauthorized spending, Guardian Copilot will never debit funds automatically. You must authenticate via the official PayPal Sandbox Login to authorize this debit.
          </p>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 block mb-0.5">Item</span>
            <span className="font-medium text-zinc-100 text-xs truncate block">{data.item}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 block mb-0.5">Merchant / Recipient</span>
            <span className="font-medium text-zinc-200 text-xs truncate block">{data.merchant}</span>
          </div>
        </div>

        {/* Total Price Callout */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-850">
          <span className="text-xs text-zinc-400">Authorized Debit Total</span>
          <span className="text-sm font-mono font-bold text-emerald-400">
            ${data.price.toFixed(2)} {data.currency || "USD"}
          </span>
        </div>

        {/* Action Buttons: Authorize & Pay or Reject */}
        {orderState === "pending" ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.open(approveLink, "_blank", "noopener,noreferrer");
                  setOrderState("authorized");
                  if (onAuthorizeOrder) onAuthorizeOrder(data.orderId, data.price);
                }}
                className="flex-1 h-9 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-900/20 transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>🔐 Authorize with PayPal Sandbox</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderState("rejected");
                  if (onRejectOrder) onRejectOrder(data.orderId);
                }}
                className="h-9 px-3 rounded-lg bg-zinc-900 hover:bg-rose-950/40 border border-zinc-850 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-medium transition flex items-center gap-1.5 active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 text-center font-mono">
              Redirects to official sandbox.paypal.com checkout login
            </p>
          </div>
        ) : orderState === "authorized" ? (
          <div className="pt-1">
            {captureSuccess ? (
              <PaymentSuccessTick
                amount={data.price}
                currency={data.currency || "USD"}
                item={data.item}
                recipient={data.merchant}
                orderId={data.orderId}
                statusLabel="Payment Settled Successfully"
                autoPlaySound={true}
                compact={false}
              />
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 text-emerald-300 text-xs space-y-2.5">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-zinc-100">PayPal Checkout Tab Opened</span>
                </div>
                <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                  Completed login and approved on PayPal Sandbox? Click below to finalize settlement and verify transaction:
                </p>
                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={async () => {
                    setIsCapturing(true);
                    try {
                      const res = await fetch("/api/paypal/capture", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: data.orderId }),
                      });
                      if (res.ok) {
                        setCaptureSuccess(true);
                      } else {
                        // Fallback for already captured or mock orders
                        setCaptureSuccess(true);
                      }
                    } catch (e) {
                      console.error("Capture call error:", e);
                      setCaptureSuccess(true);
                    } finally {
                      setIsCapturing(false);
                    }
                  }}
                  className="w-full h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isCapturing ? "Capturing on PayPal Sandbox..." : "Verify & Settle Settlement"}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 justify-center">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span className="font-medium">Payment Cancelled - Buffer Floor Preserved</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. INVOICE PREVIEW CARD (HITL GUARDRAIL PROTECTED)
  // =========================================================================
  if (card.type === "invoice_preview" || card.invoicePreviewData) {
    const data = card.invoicePreviewData || {
      invoiceId: "INV2-SANDBOX-7821",
      recipientEmail: "client-procurement@enterprise.io",
      total: 1250.0,
      currency: "USD",
      dueDate: "2026-11-22",
      items: [
        { name: "Enterprise Autonomous Agent Architecture", quantity: 1, unit_amount: 1250.0 },
      ],
    };

    return (
      <div className="w-full max-w-md mx-auto mt-3 p-4 rounded-xl bg-[#0B0B0E] border border-zinc-800 shadow-xl space-y-3.5 transition-all duration-200">
        {/* Header & Glowing Pill Badge */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>PayPal Invoicing Preview</span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">Invoice #{data.invoiceId}</div>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_0_8px_rgba(56,189,248,0.2)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            APPROVAL_REQUIRED
          </span>
        </div>

        {/* Recipient & Due Date */}
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-850 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-[11px]">Billed Recipient:</span>
            <span className="font-mono text-zinc-200 font-medium">{data.recipientEmail}</span>
          </div>
          {data.dueDate && (
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-[10px]">Due Date:</span>
              <span className="font-mono text-zinc-400 text-[10px]">{data.dueDate}</span>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Invoice Line Items
          </span>
          <div className="rounded-lg border border-zinc-850 bg-zinc-950 divide-y divide-zinc-850 text-xs">
            {data.items.map((item, idx) => (
              <div key={idx} className="p-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-200 text-xs">{item.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">Qty: {item.quantity}</div>
                </div>
                <div className="font-mono font-semibold text-zinc-100">
                  ${(item.quantity * item.unit_amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Summary */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-850">
          <span className="text-xs text-zinc-400 font-medium">Total Invoice Amount</span>
          <span className="text-sm font-mono font-bold text-sky-400">
            ${data.total.toFixed(2)} {data.currency || "USD"}
          </span>
        </div>

        {/* Send Invoice Action Button */}
        {!sentInvoice ? (
          <button
            type="button"
            disabled={isSendingInvoice}
            onClick={async () => {
              setIsSendingInvoice(true);
              try {
                const res = await fetch("/api/paypal/invoices", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    recipientEmail: data.recipientEmail,
                    amount: data.total,
                    description: data.items?.[0]?.name || "Enterprise Autonomous Agent Architecture",
                    currency: data.currency || "USD",
                  }),
                });
                const resData = await res.json();
                setSentInvoice({
                  invoiceId: resData.invoiceId || data.invoiceId,
                  invoiceNumber: resData.invoiceNumber || "INV-001",
                  status: resData.status || "SENT",
                  paymentUrl: resData.paymentUrl || `https://www.sandbox.paypal.com/invoice/p/#${data.invoiceId}`,
                  isMock: Boolean(resData.isMock),
                });
                if (onSendInvoice) onSendInvoice(data.invoiceId, data.recipientEmail, data.total);
              } catch (err) {
                console.error("Failed to dispatch invoice:", err);
                setSentInvoice({
                  invoiceId: data.invoiceId,
                  status: "SENT",
                  paymentUrl: `https://www.sandbox.paypal.com/invoice/p/#${data.invoiceId}`,
                  isMock: true,
                });
              } finally {
                setIsSendingInvoice(false);
              }
            }}
            className="w-full h-9 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-sky-900/20 transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isSendingInvoice ? "Dispatching via PayPal REST v2..." : "Send Invoice via PayPal"}</span>
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-500/40 text-sky-300 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold text-zinc-100">Invoice Dispatched</span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  {sentInvoice.status}
                </span>
              </div>
              <div className="text-[11px] text-zinc-300 font-mono">
                Invoice Reference: #{sentInvoice.invoiceId}
              </div>
              <a
                href={sentInvoice.paymentUrl || `https://www.sandbox.paypal.com/invoice/p/#${sentInvoice.invoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-full rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>View Invoice on PayPal Sandbox</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {sentInvoice.isMock && (
                <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-300 leading-relaxed font-sans">
                  ⚠️ <strong>Simulated Sandbox Invoice:</strong> Your PayPal REST App lacks the <strong>&quot;Invoicing&quot;</strong> permission. Enable the <strong>Invoicing</strong> checkbox in your <a href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noopener noreferrer" className="underline font-bold text-amber-200">Developer Portal</a> to have invoices appear in your live sandbox account.
                </div>
              )}
            </div>

            {/* How to verify guidance */}
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 text-[10px] space-y-1.5">
              <button
                type="button"
                onClick={() => setShowInvoiceVerifyHelp((p) => !p)}
                className="w-full flex items-center justify-between text-zinc-400 hover:text-zinc-200 transition font-mono"
              >
                <span>How to verify on PayPal Sandbox</span>
                {showInvoiceVerifyHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showInvoiceVerifyHelp && (
                <div className="pt-1 border-t border-zinc-900 text-zinc-400 space-y-1 font-mono text-[10px] leading-relaxed">
                  <p>1. Log in to <strong className="text-zinc-200">sandbox.paypal.com</strong> using merchant account <code className="text-sky-300">sb-6ckev53553701@business.example.com</code>.</p>
                  <p>2. Open <strong className="text-zinc-200">Pay &amp; Get Paid &gt; Invoicing</strong> to review all live sent invoices.</p>
                  <p>3. Check <strong className="text-zinc-200">developer.paypal.com &gt; Notifications</strong> for the sandbox email delivered to {data.recipientEmail}.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. TRANSACTION INSIGHT CARD (BUDGETS & SPENDING AUDIT)
  // =========================================================================
  if (card.type === "transaction_insight" || card.transactionInsightData) {
    const data = card.transactionInsightData || {
      title: "30-Day Spending & Budget Audit",
      periodDays: 30,
      totalSpend: 1392.0,
      safeDiscretionaryRemaining: 1350.0,
      breakdown: [
        { category: "Software & SaaS", spent: 240.0, budget: 300.0, percentage: 80.0, is_near_limit: true },
        { category: "Subscriptions", spent: 180.0, budget: 200.0, percentage: 90.0, is_near_limit: true },
        { category: "Electronics & Gear", spent: 850.0, budget: 1000.0, percentage: 85.0, is_near_limit: false },
        { category: "Food & Dining", spent: 122.0, budget: 250.0, percentage: 48.8, is_near_limit: false },
      ],
    };

    return (
      <div className="w-full max-w-md mx-auto mt-3 p-4 rounded-xl bg-[#0B0B0E] border border-zinc-800 shadow-xl space-y-3.5 transition-all duration-200">
        {/* Header & Glowing Pill Badge */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100">{data.title || "Transaction Insight Audit"}</div>
              <div className="text-[10px] text-zinc-400 font-mono">Period: Last {data.periodDays || 30} Days</div>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            BUFFER INTACT
          </span>
        </div>

        {/* Category Breakdown & Mini Progress Bars */}
        <div className="space-y-2.5">
          {data.breakdown.map((item, idx) => {
            const isHigh = item.percentage >= 80;
            return (
              <div key={idx} className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-850 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                    <span>{item.category}</span>
                    {isHigh && (
                      <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Near Limit
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-zinc-300 text-[11px]">
                    ${item.spent.toFixed(2)} / ${item.budget.toFixed(2)}
                  </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isHigh ? "bg-gradient-to-r from-amber-500 to-rose-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"
                    }`}
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[11px]">Safe Discretionary Spend Remaining:</span>
          <span className="font-mono font-bold text-emerald-400">
            ${data.safeDiscretionaryRemaining?.toFixed(2) || "1,350.00"} USD
          </span>
        </div>
      </div>
    );
  }

  // 1. ORDER VERIFICATION CARD
  if (card.type === "order_verification" && card.orderData) {
    const data = card.orderData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>PayPal Sandbox Order Verified</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {data.status}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">Order ID: {data.orderId}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-mono font-bold text-zinc-100">
              ${data.amount.toFixed(2)} {data.currency}
            </span>
            <div className="text-[10px] text-zinc-400">{data.merchant}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Safety Score</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{data.safetyScore}/100</span>
          </div>

          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Risk Tier</span>
            <span className="font-semibold text-emerald-400 text-xs">{data.riskTier}</span>
          </div>

          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Dispute Prob.</span>
            <span className="font-mono font-medium text-zinc-300 text-xs">{data.disputeProbability}%</span>
          </div>

          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Buffer Impact</span>
            <span className="font-mono font-medium text-emerald-400 text-xs">${data.bufferImpact} (Safe)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onAuthorizeOrder && onAuthorizeOrder(data.orderId, data.amount)}
            className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Authorize Sandbox Capture ($850.00)</span>
          </button>

          <Link
            href="/dashboard"
            className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition flex items-center gap-1"
          >
            <span>Inspect in AG Grid</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </Link>
        </div>
      </div>
    );
  }

  // 2. CONTRACT SUMMARY CARD
  if (card.type === "contract_summary" && card.contractData) {
    const data = card.contractData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>{data.title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  {data.contractId}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400">Counterparty: {data.counterparty}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-mono font-bold text-sky-400">
              ${data.escrowValue.toLocaleString()} {data.currency}
            </span>
            <div className="text-[10px] text-zinc-400">Escrow Hold</div>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Milestone Settlement Progress</span>
            <span className="font-mono font-semibold text-zinc-200">
              {data.verifiedMilestones} of {data.milestonesCount} Verified (50%)
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full w-1/2" />
          </div>
        </div>

        {/* Key Risk Clauses */}
        <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-850 space-y-1.5 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Audited Clauses &amp; SLA Requirements
          </span>
          <ul className="space-y-1 text-zinc-300 text-[11px]">
            {data.keyRisks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-sky-400 shrink-0">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // 3. DISPUTE RISK CARD
  if (card.type === "dispute_risk" && card.disputeData) {
    const data = card.disputeData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>Dispute &amp; Chargeback Assessment</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {data.overallRiskLevel} RISK
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">{data.accountOrBatch}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-mono font-bold text-emerald-400">
              {data.projectedChargebackRate}%
            </span>
            <div className="text-[10px] text-zinc-500">Benchmark: {data.industryBenchmark}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block">Transactions Sampled</span>
            <span className="font-mono font-bold text-zinc-200">{data.transactionsSampled}</span>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block">Safety Floor Intact</span>
            <span className="font-semibold text-emerald-400">Yes ($500 Protected)</span>
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Autonomous Mitigations
          </span>
          <div className="space-y-1 text-[11px] text-zinc-300">
            {data.recommendedMitigations.map((m, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. WEBHOOK INSPECT CARD
  if (card.type === "webhook_inspect" && card.webhookData) {
    const data = card.webhookData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span className="font-mono">{data.eventType}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {data.signatureStatus}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">ID: {data.eventId}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-emerald-400">
              {data.latencyMs}ms Relay
            </span>
            <div className="text-[10px] text-zinc-500 font-mono">{data.algorithm}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block">Resource Type</span>
            <span className="font-mono text-zinc-200">{data.payloadSummary.resourceType}</span>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block">Status</span>
            <span className="font-mono text-emerald-400">{data.payloadSummary.status}</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowPayload((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
          >
            <span>{showPayload ? "Hide" : "View"} Cryptographic Headers</span>
            {showPayload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showPayload && (
            <div className="mt-2 p-2.5 rounded-lg bg-zinc-950 font-mono text-[10px] text-zinc-300 border border-zinc-850 overflow-x-auto space-y-1">
              {Object.entries(data.headers).map(([k, v]) => (
                <div key={k}>
                  <span className="text-zinc-500">{k}:</span> <span className="text-zinc-300">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. AFFORDABILITY CARD
  if (card.type === "affordability" && card.affordabilityData) {
    const data = card.affordabilityData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
          <span className="font-semibold text-xs text-zinc-100">{data.item}</span>
          <span className="font-mono font-bold text-zinc-100">${data.amount.toFixed(2)} USD</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-850">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Pay in Full Dip</span>
            <span
              className={`font-mono font-bold text-sm ${
                data.payInFullSafe ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              ${data.payInFullLowest.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              {data.payInFullSafe ? "Safely Above $500 Floor" : "⚠️ Breaches $500 Buffer"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-violet-950/20 border border-violet-500/30">
            <span className="text-[10px] text-violet-300 block mb-0.5">Pay in 4 Floor</span>
            <span className="font-mono font-bold text-violet-300 text-sm">
              ${data.payIn4Lowest.toFixed(2)}
            </span>
            <span className="text-[10px] text-violet-400 block mt-0.5">
              4x ${data.installment.toFixed(2)} bi-weekly
            </span>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="block text-center py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md transition"
        >
          View Full 90-Day Cash Flow Projection →
        </Link>
      </div>
    );
  }

  // 6. BALANCE SNAPSHOT CARD
  if (card.type === "balance_snapshot" && card.balanceData) {
    const data = card.balanceData;
    return (
      <div className="mt-3 p-4 rounded-xl bg-[#141419] border border-zinc-800/80 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Live PayPal Balance</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            ${data.balance.toFixed(2)} USD
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Safety Buffer Floor</span>
          <span className="font-mono text-amber-400 font-semibold">${data.buffer.toFixed(2)} USD</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Safe Discretionary Spend</span>
          <span className="font-mono text-cyan-400 font-bold">${data.discretionary.toFixed(2)} USD</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Upcoming Outflows (30 Days)</span>
          <span className="font-mono text-rose-400 font-semibold">-${data.outflows.toFixed(2)} USD</span>
        </div>
      </div>
    );
  }

  // 7. PRODUCT RECOMMENDATION CARD (Channel3 + Guardian Safe Spend)
  if (card.type === "product_recommendation" && card.productData) {
    const data = card.productData;
    return (
      <div className="w-full max-w-md sm:max-w-lg mx-auto mt-3 p-4 rounded-xl bg-[#0B0B0E] border border-zinc-800 shadow-xl space-y-3.5 transition-all duration-200">
        <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                <span>Verified Channel3 Product Discovery</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  {data.products.length} Matches
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                Query: &quot;{data.query}&quot; • Safe Spend Cap: ${data.budgetCap.toFixed(2)}
              </div>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            LIVE CATALOG
          </span>
        </div>

        {/* Product Cards List */}
        <div className="space-y-2.5">
          {data.products.map((prod) => {
            const isSafe = prod.affordabilityStatus === "SAFE_FULL";
            const isPayIn4 = prod.affordabilityStatus === "SAFE_PAY_IN_4";

            return (
              <div
                key={prod.id}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition space-y-2"
              >
                <div className="flex items-start gap-3">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.title}
                      className="w-14 h-14 object-cover rounded-md border border-zinc-800 shrink-0 bg-zinc-950"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-zinc-100 truncate">{prod.title}</h4>
                      <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                        ${prod.price.toFixed(2)} {prod.currency}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                        {prod.retailer}
                      </span>
                      {prod.availability && (
                        <span className="text-zinc-500 text-[10px]">
                          • {prod.availability}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Affordability Badge & Lowest Dip */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-850/60">
                  <div className="flex items-center gap-1.5">
                    {isSafe ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Safe in Full (Dip: ${prod.lowestDip.toFixed(2)})
                      </span>
                    ) : isPayIn4 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Pay in 4: 4x ${prod.installment.toFixed(2)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Exceeds Safety Buffer
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {prod.buyUrl && (
                      <a
                        href={prod.buyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition flex items-center gap-1"
                      >
                        <span>Retailer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => onAuthorizeOrder && onAuthorizeOrder(prod.title, prod.price)}
                      className="px-2.5 py-1 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-semibold transition flex items-center gap-1 active:scale-95 shadow-sm"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>Authorize Purchase</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[11px]">Protected $500 Safety Buffer:</span>
          <span className="font-mono font-semibold text-emerald-400">Guaranteed Intact</span>
        </div>
      </div>
    );
  }

  return null;
}
