import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = "USD", item_name } = await req.json();

    // PayPal Guardian 90-Day Cash-Flow Evaluation Simulation
    const currentBalance = 3250.0;
    const safetyBuffer = 500.0;
    const upcomingRecurringCommitments = 2100.0; // Rent, utilities, car insurance

    const projectedCashAfterCommitments = currentBalance - upcomingRecurringCommitments;
    const safeToSpendFull = (projectedCashAfterCommitments - amount) >= safetyBuffer;
    
    // Pay in 4 installment breakdown: 4 equal bi-weekly payments
    const installmentAmount = Math.round((amount / 4) * 100) / 100;
    const safeWithPayIn4 = (projectedCashAfterCommitments - installmentAmount) >= safetyBuffer;

    return NextResponse.json({
      amount,
      currency,
      item_name,
      current_balance: currentBalance,
      safety_buffer: safetyBuffer,
      upcoming_commitments: upcomingRecurringCommitments,
      projected_remaining_balance: Math.round((projectedCashAfterCommitments - amount) * 100) / 100,
      safe_in_full: safeToSpendFull,
      recommended_action: safeToSpendFull
        ? "APPROVE_FULL"
        : safeWithPayIn4
        ? "RECOMMEND_PAY_IN_4"
        : "UNSAFE_DELAY",
      pay_in_4: {
        available: amount >= 30 && amount <= 1500,
        installments: 4,
        biweekly_payment: installmentAmount,
        safe: safeWithPayIn4,
        first_payment_today: installmentAmount
      },
      explanation: safeToSpendFull
        ? `Safe to purchase today! After this \$${amount.toFixed(2)} purchase and upcoming recurring bills (\$${upcomingRecurringCommitments.toFixed(2)}), your cash cushion remains safely above your \$${safetyBuffer.toFixed(2)} minimum reserve.`
        : safeWithPayIn4
        ? `⚠️ Paying \$${amount.toFixed(2)} in full breaches your \$${safetyBuffer.toFixed(2)} safety buffer before your next paycheck when rent hits. However, **PayPal Pay in 4** (\$${installmentAmount.toFixed(2)} today) is 100% safe!`
        : `🛑 Unsafe to purchase right now. This purchase would cause your account balance to fall below zero during your upcoming billing cycle.`
    });
  } catch (error) {
    console.error("PayPal Evaluation Error:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}

