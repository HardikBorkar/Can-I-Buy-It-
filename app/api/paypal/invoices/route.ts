import { NextRequest, NextResponse } from "next/server";
import { createAndSendInvoice } from "@/lib/paypal-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientEmail, amount, description, currency = "USD", note } = body;

    if (!recipientEmail || !amount || Number(amount) <= 0 || !description) {
      return NextResponse.json(
        { error: "recipientEmail, positive amount, and description are required" },
        { status: 400 }
      );
    }

    const invoice = await createAndSendInvoice({
      recipientEmail,
      amount: Number(amount),
      description,
      currency,
      note,
    });

    return NextResponse.json(invoice);
  } catch (err: any) {
    console.error("PayPal invoice route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}

