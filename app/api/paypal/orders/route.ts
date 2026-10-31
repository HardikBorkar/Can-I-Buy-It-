import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/paypal-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency = "USD", itemName, payIn4 = false } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const order = await createPayPalOrder({
      amount: Number(amount),
      currency,
      itemName,
      payIn4: Boolean(payIn4),
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error("PayPal orders route error:", err);
    return NextResponse.json({ error: "Failed to create PayPal order" }, { status: 500 });
  }
}
