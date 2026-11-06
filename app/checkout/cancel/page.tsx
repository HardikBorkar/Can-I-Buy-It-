"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function CancelContent() {
  return (
    <div className="min-h-screen bg-[#060c18] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0b1629] border border-[#172b4d] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-white">Checkout Cancelled</h2>
        <p className="text-xs text-[#8ea9cb]">
          You cancelled the PayPal payment. No funds were debited from your account.
        </p>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link href="/" className="w-full">
            <Button className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Storefront</span>
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full">
            <Button variant="outline" className="w-full border-[#172b4d] bg-[#0c182e] hover:bg-[#122344] text-[#8ea9cb] hover:text-white">
              View Financial Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060c18] flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0070BA]" />
        </div>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
