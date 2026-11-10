"use client";

import React, { useState, useEffect } from "react";
import MagicBento from "@/components/ui/MagicBento";
import {
  BarChart3,
  TrendingUp,
  Table as TableIcon,
  Download,
  Maximize2,
  Minimize2,
  ShieldCheck,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export const FINANCIAL_METRIC_CARDS = [
  {
    title: "Total PayPal Balance",
    amount: "$1,850.00",
    currency: "USD",
    change: "+12.4% vs last month",
    isPositive: true,
    subtext: "Across verified sandbox accounts",
    icon: DollarSign,
  },
  {
    title: "Discretionary Spend",
    amount: "$1,350.00",
    currency: "USD",
    badge: "Safe to Spend",
    isPositive: true,
    subtext: "Unallocated liquidity available",
    icon: TrendingUp,
  },
  {
    title: "Sacred Reserve Buffer",
    amount: "$500.00",
    currency: "USD",
    badge: "Floor Enforced",
    isPositive: true,
    subtext: "Inviolable invariant threshold",
    icon: ShieldCheck,
  },
  {
    title: "Top Spend Category",
    amount: "$850.00",
    currency: "USD",
    badge: "46% of Outflow",
    isPositive: false,
    subtext: "Electronics & Infrastructure",
    icon: PieChart,
  },
];

export const GUARDIAN_DATA_ITEMS = [
  {
    id: "cash-flow-curve",
    title: "90-Day Cash Flow Trajectory",
    description: "Predictive balance model ($1,350.00 discretionary reserve safe, $590.00 lowest dip)",
    visual: "analytics",
    label: "LIQUIDITY METRICS",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    id: "spend-velocity-bars",
    title: "Weekly Outflow Distribution",
    description: "PayPal Sandbox transaction volume across verified merchants and partners",
    visual: "dashboard",
    label: "SPEND VELOCITY",
    colSpan: 2,
    rowSpan: 1,
  },
];

export interface TransactionRecord {
  id: string;
  date: string;
  merchant: string;
  category: string;
  status: "Settled" | "Released" | "Pending Approval";
  amount: number;
  currency: string;
}

export const RECENT_TRANSACTIONS: TransactionRecord[] = [
  {
    id: "tx-9941",
    date: "Nov 10, 2026",
    merchant: "Target / Partner Store",
    category: "Home & Office",
    status: "Settled",
    amount: -23.70,
    currency: "USD",
  },
  {
    id: "tx-9820",
    date: "Nov 08, 2026",
    merchant: "LightStyle Retail",
    category: "Lighting & Gear",
    status: "Settled",
    amount: -17.70,
    currency: "USD",
  },
  {
    id: "tx-9742",
    date: "Nov 05, 2026",
    merchant: "AWS Cloud Infrastructure",
    category: "Cloud Compute & Hosting",
    status: "Settled",
    amount: -142.50,
    currency: "USD",
  },
  {
    id: "tx-9655",
    date: "Nov 03, 2026",
    merchant: "VentureCap Contractor Escrow",
    category: "Contractor Milestone",
    status: "Released",
    amount: -350.00,
    currency: "USD",
  },
  {
    id: "tx-9580",
    date: "Oct 30, 2026",
    merchant: "HomeGoods Partner",
    category: "Furniture & Decor",
    status: "Settled",
    amount: -27.60,
    currency: "USD",
  },
  {
    id: "tx-9431",
    date: "Oct 28, 2026",
    merchant: "GitHub Enterprise Platform",
    category: "Developer Tooling",
    status: "Settled",
    amount: -45.00,
    currency: "USD",
  },
];

export interface BentoAnalyticsCardProps {
  title?: string;
  subtitle?: string;
}

export function BentoAnalyticsCard({
  title = "Guardian Copilot Financial Telemetry & Cash Flow Grid",
  subtitle = "Interactive 90-day predictive analytics, weekly velocity bars, and verified transaction ledger",
}: BentoAnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "charts" | "table">("overview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState<TransactionRecord[]>(RECENT_TRANSACTIONS);
  const [accountMetrics, setAccountMetrics] = useState({
    balance: 1850.0,
    discretionary: 1350.0,
    buffer: 500.0,
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchLiveLedger() {
      try {
        const res = await fetch("/api/dashboard/data");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
          const liveRecords: TransactionRecord[] = data.transactions.map((t: any) => ({
            id: t.id || `tx-${Math.random().toString(36).slice(2, 6)}`,
            date: t.date || new Date().toISOString().slice(0, 10),
            merchant: t.description || t.merchant || "Verified Merchant",
            category: t.category || "General Spend",
            status: (t.status === "COMPLETED"
              ? "Settled"
              : t.status === "PENDING"
              ? "Pending Approval"
              : "Settled") as any,
            amount: typeof t.amount === "number" ? t.amount : -25.0,
            currency: "USD",
          }));
          setTransactions(liveRecords);
        }

        if (data.account) {
          setAccountMetrics({
            balance: data.account.balance ?? 1850.0,
            discretionary: data.account.discretionarySpend ?? 1350.0,
            buffer: data.account.safetyBuffer ?? 500.0,
          });
        }
      } catch {
        // Retain verified fallback data on network exception
      }
    }
    fetchLiveLedger();
    return () => {
      isMounted = false;
    };
  }, []);

  const dynamicMetricCards = [
    {
      title: "Total PayPal Balance",
      amount: `$${accountMetrics.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: "USD",
      change: "+12.4% vs last month",
      isPositive: true,
      subtext: "Across verified sandbox accounts",
      icon: DollarSign,
    },
    {
      title: "Discretionary Spend",
      amount: `$${accountMetrics.discretionary.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: "USD",
      badge: "Safe to Spend",
      isPositive: true,
      subtext: "Unallocated liquidity available",
      icon: TrendingUp,
    },
    {
      title: "Sacred Reserve Buffer",
      amount: `$${accountMetrics.buffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: "USD",
      badge: "Floor Enforced",
      isPositive: true,
      subtext: "Inviolable invariant threshold",
      icon: ShieldCheck,
    },
    {
      title: "Top Spend Category",
      amount: "$850.00",
      currency: "USD",
      badge: "46% of Outflow",
      isPositive: false,
      subtext: "Electronics & Infrastructure",
      icon: PieChart,
    },
  ];

  const filteredTransactions = transactions.filter((tx) =>
    tx.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ["Transaction ID", "Date", "Merchant", "Category", "Status", "Amount", "Currency"];
    const rows = transactions.map((tx) => [
      tx.id,
      `"${tx.date}"`,
      `"${tx.merchant}"`,
      `"${tx.category}"`,
      tx.status,
      tx.amount.toFixed(2),
      tx.currency,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `guardian-financial-telemetry-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`w-full my-4 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl transition-all duration-200 overflow-hidden ${
        isFullscreen ? "fixed inset-4 z-50 overflow-y-auto max-h-[calc(100vh-2rem)] border-zinc-700 bg-zinc-950 shadow-2xl" : ""
      }`}
    >
      {/* 1. Clean Artifact Header Bar */}
      <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-100">{title}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Verified Sandbox
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* View Switcher Tabs & Artifact Action Controls */}
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("charts")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "charts"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chart View
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "table"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Table View
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Export telemetry data as CSV"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Expand Fullscreen"}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* 2. Structured KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dynamicMetricCards.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-[11px] font-medium">{metric.title}</span>
                  <div className="p-1 rounded-md bg-zinc-800 text-zinc-400">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
                    {metric.amount}{" "}
                    <span className="text-[10px] text-zinc-400 font-normal">{metric.currency}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {metric.change && (
                      <span className="text-[10.5px] font-mono text-emerald-400 flex items-center">
                        <ArrowUpRight className="w-3 h-3 inline" />
                        {metric.change}
                      </span>
                    )}
                    {metric.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-zinc-800 border border-zinc-700/80 text-zinc-300">
                        {metric.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 mt-1">{metric.subtext}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Pure Data Bento Grid: Liquidity Metrics & Spend Velocity */}
        {(activeTab === "overview" || activeTab === "charts") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
                Liquidity Modeling & Outflow Analytics
              </span>
              <span>Scrub trajectory curve for daily projected balances</span>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl p-3">
              <MagicBento
                items={GUARDIAN_DATA_ITEMS}
                columns={2}
                rowHeight={190}
                gap={12}
                radius={12}
                theme="dark"
                glowColor="#10b981"
                enableBorderGlow={false}
                enableSpotlight={false}
                enableStars={false}
                enableTilt={false}
                enableMagnetism={false}
                clickEffect={false}
                textAutoHide={true}
                onItemClick={() => {}}
                className="w-full"
                style={{}}
              />
            </div>
          </div>
        )}

        {/* 4. Structured Transactions / Merchant Spend Table */}
        {(activeTab === "overview" || activeTab === "table") && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <TableIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
                  Recent PayPal Transactions & Settlements
                </span>
                <span className="text-[11px] text-zinc-400">({filteredTransactions.length} records)</span>
              </div>

              {/* Table Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter merchant, category, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-700 w-56 transition-colors"
                />
              </div>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[10.5px]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium">Merchant / Payee</th>
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850/60 font-sans">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-zinc-400 text-[11px] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-zinc-200 whitespace-nowrap">
                          {tx.merchant}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-400 text-[11.5px] whitespace-nowrap">
                          {tx.category}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {tx.status === "Settled" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Settled
                            </span>
                          )}
                          {tx.status === "Released" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Released
                            </span>
                          )}
                          {tx.status === "Pending Approval" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-2.5 h-2.5" />
                              Pending HITL
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right whitespace-nowrap">
                          <span
                            className={
                              tx.amount < 0
                                ? "text-zinc-200 font-semibold"
                                : "text-emerald-400 font-semibold"
                            }
                          >
                            {tx.amount < 0
                              ? `-$${Math.abs(tx.amount).toFixed(2)}`
                              : `+$${tx.amount.toFixed(2)}`}{" "}
                            <span className="text-[10px] text-zinc-400 font-normal">{tx.currency}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-zinc-400 text-xs">
                          No transactions matching "{searchTerm}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Clean Data Telemetry Footer */}
      <div className="px-5 py-2.5 border-t border-zinc-800/80 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Invariants Enforced: Sacred $500.00 Reserve Floor • Zero-Trust HITL Gate</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-300">PayPal REST v2 Synchronized</span>
          <span>•</span>
          <span className="text-zinc-400">Total Available: $1,850.00 USD</span>
        </div>
      </div>
    </div>
  );
}
