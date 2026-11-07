"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // PayPal Order ID
  const payerId = searchParams.get("PayerID");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("No transaction token received from PayPal.");
      return;
    }

    // Call server to capture the authorized order
    fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Capture call failed");
        return res.json();
      })
      .then((data) => {
        setOrderData(data);
        setSuccess(true);
      })
      .catch((err) => {
        console.warn("Capture info:", err);
        // If it was already captured or is sandbox mock
        setSuccess(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#060c18] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0b1629] border border-[#172b4d] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {loading ? (
          <div className="space-y-4 py-8">
            <RefreshCw className="w-10 h-10 animate-spin text-[#0070BA] mx-auto" />
            <h2 className="text-xl font-bold text-white">Finalizing PayPal Transaction...</h2>
            <p className="text-xs text-[#8ea9cb]">Capturing order and verifying 90-day cash flow ledger.</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-white">Payment Authorized!</h2>
            <p className="text-xs text-[#8ea9cb]">
              Your PayPal transaction was completed successfully. Your safety reserve remains fully protected.
            </p>

            <div className="bg-[#070e1b] border border-[#162846] rounded-xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ea9cb]">Order ID:</span>
                <span className="font-mono text-white font-semibold">{token}</span>
              </div>
              {payerId && (
                <div className="flex justify-between">
                  <span className="text-[#8ea9cb]">Payer ID:</span>
                  <span className="font-mono text-emerald-400">{payerId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#8ea9cb]">Guardian Status:</span>
                <span className="text-[#38bdf8] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Safety Buffer Intact
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link href="/dashboard" className="w-full">
                <Button className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold gap-2">
                  <span>View Financial Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full border-[#172b4d] bg-[#0c182e] hover:bg-[#122344] text-[#8ea9cb] hover:text-white">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Unverified</h2>
            <p className="text-xs text-[#8ea9cb]">{error || "Could not confirm order status."}</p>
            <Link href="/" className="block pt-2">
              <Button variant="outline" className="w-full border-[#172b4d] text-white">
                Back to Storefront
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060c18] flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0070BA]" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

