import { NextResponse } from "next/server";
import {
  FINANCIAL_STATE,
  RECURRING_COMMITMENTS,
  getSampleTransactions,
  Commitment,
  Transaction,
} from "@/lib/financial-state";

export async function GET() {
  const today = new Date();
  const startingBalance = FINANCIAL_STATE.CURRENT_BALANCE;
  const safetyFloor = FINANCIAL_STATE.SAFETY_BUFFER_FLOOR;

  const commitments: Commitment[] = RECURRING_COMMITMENTS;
  const transactions: Transaction[] = getSampleTransactions(today);

  // 90-Day Deterministic Projection using clean UTC calendar day increments
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
      email: FINANCIAL_STATE.ACCOUNT_EMAIL,
      balance: startingBalance,
      currency: FINANCIAL_STATE.CURRENCY,
      safetyBuffer: safetyFloor,
      discretionarySpend: Math.max(0, startingBalance - safetyFloor),
      mode: process.env.PAYPAL_MODE || "sandbox",
    },
    commitments,
    transactions,
    timeline,
  });
}
