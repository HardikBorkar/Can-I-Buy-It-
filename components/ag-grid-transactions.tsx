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

// Solid PayPal Enterprise theme (No gradients)
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
        cellClass: "font-mono text-xs text-[#8ea9cb] flex items-center",
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
              <div className="w-6 h-6 rounded-md bg-[#00457C]/30 border border-[#0070BA]/40 flex items-center justify-center text-[#38bdf8] shrink-0">
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
          <span className="font-mono text-xs text-[#38bdf8] bg-[#002952] px-2 py-0.5 rounded border border-[#00457C]">
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#003087] border border-[#0070BA] text-[#93c5fd]">
                <ShieldCheck className="w-3 h-3 text-[#38bdf8]" />
                Pay in 4
              </span>
            );
          }
          if (val === "DIRECT_TRANSFER") {
            return (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#064e3b] border border-[#059669] text-[#6ee7b7]">
                Invoicing
              </span>
            );
          }
          return (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0f213d] border border-[#1b3660] text-[#cbd5e1]">
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
                  ? "bg-[#064e3b] text-[#34d399] border border-[#059669]/60"
                  : "bg-[#78350f] text-[#fcd34d] border border-[#d97706]/60"
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
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8ea9cb]" />
          <input
            type="text"
            placeholder="Quick search transactions (ID, description, method)..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0c182e] border border-[#162846] rounded-xl text-xs text-slate-100 placeholder-[#64748b] focus:outline-none focus:border-[#0070BA] transition"
          />
        </div>

        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#0c182e] hover:bg-[#112344] border border-[#162846] text-[#cbd5e1] transition"
        >
          <Download className="w-3.5 h-3.5 text-[#8ea9cb]" />
          Export CSV
        </button>
      </div>

      {/* AG Grid React Component */}
      <div className="h-[360px] w-full rounded-2xl overflow-hidden border border-[#162846] shadow-xl">
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
