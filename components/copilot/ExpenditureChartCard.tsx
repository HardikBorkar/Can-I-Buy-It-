"use client";

import React, { useState } from "react";
import { BarChart3, ShieldCheck, Database, Layers } from "lucide-react";
import { ExpenditureChartData } from "./types";

interface ExpenditureChartCardProps {
  data?: ExpenditureChartData;
}

export function ExpenditureChartCard({ data }: ExpenditureChartCardProps) {
  const chartData = data || {
    title: "Last Month Expenditure by Category",
    period: "Last 30 Days",
    totalSpent: 0.0,
    total_spent: 0.0,
    currency: "USD",
    source: "Sandbox Ledger",
    data_source: "Sandbox Ledger",
    categories: [],
  };

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize categories from categories or series
  const rawCategories =
    chartData.categories ||
    chartData.series?.map((s) => ({
      category: s.label || s.category,
      amount: s.amount,
      percentage: undefined as number | undefined,
    })) ||
    [];

  const total =
    chartData.totalSpent ??
    chartData.total_spent ??
    rawCategories.reduce((acc: number, c: { amount: number }) => acc + c.amount, 0);

  const categories = rawCategories.map((c: { category: string; amount: number; percentage?: number }) => ({
    category: c.category,
    amount: c.amount,
    percentage:
      c.percentage !== undefined
        ? c.percentage
        : total > 0
        ? parseFloat(((c.amount / total) * 100).toFixed(1))
        : 0,
  }));

  const maxAmount = Math.max(...categories.map((c: { amount: number }) => c.amount), 1);
  const period = chartData.period || chartData.title || "Last Month Expenditure by Category";
  const dataSource = chartData.source || chartData.data_source || "Sandbox Ledger";
  const currency = chartData.currency || "USD";

  // Palette for categories
  const barColors = [
    { bg: "bg-indigo-500", text: "text-indigo-400", border: "border-indigo-500/30", gradient: "from-indigo-500 via-indigo-400 to-indigo-300" },
    { bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", gradient: "from-emerald-500 via-teal-400 to-teal-300" },
    { bg: "bg-violet-500", text: "text-violet-400", border: "border-violet-500/30", gradient: "from-violet-500 via-purple-400 to-purple-300" },
    { bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/30", gradient: "from-amber-500 via-yellow-400 to-orange-300" },
  ];

  return (
    <div className="w-full max-w-xl mx-auto my-3 rounded-2xl border border-zinc-800/80 bg-[#111116] text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden transition-all duration-200">
      {/* 1. Header Bar */}
      <div className="px-5 py-3.5 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900/90 via-[#14141c] to-zinc-950 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-400 shadow-sm">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-zinc-100 tracking-tight">
                {period}
              </h3>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-400 inline" />
                {dataSource}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
              Read-Only Analytical Telemetry • Mutating payment gates suppressed
            </p>
          </div>
        </div>

        {/* Total Spent Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-zinc-900 border border-zinc-750 text-emerald-400 shadow-inner">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </span>
        </div>
      </div>

      {/* 2. Visual Bento Bar Chart */}
      <div className="p-5 space-y-4">
        {/* Metric Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Total Outflows
            </span>
            <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-xs text-zinc-400 font-normal">{currency}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Categories
            </span>
            <div className="text-lg font-bold font-mono text-teal-400 mt-1">
              {categories.length} Distinct
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Top Category
            </span>
            <div className="text-xs font-semibold text-emerald-400 truncate mt-1">
              {categories[0]?.category || "None"}
            </div>
          </div>
        </div>

        {/* Horizontal Category Bar Chart Rows */}
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
              Category Spending Velocity
            </span>
            <span>Hover bars for allocation share</span>
          </div>

          {categories.length === 0 ? (
            <div className="py-7 text-center text-xs text-zinc-500 font-sans space-y-1.5 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40">
              <p className="text-zinc-300 font-medium">Zero Sandbox Outflows Recorded</p>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                Authorize a PayPal Sandbox order or dispatch an invoice to view real-time category spending velocity.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {categories.map((item: { category: string; amount: number; percentage: number }, idx: number) => {
                const color = barColors[idx % barColors.length];
                const pctOfMax = Math.round((item.amount / maxAmount) * 100);
                const isHovered = hoveredIdx === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`group p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isHovered
                        ? "bg-zinc-900/80 border-teal-500/40 shadow-md shadow-teal-950/20"
                        : "bg-zinc-900/30 border-zinc-850 hover:border-zinc-750"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                      <span className="text-zinc-200 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color.bg}`} />
                        {item.category}
                      </span>
                      <span className="font-mono text-zinc-100 font-semibold">
                        ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        <span className="text-[10px] text-zinc-400 font-normal">({item.percentage}%)</span>
                      </span>
                    </div>

                    {/* Gradient Track & Bar */}
                    <div className="w-full h-2.5 rounded-full bg-zinc-850/80 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${color.gradient} transition-all duration-500 ease-out`}
                        style={{ width: `${Math.max(pctOfMax, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Category Breakdown Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {categories.map((c: { category: string; amount: number; percentage: number }, idx: number) => {
            const color = barColors[idx % barColors.length];
            return (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg text-[10.5px] font-mono bg-zinc-900/80 border border-zinc-800 text-zinc-300 flex items-center gap-1.5"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${color.bg}`} />
                <span className="text-zinc-400">{c.category}:</span>
                <span className="font-semibold text-zinc-200">
                  ${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            );
          })}
        </div>

        {/* Audit Footer Pill */}
        <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-[10.5px] text-zinc-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
            <span>Audit Isolation:</span>
          </span>
          <span className="text-zinc-300">Read-Only Analytics (No mutating payment gates dispatched)</span>
        </div>
      </div>
    </div>
  );
}

export default ExpenditureChartCard;
