"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Wallet,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Send,
  ExternalLink,
  Code2,
  X,
} from "lucide-react";
import { AgGridTransactions, TransactionRow } from "@/components/ag-grid-transactions";
import { AgGridCommitments, CommitmentRow } from "@/components/ag-grid-commitments";
import { ProjectionChart } from "@/components/projection-chart";
import { AsciiArt } from "@/components/ui/ascii-art";

interface DashboardData {
  account: {
    email: string;
    balance: number;
    currency: string;
    safetyBuffer: number;
    discretionarySpend: number;
    mode: string;
  };
  commitments: CommitmentRow[];
  transactions: TransactionRow[];
  timeline: Array<{
    dayIndex: number;
    date: string;
    displayDate: string;
    baselineBalance: number;
    safetyFloor: number;
    isDanger: boolean;
  }>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transactions" | "commitments" | "invoicing">("transactions");
  const [showAsciiModal, setShowAsciiModal] = useState(false);

  // Agent Simulator state
  const [itemName, setItemName] = useState("Sony Alpha a7 IV Camera");
  const [itemAmount, setItemAmount] = useState(850.0);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  // Invoicing state
  const [invRecipient, setInvRecipient] = useState("client@venturecap.io");
  const [invAmount, setInvAmount] = useState(450.0);
  const [invDescription, setInvDescription] = useState("Brand Strategy & UI Consulting");
  const [invNote, setInvNote] = useState("Billed via PayPal Guardian Agent");
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{
    id: string;
    number: string;
    status: string;
    paymentUrl: string;
    amount: number;
    recipient: string;
    isMock: boolean;
  } | null>(null);

