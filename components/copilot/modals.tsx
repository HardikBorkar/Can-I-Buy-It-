"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sliders, Shield, Lock, Zap, ExternalLink, Check, Plus, User, Wallet, Building2, AlertTriangle, Download, Upload, FileSpreadsheet, KeyRound } from "lucide-react";

export function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [temperature, setTemperature] = useState(0.2);
  const [safetyBufferFloor, setSafetyBufferFloor] = useState(500);
  const [defaultSecurityMode, setDefaultSecurityMode] = useState<"interactive" | "autonomous">("interactive");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#141419] border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-zinc-100">Copilot Runtime &amp; Security Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Security & Authorization Posture */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-200 font-semibold">PayPal Payment Authorization Posture</span>
              <span className="text-[10px] text-zinc-400 font-mono">Security Guard</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDefaultSecurityMode("interactive")}
                className={`p-2.5 rounded-xl border text-left transition space-y-1 ${
                  defaultSecurityMode === "interactive"
                    ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>PayPal Password</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Zero-trust: requires manual PayPal password on sandbox.paypal.com.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDefaultSecurityMode("autonomous")}
                className={`p-2.5 rounded-xl border text-left transition space-y-1 ${
                  defaultSecurityMode === "autonomous"
                    ? "bg-teal-950/20 border-teal-500/40 text-teal-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span>Autonomous Agent</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Agent signs and settles autonomously if &gt; $500 reserve buffer holds.
                </p>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-300 font-medium">Inference Temperature</span>
              <span className="font-mono text-zinc-400">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-violet-500"
            />
            <span className="text-[10px] text-zinc-500 block mt-1">
              Lower values ensure deterministic mathematical calculation for PayPal transactions.
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-300 font-medium">Safety Buffer Floor (Protected)</span>
              <span className="font-mono text-emerald-400 font-bold">${safetyBufferFloor}.00 USD</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={safetyBufferFloor}
              onChange={(e) => setSafetyBufferFloor(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 block mt-1">
              Guardian triggers overdraft protection whenever discretionary spend breaches this floor.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-850 space-y-1">
            <div className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>PayPal Sandbox REST v2 Linked</span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Authenticated via Client Credentials OAuth2. Live webhook events stream to `/api/paypal/capture`.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ConnectedAccount {
  user_id: string;
  email: string;
  name: string;
  account_type: string;
  balance: number;
  currency: string;
}

export function PayPalAccountModal({
  isOpen,
  onClose,
  activeAccountId,
  onSelectAccount,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeAccountId: string;
  onSelectAccount: (account: ConnectedAccount) => void;
}) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBalance, setCustomBalance] = useState("3500.00");
  const [customType, setCustomType] = useState("PERSONAL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/py/auth/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.warn("Could not fetch accounts from backend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    window.open("/api/py/auth/download-bulk-csv", "_blank");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportNotice(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/py/auth/bulk-import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportNotice(`Imported ${data.imported_count} accounts from CSV.`);
        await loadAccounts();
      } else {
        setImportNotice("Failed to parse CSV file.");
      }
    } catch (err) {
      console.error("Failed to import CSV:", err);
      setImportNotice("Error uploading CSV.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLoginWithPayPal = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/py/auth/paypal/url");
      if (res.ok) {
        const data = await res.json();
        if (data.auth_url) {
          window.open(data.auth_url, "_blank", "width=600,height=750");
        }
      }
    } catch (err) {
      console.error("Failed to get PayPal OAuth URL:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;

    try {
      const res = await fetch("/api/py/auth/custom-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customEmail.trim(),
          name: customName.trim() || customEmail.split("@")[0],
          balance: parseFloat(customBalance) || 3500.0,
          account_type: customType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSelectAccount(data.account);
        loadAccounts();
        setShowCustomForm(false);
      }
    } catch (err) {
      console.error("Failed to add custom sandbox account:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#121217] border border-zinc-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">PayPal Account &amp; Persona Hub</h3>
              <p className="text-[11px] text-zinc-400">
                Connect your real account or switch sandbox test personas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Official Log in with PayPal Button */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-blue-900/30 border border-blue-500/30 flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-white">Log in with PayPal</span>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                OAuth 2.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              Authenticate via PayPal's official hosted consent screen
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoginWithPayPal}
            disabled={isLoggingIn}
            className="px-4 py-2 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-lg shadow-blue-950/50 active:scale-95"
          >
            <span>{isLoggingIn ? "Opening..." : "Connect"}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. PayPal Sandbox Bulk Accounts CSV Hub */}
        <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>PayPal Sandbox Bulk Accounts</span>
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-zinc-400 font-mono">
              <KeyRound className="w-3 h-3 text-emerald-400" />
              <span>Pwd: <strong className="text-emerald-300">Guardian2026!</strong></span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-tight">
            Matches PayPal Developer Portal format (<code className="text-zinc-300">sandbox-bulk-headers.csv</code>). Download to upload directly to PayPal Sandbox, or import a customized CSV.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-zinc-700/60"
            >
              <Download className="w-3 h-3 text-blue-400" />
              <span>Download Bulk CSV</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-zinc-700/60"
            >
              <Upload className="w-3 h-3 text-emerald-400" />
              <span>{isImporting ? "Importing..." : "Import CSV"}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {importNotice && (
            <div className="text-[10.5px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-1 rounded-md">
              {importNotice}
            </div>
          )}
        </div>

        {/* 3. Switch Between Provisioned Personas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10.5px]">
              Provisioned Sandbox Personas
            </span>
            <span className="text-[10.5px] text-zinc-500 font-mono">
              Floor Floor: $500.00 USD
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {accounts.map((acc) => {
              const isActive = acc.user_id === activeAccountId;
              const isHealthy = acc.balance >= 500;
              const isTight = acc.balance >= 500 && acc.balance < 1000;
              const isLow = acc.balance < 500;

              return (
                <div
                  key={acc.user_id}
                  onClick={() => {
                    onSelectAccount(acc);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? "bg-violet-950/25 border-violet-500/50 shadow-md shadow-violet-950/30"
                      : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        acc.account_type === "BUSINESS"
                          ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-400"
                          : "bg-teal-500/15 border border-teal-500/30 text-teal-400"
                      }`}
                    >
                      {acc.account_type === "BUSINESS" ? (
                        <Building2 className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-100 truncate">
                          {acc.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-750">
                          {acc.account_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">
                        {acc.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-zinc-100">
                        ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-medium flex items-center justify-end gap-1">
                        {isLow ? (
                          <span className="text-rose-400 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Floor Breach
                          </span>
                        ) : isTight ? (
                          <span className="text-amber-400">Tight Reserve</span>
                        ) : (
                          <span className="text-emerald-400">Reserve Safe</span>
                        )}
                      </div>
                    </div>

                    {isActive && (
                      <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Add Custom Sandbox Account Toggle */}
        <div className="pt-2 border-t border-zinc-800">
          {!showCustomForm ? (
            <button
              type="button"
              onClick={() => setShowCustomForm(true)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-zinc-750 hover:border-zinc-600 bg-zinc-900/40 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Custom Sandbox Account</span>
            </button>
          ) : (
            <form onSubmit={handleAddCustom} className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200">New Sandbox Account</span>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-[11px]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] text-zinc-400">PayPal Email</label>
                  <input
                    type="email"
                    required
                    placeholder="custom-buyer@personal.example.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Alice Carter"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400">Initial Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customBalance}
                    onChange={(e) => setCustomBalance(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-violet-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition"
              >
                Connect &amp; Activate Account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
