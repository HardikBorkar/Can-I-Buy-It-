import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const captureResult = await capturePayPalOrder(orderId);
    return NextResponse.json(captureResult);
  } catch (err: any) {
    console.error("Order capture route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to capture order" },
      { status: 500 }
    );
  }
}