  // Read URL query params passed from Storefront
  useEffect(() => {
    const itemParam = searchParams.get("item");
    const amountParam = searchParams.get("amount");
    if (itemParam) setItemName(itemParam);
    if (amountParam && !isNaN(parseFloat(amountParam))) {
      setItemAmount(parseFloat(amountParam));
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/data");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute 90-day simulation verdict for candidate purchase
  const simulationVerdict = useMemo(() => {
    if (!data || !data.timeline) return null;

    const safetyBuffer = data.account.safetyBuffer || 500;
    const installment = Math.round((itemAmount / 4) * 100) / 100;

    let payInFullLowest = Infinity;
    let payInFullBreachDay: number | null = null;

    let payIn4Lowest = Infinity;
    let payIn4BreachDay: number | null = null;

    for (const d of data.timeline) {
      // Pay In Full
      const pFull = d.baselineBalance - itemAmount;
      if (pFull < payInFullLowest) payInFullLowest = pFull;
      if (pFull < safetyBuffer && payInFullBreachDay === null) {
        payInFullBreachDay = d.dayIndex;
      }

      // Pay In 4
      let installmentsPaid = installment;
      if (d.dayIndex >= 14) installmentsPaid += installment;
      if (d.dayIndex >= 28) installmentsPaid += installment;
      if (d.dayIndex >= 42) installmentsPaid += installment;

      const p4 = d.baselineBalance - installmentsPaid;
      if (p4 < payIn4Lowest) payIn4Lowest = p4;
      if (p4 < safetyBuffer && payIn4BreachDay === null) {
        payIn4BreachDay = d.dayIndex;
      }
    }

    const payInFullSafe = payInFullBreachDay === null;
    const payIn4Safe = payIn4BreachDay === null;

    return {
      payInFullSafe,
      payInFullLowest: Math.round(payInFullLowest * 100) / 100,
      payInFullBreachDay,
      payIn4Safe,
      payIn4Lowest: Math.round(payIn4Lowest * 100) / 100,
      payIn4BreachDay,
      installment,
    };
  }, [data, itemAmount]);

  // Execute PayPal Orders v2 transaction directly from simulation
  const handleSimulatedOrder = async (usePayIn4: boolean) => {
    try {
      setOrderProcessing(true);
      setOrderResult("Contacting PayPal Sandbox Orders v2 API...");

      const res = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: itemAmount,
          currency: "USD",
          itemName,
          payIn4: usePayIn4,
        }),
      });

      if (!res.ok) {
        throw new Error(`Order API responded with status ${res.status}`);
      }

      const resData = await res.json();
      setOrderResult(
        usePayIn4
          ? `Order #${resData.orderId} Authorized! PayPal Pay in 4 activated (4 installments of $${resData.installmentAmount?.toFixed(2) || (itemAmount / 4).toFixed(2)}).`
          : `Order #${resData.orderId} Authorized! Paid in full: $${itemAmount.toFixed(2)} USD.`
      );

      // Dynamically add to the AG Grid transaction stream
      if (data) {
        const newRow: TransactionRow = {
          id: resData.orderId,
          date: new Date().toISOString().split("T")[0],
          description: itemName,
          category: "Shopping",
          amount: -itemAmount,
          paymentMethod: usePayIn4 ? "PAY_IN_4" : "PAY_IN_FULL",
          status: "COMPLETED",
          payer: "Verified Merchant Account",
        };
        setData({
          ...data,
          transactions: [newRow, ...data.transactions],
        });
      }

      if (resData.approveUrl) {
        setTimeout(() => {
          window.open(resData.approveUrl, "_blank", "noopener,noreferrer");
        }, 800);
      }
    } catch (err: any) {
      setOrderResult(`Error: ${err.message || "Failed to create PayPal Order"}`);
    } finally {
      setOrderProcessing(false);
    }
  };

  // Dispatch an official PayPal Invoice v2
  const handleDispatchInvoice = async () => {
    try {
      setIsSendingInvoice(true);
      setInvoiceResult(null);

      const res = await fetch("/api/paypal/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: invRecipient,
          amount: invAmount,
          description: invDescription,
          note: invNote,
        }),
      });

      const invData = await res.json();
      if (!res.ok) {
        throw new Error(invData.error || "Failed to create invoice");
      }

      setInvoiceResult(invData);

      // Append to the AG Grid transactions stream
      if (data) {
        const newTx: TransactionRow = {
          id: invData.invoiceId,
          date: new Date().toISOString().split("T")[0],
          description: `Invoice: ${invDescription}`,
          category: "Income",
          amount: invAmount,
          paymentMethod: "DIRECT_TRANSFER",
          status: "COMPLETED",
          payer: invRecipient,
        };
        setData({
          ...data,
          transactions: [newTx, ...data.transactions],
        });
      }
    } catch (err: any) {
      alert("Invoice Dispatch Error: " + err.message);
    } finally {
      setIsSendingInvoice(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center text-[#8ea9cb] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#0070BA]" />
        <p className="text-sm font-medium">Connecting to PayPal Sandbox &amp; AG Grid Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#060c18] text-slate-100">
      {/* Top Header - Solid PayPal Enterprise Styling */}
      <header className="border-b border-[#172b4d] bg-[#081222] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-xs font-medium text-[#cbd5e1] border border-[#172b4d] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </Link>

            <div className="h-4 w-px bg-[#172b4d] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">
                PayPal Guardian <span className="text-[#38bdf8]">Financial Command</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#002952] border border-[#00457C] text-[#38bdf8] font-semibold">
                AG Grid v36 Native
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* ASCII Monogram Modal Trigger */}
            <button
              onClick={() => setShowAsciiModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0c182e] hover:bg-[#122344] text-[#38bdf8] border border-[#172b4d] font-mono text-[11px] transition"
              title="Inspect ASCII Art PayPal Monogram"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>ASCII Logo</span>
            </button>

            {/* Sanitized Sandbox Status Badge (No Raw Email) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#064e3b] border border-[#059669]/60 text-[#34d399]">
              <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
              <span className="font-semibold text-xs">PayPal Sandbox Connected</span>
            </div>

            <button
              onClick={fetchDashboardData}
              className="p-1.5 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#8ea9cb] hover:text-white border border-[#172b4d] transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards Row - Solid PayPal Palette */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Live Balance */}
          <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between text-[#8ea9cb] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">PayPal Sandbox Balance</span>
              <Wallet className="w-4 h-4 text-[#38bdf8]" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              ${data.account.balance.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] text-[#34d399] flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              <span>Live REST API v2 Synchronized</span>
            </div>
          </div>

          {/* Committed Bills Next 30d */}
          <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between text-[#8ea9cb] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Committed Outflows (30d)</span>
              <Calendar className="w-4 h-4 text-[#93c5fd]" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              $1,392.00
            </div>
            <div className="mt-1 text-[11px] text-[#8ea9cb]">
              Rent, AWS, software &amp; health auto-pays
            </div>
          </div>

          {/* Safe Discretionary Spend */}
          <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between text-[#8ea9cb] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Safe Discretionary Spend</span>
              <TrendingUp className="w-4 h-4 text-[#34d399]" />
            </div>
            <div className="text-2xl font-black text-[#34d399] font-mono">
              ${data.account.discretionarySpend.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] text-[#8ea9cb]">
              Available without breaching $500 safety floor
            </div>
          </div>

          {/* Safety Buffer Guardrail */}
          <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between text-[#8ea9cb] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Safety Buffer Floor</span>
              <ShieldAlert className="w-4 h-4 text-[#fbbf24]" />
            </div>
            <div className="text-2xl font-black text-[#fbbf24] font-mono">
              ${data.account.safetyBuffer.toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] text-[#fbbf24] flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3 h-3 text-[#fbbf24]" />
              <span>Autonomous Overdraft Prevention</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* INTERACTIVE AGENT SIMULATOR: "CAN I BUY IT?" */}
        {/* WITH PAYPAL LOGO ASCII ART WATERMARK IN BACKGROUND */}
        {/* =================================================================== */}
        <div className="relative overflow-hidden bg-[#0b1629] border border-[#1a335a] rounded-2xl p-6 shadow-xl space-y-4">
          {/* Subtle ASCII Art Watermark of PayPal Logo */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none select-none max-w-[260px] hidden lg:block overflow-hidden">
            <AsciiArt
              src="/paypal-logo.svg"
              resolution={60}
              color="#0079C1"
              animationStyle="fade"
              animationDuration={1.2}
              animateOnView={false}
              className="w-full aspect-square"
            />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00457C] border border-[#0070BA] flex items-center justify-center text-[#38bdf8]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Autonomous Decision Engine: &ldquo;Can I Afford It?&rdquo;
                </h3>
                <p className="text-xs text-[#8ea9cb]">
                  Simulates 90 days forward across upcoming bills before creating a PayPal order.
                </p>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748b] hidden md:inline">Presets:</span>
              <button
                onClick={() => {
                  setItemName("Sony Alpha a7 IV Camera");
                  setItemAmount(850.0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
              >
                Sony Camera ($850)
              </button>
              <button
                onClick={() => {
                  setItemName("MacBook Pro M3");
                  setItemAmount(1299.0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
              >
                MacBook ($1,299)
              </button>
              <button
                onClick={() => {
                  setItemName("AirPods Max");
                  setItemAmount(540.0);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
              >
                AirPods ($540)
              </button>
            </div>
          </div>

          {/* Input Controls */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Candidate Purchase Item</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white focus:outline-none focus:border-[#0070BA] transition"
                placeholder="Product title from Channel3 or store..."
              />
            </div>
            <div>
              <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Total Amount (USD)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8ea9cb]" />
                <input
                  type="number"
                  step="10"
                  min="1"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white font-mono focus:outline-none focus:border-[#0070BA] transition"
                />
              </div>
            </div>
          </div>

          {/* Real-Time Mathematical Verdict */}
          {simulationVerdict && (
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Option A: Pay in Full */}
              <div
                className={`p-4 rounded-xl border transition ${
                  simulationVerdict.payInFullSafe
                    ? "bg-[#070e1b] border-[#162846]"
                    : "bg-[#450a0a]/30 border-[#b91c1c]/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Plan A: Pay in Full (${itemAmount.toFixed(2)})
                  </span>
                  {simulationVerdict.payInFullSafe ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#34d399] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Safe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[#f87171] font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Breaches Buffer
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#cbd5e1] mb-3">
                  {simulationVerdict.payInFullSafe ? (
                    `Your balance remains safe above the $500 threshold (lowest balance: $${simulationVerdict.payInFullLowest.toFixed(
                      2
                    )}).`
                  ) : (
                    <>
                      ⚠️ Dips to{" "}
                      <strong className="text-[#f87171] font-mono">
                        ${simulationVerdict.payInFullLowest.toFixed(2)}
                      </strong>{" "}
                      on Day +{simulationVerdict.payInFullBreachDay} when rent hits, violating your $500 minimum floor.
                    </>
                  )}
                </p>

                <button
                  disabled={orderProcessing}
                  onClick={() => handleSimulatedOrder(false)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition ${
                    simulationVerdict.payInFullSafe
                      ? "bg-[#0c182e] hover:bg-[#122344] text-white border border-[#172b4d]"
                      : "bg-[#070e1b] hover:bg-[#0c182e] text-[#8ea9cb] border border-[#162846]"
                  }`}
                >
                  {orderProcessing ? "Processing..." : `Pay in Full ($${itemAmount.toFixed(2)})`}
                </button>
              </div>

              {/* Option B: PayPal Pay in 4 */}
              <div
                className={`p-4 rounded-xl border transition ${
                  simulationVerdict.payIn4Safe
                    ? "bg-[#002244]/40 border-[#0070BA]"
                    : "bg-[#070e1b] border-[#162846]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#93c5fd] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#38bdf8]" />
                    Plan B: PayPal Pay in 4 (4x ${simulationVerdict.installment.toFixed(2)})
                  </span>
                  {simulationVerdict.payIn4Safe && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#38bdf8] font-bold bg-[#00457C]/40 px-2 py-0.5 rounded-full border border-[#0070BA]">
                      <Sparkles className="w-3 h-3 text-[#38bdf8]" /> Recommended
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#cbd5e1] mb-3">
                  {simulationVerdict.payIn4Safe ? (
                    <>
                      ✅ Spreading payments every 2 weeks maintains a healthy lowest balance of{" "}
                      <strong className="text-[#38bdf8] font-mono">
                        ${simulationVerdict.payIn4Lowest.toFixed(2)}
                      </strong>
                      , 100% protecting your safety floor!
                    </>
                  ) : (
                    `Installments still dip balance below $500 threshold.`
                  )}
                </p>

                <button
                  disabled={orderProcessing}
                  onClick={() => handleSimulatedOrder(true)}
                  className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-[#0070BA] hover:bg-[#005ea6] text-white shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {orderProcessing
                      ? "Processing..."
                      : `Authorize PayPal Pay in 4 ($${simulationVerdict.installment.toFixed(2)} Today)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Order Feedback Alert */}
          {orderResult && (
            <div className="relative z-10 p-3 rounded-xl bg-[#002952] border border-[#0070BA] text-[#93c5fd] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#38bdf8]" />
              <span>{orderResult}</span>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* 90-DAY PROJECTION CHART */}
        {/* =================================================================== */}
        <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">90-Day Cash Flow Trajectory &amp; Simulation</h3>
              <p className="text-xs text-[#8ea9cb]">
                Visualizing daily balance against recurring bills and minimum safety threshold ($500).
              </p>
            </div>
            <div className="text-xs text-[#64748b] hidden sm:block">
              Green = Baseline • Red = Full Pay Impact • Blue = Pay in 4 Safe Curve
            </div>
          </div>

          <ProjectionChart
            data={data.timeline}
            candidateAmount={itemAmount}
            showComparison={itemAmount > 0}
          />
        </div>

        {/* =================================================================== */}
        {/* TABS: TRANSACTIONS / RECURRING COMMITMENTS / INVOICING */}
        {/* =================================================================== */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#172b4d] pb-2 gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === "transactions"
                    ? "bg-[#0070BA] text-white"
                    : "bg-[#0b1629] text-[#8ea9cb] hover:text-white border border-[#172b4d]"
                }`}
              >
                PayPal Transaction Stream ({data.transactions.length})
              </button>
              <button
                onClick={() => setActiveTab("commitments")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === "commitments"
                    ? "bg-[#0070BA] text-white"
                    : "bg-[#0b1629] text-[#8ea9cb] hover:text-white border border-[#172b4d]"
                }`}
              >
                Recurring Commitments ({data.commitments.length})
              </button>
              <button
                onClick={() => setActiveTab("invoicing")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === "invoicing"
                    ? "bg-[#003087] text-white border border-[#0070BA]"
                    : "bg-[#0b1629] text-[#8ea9cb] hover:text-white border border-[#172b4d]"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Create PayPal Invoice (v2)</span>
              </button>
            </div>

            <div className="text-xs text-[#8ea9cb] hidden sm:flex items-center gap-1.5">
              <span>AG Grid Community v36</span>
              <span>•</span>
              <span>Live Invoicing v2</span>
            </div>
          </div>

          {/* Render Active View */}
          {activeTab === "transactions" && (
            <AgGridTransactions transactions={data.transactions} />
          )}

          {activeTab === "commitments" && (
            <AgGridCommitments commitments={data.commitments} />
          )}

          {activeTab === "invoicing" && (
            <div className="bg-[#0b1629] border border-[#172b4d] rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172b4d] pb-4">
                <div>
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#38bdf8]" />
                    <span>Autonomous PayPal Invoicing v2 Generator</span>
                  </h4>
                  <p className="text-xs text-[#8ea9cb]">
                    Draft and dispatch official PayPal invoices. Successful payments reflect in your 90-day cash flow stream.
                  </p>
                </div>

                {/* Invoicing Presets */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#64748b] hidden md:inline">Templates:</span>
                  <button
                    onClick={() => {
                      setInvDescription("Brand Strategy & UI Consulting");
                      setInvAmount(450.0);
                      setInvRecipient("client@venturecap.io");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
                  >
                    UI Consulting ($450)
                  </button>
                  <button
                    onClick={() => {
                      setInvDescription("Full-Stack AI Agent Development");
                      setInvAmount(1200.0);
                      setInvRecipient("founder@stealth.ai");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
                  >
                    AI Agent Build ($1,200)
                  </button>
                  <button
                    onClick={() => {
                      setInvDescription("Monthly Technical Retainer");
                      setInvAmount(350.0);
                      setInvRecipient("billing@client.com");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c182e] hover:bg-[#122344] text-[#cbd5e1] border border-[#172b4d] transition"
                  >
                    Retainer ($350)
                  </button>
                </div>
              </div>

              {/* Invoicing Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Recipient Client Email</label>
                  <input
                    type="email"
                    value={invRecipient}
                    onChange={(e) => setInvRecipient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white focus:outline-none focus:border-[#0070BA] transition"
                    placeholder="client@company.com"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Invoice Amount (USD)</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8ea9cb]" />
                    <input
                      type="number"
                      step="25"
                      min="1"
                      value={invAmount}
                      onChange={(e) => setInvAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white font-mono focus:outline-none focus:border-[#0070BA] transition"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Deliverable / Description</label>
                  <input
                    type="text"
                    value={invDescription}
                    onChange={(e) => setInvDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white focus:outline-none focus:border-[#0070BA] transition"
                    placeholder="Description of work performed..."
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs text-[#8ea9cb] font-medium mb-1 block">Note to Client</label>
                  <input
                    type="text"
                    value={invNote}
                    onChange={(e) => setInvNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1b] border border-[#162846] text-sm text-white focus:outline-none focus:border-[#0070BA] transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={isSendingInvoice}
                  onClick={handleDispatchInvoice}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0070BA] hover:bg-[#005ea6] text-white transition flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingInvoice ? "Dispatching via PayPal REST v2..." : "Dispatch PayPal Invoice"}</span>
                </button>

                <p className="text-[11px] text-[#64748b]">
                  Sends directly to recipient with PayPal Buyer Protection &amp; one-click checkout.
                </p>
              </div>

              {/* Invoice Feedback */}
              {invoiceResult && (
                <div className="p-4 rounded-xl bg-[#002952] border border-[#0070BA] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#93c5fd] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#34d399]" />
                      Invoice #{invoiceResult.number} Successfully Dispatched!
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#064e3b] text-[#34d399] border border-[#059669]/60 font-mono">
                      {invoiceResult.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#cbd5e1]">
                    Billed <strong className="text-white">${invoiceResult.amount.toFixed(2)} USD</strong> to{" "}
                    <span className="text-[#38bdf8]">{invoiceResult.recipient}</span>. Automatically recorded in the AG Grid transaction stream!
                  </p>

                  <div className="pt-2 flex items-center gap-3">
                    <a
                      href={invoiceResult.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#38bdf8] hover:text-[#93c5fd] underline font-medium"
                    >
                      <span>Open PayPal Payer View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ASCII Art Inspection Modal */}
      {showAsciiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#070e1b] border border-[#172b4d] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#172b4d] pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#0079C1]" />
                <h3 className="text-sm font-bold text-white">PayPal Monogram — Real-Time ASCII Art</h3>
              </div>
              <button
                onClick={() => setShowAsciiModal(false)}
                className="p-1 rounded-lg text-[#8ea9cb] hover:text-white hover:bg-[#0c182e] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#050912] rounded-2xl p-6 border border-[#11203a] flex items-center justify-center">
              <AsciiArt
                src="/paypal-logo.svg"
                resolution={95}
                color="#0079C1"
                animationStyle="fade"
                animationDuration={1.0}
                animateOnView={false}
                className="w-full max-w-lg aspect-square"
              />
            </div>

            <p className="text-xs text-[#8ea9cb] text-center">
              Generated via canvas pixel luminance mapping with official PayPal brand color <span className="font-mono text-[#0079C1]">#0079C1</span>.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#172b4d] bg-[#081222] py-6 text-xs text-[#64748b] text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PayPal Guardian AI — Built with AG Grid v36, Channel3 SDK, and PayPal REST v2 APIs.</p>
          <div className="flex items-center gap-4 text-[#8ea9cb]">
            <span>AG Grid React</span>
            <span>•</span>
            <span>PayPal Pay in 4</span>
            <span>•</span>
            <span>Invoicing v2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060c18] flex flex-col items-center justify-center text-[#8ea9cb] gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0070BA]" />
          <p className="text-sm font-medium">Loading PayPal Guardian...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
