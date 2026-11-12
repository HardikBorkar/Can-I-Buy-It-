import { NextResponse } from "next/server";
import {
  FINANCIAL_STATE,
  RECURRING_COMMITMENTS,
  getSampleTransactions,
  Commitment,
  Transaction,
} from "@/lib/financial-state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || "alex_cro";

  let startingBalance = FINANCIAL_STATE.CURRENT_BALANCE;
  const safetyFloor = FINANCIAL_STATE.SAFETY_BUFFER_FLOOR;
  let accountEmail = FINANCIAL_STATE.ACCOUNT_EMAIL;
  let accountName = "Michael Buyer (Healthy)";
  const commitments: Commitment[] = RECURRING_COMMITMENTS;

  // 1. Fetch live user account from backend
  const backendBase = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  try {
    const userRes = await fetch(`${backendBase}/api/auth/user/${userId}`, { cache: "no-store" });
    if (userRes.ok) {
      const user = await userRes.json();
      if (typeof user.balance === "number") {
        startingBalance = user.balance;
      }
      if (user.email) accountEmail = user.email;
      if (user.name) accountName = user.name;
    }
  } catch (err) {
    // fallback to startingBalance
  }

  // 2. Fetch live transactions from SQLite write-through ledger
  const sampleTxns: Transaction[] = getSampleTransactions(new Date());
  let liveTxns: Transaction[] = [];
  try {
    const txnRes = await fetch(`${backendBase}/api/auth/transactions`, { cache: "no-store" });
    if (txnRes.ok) {
      const data = await txnRes.json();
      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        liveTxns = data.transactions.map((t: any, idx: number) => ({
          id: t.paypal_id || `txn-${idx}`,
          date: t.created_at ? t.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
          description: `${t.merchant || "Merchant"} - ${t.item || "Purchase"}`,
          category: t.category || "General Retail",
          amount: -Math.abs(t.amount || 0),
          paymentMethod: "PAY_IN_FULL" as const,
          status: "COMPLETED" as const,
          payer: accountName,
        }));
      }
    }
  } catch (err) {
    // fallback
  }

  // Deduplicate and combine live transactions with baseline samples
  const transactions: Transaction[] = [...liveTxns, ...sampleTxns];

  // 90-Day Deterministic Projection using clean UTC calendar day increments
  const today = new Date();
  const timeline = [];
  let runningBalance = startingBalance;
  const startYear = today.getUTCFullYear();
  const startMonth = today.getUTCMonth();
  const startDay = today.getUTCDate();

  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.UTC(startYear, startMonth, startDay + i));
    const dayOfMonth = d.getUTCDate();
    const dateStr = d.toISOString().split("T")[0];
    const monthShort = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const displayDate = `${monthShort} ${dayOfMonth}`;

    // Recurring Income (10th and 25th)
    if (dayOfMonth === 10 || dayOfMonth === 25) {
      runningBalance += 2200.0;
    }
    // Recurring Rent (1st)
    if (dayOfMonth === 1) {
      runningBalance -= 1200.0;
    }
    // Cloud SaaS (15th)
    if (dayOfMonth === 15) {
      runningBalance -= 85.0;
    }
    // Software & Gym (18th & 22nd)
    if (dayOfMonth === 18) {
      runningBalance -= 42.0;
    }
    if (dayOfMonth === 22) {
      runningBalance -= 65.0;
    }

    // Daily nominal living expense ($15/day avg)
    runningBalance -= 15.0;

    timeline.push({
      dayIndex: i,
      date: dateStr,
      displayDate,
      baselineBalance: Math.round(runningBalance * 100) / 100,
      safetyFloor,
      isDanger: runningBalance < safetyFloor,
    });
  }

  return NextResponse.json({
    account: {
      user_id: userId,
      name: accountName,
      email: accountEmail,
      balance: startingBalance,
      currency: "USD",
      safetyBuffer: safetyFloor,
      discretionarySpend: Math.max(0, startingBalance - safetyFloor),
      mode: process.env.PAYPAL_MODE || "sandbox",
    },
    commitments,
    transactions,
    timeline,
  });
}
