"use client";

import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDark,
  ColDef,
  ICellRendererParams,
} from "ag-grid-community";
import { Calendar, Repeat, ShieldCheck } from "lucide-react";

// Register all community features
ModuleRegistry.registerModules([AllCommunityModule]);

const guardianTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#070e1b",
  foregroundColor: "#f1f5f9",
  headerBackgroundColor: "#0c182e",
  headerTextColor: "#93c5fd",
  borderColor: "#162846",
  rowHoverColor: "#10213d",
  fontFamily: "inherit",
  fontSize: 13,
  wrapperBorderRadius: 12,
  headerHeight: 42,
  rowHeight: 46,
});

export interface CommitmentRow {
  id: string;
  name: string;
  category: "Housing" | "SaaS & Tech" | "Utilities" | "Health" | "Income";
  amount: number;
  cadence: "Monthly" | "Bi-Weekly" | "Weekly";
  nextDueDate: string;
  autopay: boolean;
  impactScore: "High" | "Medium" | "Low";
}

interface Props {
  commitments: CommitmentRow[];
}

export function AgGridCommitments({ commitments }: Props) {
  const columnDefs = useMemo<ColDef<CommitmentRow>[]>(
    () => [
      {
        field: "name",
        headerName: "Obligation / Inflow",
        flex: 1.5,
        minWidth: 200,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<CommitmentRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#00457C]/30 border border-[#0070BA]/40 flex items-center justify-center text-[#38bdf8] shrink-0">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-white">{params.data.name}</span>
            </div>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 140,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<CommitmentRow>) => (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0c182e] text-[#8ea9cb] border border-[#162846]">
            {params.value}
          </span>
        ),
      },
      {
        field: "cadence",
        headerName: "Cadence",
        width: 130,
        sortable: true,
      },
      {
        field: "nextDueDate",
        headerName: "Next Scheduled",
        width: 150,
        cellRenderer: (params: ICellRendererParams<CommitmentRow>) => (
          <div className="flex items-center gap-1.5 text-xs text-[#cbd5e1]">
            <Calendar className="w-3.5 h-3.5 text-[#8ea9cb]" />
            <span>{params.value}</span>
          </div>
        ),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        sortable: true,
        cellClass: "font-mono font-semibold flex items-center justify-end text-right",
        headerClass: "text-right",
        cellRenderer: (params: ICellRendererParams<CommitmentRow>) => {
          const amount = params.value || 0;
          const isPositive = amount > 0;
          return (
            <span className={isPositive ? "text-emerald-400 font-bold" : "text-slate-100"}>
              {isPositive ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`}
            </span>
          );
        },
      },
      {
        field: "autopay",
        headerName: "Protection Status",
        width: 160,
        cellRenderer: (params: ICellRendererParams<CommitmentRow>) => {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#064e3b] text-[#34d399] border border-[#059669]/60">
              <ShieldCheck className="w-3 h-3 text-[#34d399]" />
              Guardian Protected
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="h-[320px] w-full rounded-2xl overflow-hidden border border-[#162846] shadow-xl">
      <AgGridReact<CommitmentRow>
        theme={guardianTheme}
        rowData={commitments}
        columnDefs={columnDefs}
        animateRows={true}
      />
    </div>
  );
}
