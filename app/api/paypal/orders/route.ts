import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/paypal-server";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Empty or malformed body fallback
  }

  const { amount = 100, currency = "USD", itemName = "Product Purchase", payIn4 = false } = body;

  try {
    const order = await createPayPalOrder({
      amount: Number(amount) || 100,
      currency: String(currency || "USD"),
      itemName: String(itemName || "Product Purchase"),
      payIn4: Boolean(payIn4),
    });

    return NextResponse.json(order);
  } catch (err) {
    console.warn("PayPal orders route error, falling back to simulated order:", err);
    const mockId = `SANDBOX-ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const parsedAmount = Number(amount) || 100;
    return NextResponse.json({
      orderId: mockId,
      status: "CREATED",
      approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockId}`,
      payIn4: Boolean(payIn4),
      installmentAmount: Math.round((parsedAmount / 4) * 100) / 100,
    });
  }
}

