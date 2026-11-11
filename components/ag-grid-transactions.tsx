"use client";

import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  colorSchemeDark,
  ColDef,
  ICellRendererParams,
} from "ag-grid-community";
import { Search, Download, CreditCard, ShieldCheck } from "lucide-react";

// Register all community features for AG Grid v36
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom dark theme matching our Slate-950 UI
const guardianTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#090d16",
  foregroundColor: "#f1f5f9",
  headerBackgroundColor: "#0f172a",
  headerTextColor: "#94a3b8",
  borderColor: "#1e293b",
  rowHoverColor: "#1e293b55",
  fontFamily: "inherit",
  fontSize: 13,
  wrapperBorderRadius: 12,
  headerHeight: 42,
  rowHeight: 46,
});

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: "PAY_IN_FULL" | "PAY_IN_4" | "PAYPAL_CREDIT" | "DIRECT_TRANSFER";
  status: "COMPLETED" | "PENDING" | "REFUNDED" | "CREATED";
  payer: string;
}

interface Props {
  transactions: TransactionRow[];
}

export function AgGridTransactions({ transactions }: Props) {
  const [quickFilterText, setQuickFilterText] = useState("");
  const [gridApi, setGridApi] = useState<any>(null);

  const columnDefs = useMemo<ColDef<TransactionRow>[]>(
    () => [
      {
        field: "date",
        headerName: "Date",
        width: 120,
        sortable: true,
        filter: true,
        cellClass: "font-mono text-xs text-slate-400 flex items-center",
      },
      {
        field: "description",
        headerName: "Description",
        flex: 1.5,
        minWidth: 220,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<TransactionRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-white truncate">{params.data.description}</span>
            </div>
          );
        },
      },
      {
        field: "id",
        headerName: "Order / Ref ID",
        width: 170,
        cellRenderer: (params: ICellRendererParams<TransactionRow>) => (
          <span className="font-mono text-xs text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
            {params.value}
          </span>
        ),
      },
      {
        field: "paymentMethod",
        headerName: "Method",
        width: 150,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<TransactionRow>) => {
          const val = params.value;
          if (val === "PAY_IN_4") {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 leading-none align-middle rounded-full text-[11px] font-semibold bg-indigo-500/15 border border-indigo-500/40 text-indigo-300">
                <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                Pay in 4
              </span>
            );
          }
          if (val === "DIRECT_TRANSFER") {
            return (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                Invoicing
              </span>
            );
          }
          return (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
              Pay in Full
            </span>
          );
        },
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        sortable: true,
        cellClass: "font-mono font-semibold flex items-center justify-end text-right",
        headerClass: "text-right",
        cellRenderer: (params: ICellRendererParams<TransactionRow>) => {
          const amount = params.value || 0;
          const isPositive = amount > 0;
          return (
            <span className={isPositive ? "text-emerald-400" : "text-slate-200"}>
              {isPositive ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`}
            </span>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        cellRenderer: (params: ICellRendererParams<TransactionRow>) => {
          const status = params.value;
          const isCompleted = status === "COMPLETED";
          return (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                isCompleted
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-950/80 text-amber-400 border border-amber-500/30"
              }`}
            >
              {status}
            </span>
          );
        },
      },
    ],
    []
  );

  const onExportCsv = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({ fileName: "paypal_guardian_transactions.csv" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Search and Table Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Quick search transactions (ID, description, method)..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          Export CSV
        </button>
      </div>

      {/* AG Grid React Component */}
      <div className="h-[360px] w-full rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
        <AgGridReact<TransactionRow>
          theme={guardianTheme}
          rowData={transactions}
          columnDefs={columnDefs}
          quickFilterText={quickFilterText}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[5, 10, 20]}
          onGridReady={(params) => setGridApi(params.api)}
          animateRows={true}
        />
      </div>
    </div>
  );
}

