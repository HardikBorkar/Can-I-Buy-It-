"use client";

import React, { useState } from "react";
import { X, Sliders, Shield, Lock, Zap } from "lucide-react";

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
