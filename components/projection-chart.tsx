"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

interface DayData {
  dayIndex: number;
  date: string;
  displayDate: string;
  baselineBalance: number;
  payInFullBalance?: number;
  payIn4Balance?: number;
  safetyFloor: number;
}

interface Props {
  data: DayData[];
  candidateAmount: number;
  showComparison: boolean;
}

export function ProjectionChart({ data, candidateAmount, showComparison }: Props) {
  // Compute comparison trajectories if candidateAmount > 0
  const processedData = React.useMemo(() => {
    if (!showComparison || candidateAmount <= 0) {
      return data;
    }

    const payIn4Installment = Math.round((candidateAmount / 4) * 100) / 100;

    return data.map((d) => {
      // Pay In Full: subtracted on Day 0
      const payInFullBalance = Math.round((d.baselineBalance - candidateAmount) * 100) / 100;

      // Pay In 4: 4 bi-weekly payments on Day 0, 14, 28, 42
      let totalInstallmentsPaid = payIn4Installment; // Day 0
      if (d.dayIndex >= 14) totalInstallmentsPaid += payIn4Installment;
      if (d.dayIndex >= 28) totalInstallmentsPaid += payIn4Installment;
      if (d.dayIndex >= 42) totalInstallmentsPaid += payIn4Installment;

      const payIn4Balance = Math.round((d.baselineBalance - totalInstallmentsPaid) * 100) / 100;

      return {
        ...d,
        payInFullBalance,
        payIn4Balance,
      };
    });
  }, [data, candidateAmount, showComparison]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const current = payload[0]?.payload;
    return (
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
        <p className="font-semibold text-slate-200 border-b border-slate-800 pb-1">
          {current?.date} (Day +{current?.dayIndex})
        </p>
        <p className="text-emerald-400 flex items-center justify-between gap-4">
          <span>Baseline Balance:</span>
          <span className="font-mono font-bold">${current?.baselineBalance?.toFixed(2)}</span>
        </p>
        {showComparison && candidateAmount > 0 && (
          <>
            <p className="text-rose-400 flex items-center justify-between gap-4">
              <span>Pay in Full (-${candidateAmount}):</span>
              <span className="font-mono font-bold">${current?.payInFullBalance?.toFixed(2)}</span>
            </p>
            <p className="text-indigo-400 flex items-center justify-between gap-4">
              <span>PayPal Pay in 4:</span>
              <span className="font-mono font-bold">${current?.payIn4Balance?.toFixed(2)}</span>
            </p>
          </>
        )}
        <p className="text-amber-400/90 text-[11px] pt-1 border-t border-slate-800 flex items-center justify-between">
          <span>Safety Floor Buffer:</span>
          <span className="font-mono">${current?.safetyFloor?.toFixed(2)}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="w-full h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="payIn4Gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

          <XAxis
            dataKey="displayDate"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            interval={10}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            tickFormatter={(val) => `$${val}`}
            domain={["dataMin - 100", "auto"]}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(val) => (
              <span className="text-xs text-slate-300 font-medium ml-1 mr-3">{val}</span>
            )}
          />

          {/* Safety Buffer Floor */}
          <ReferenceLine
            y={500}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: "Safety Buffer ($500)",
              fill: "#f59e0b",
              position: "insideTopLeft",
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          {/* Baseline Safe Balance */}
          <Area
            type="monotone"
            dataKey="baselineBalance"
            name="Baseline Projected Balance"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#baselineGradient)"
          />

          {/* Scenario A: Pay in Full */}
          {showComparison && candidateAmount > 0 && (
            <Line
              type="monotone"
              dataKey="payInFullBalance"
              name={`Pay in Full (-$${candidateAmount})`}
              stroke="#f43f5e"
              strokeWidth={2}
              dot={false}
              strokeDasharray="3 3"
            />
          )}

          {/* Scenario B: PayPal Pay in 4 */}
          {showComparison && candidateAmount > 0 && (
            <Area
              type="monotone"
              dataKey="payIn4Balance"
              name="PayPal Pay in 4 (4x Installments)"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#payIn4Gradient)"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

