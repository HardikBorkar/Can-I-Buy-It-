import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal-server";

// Valid PayPal Order IDs: alphanumeric string or standard sandbox token format
const ORDER_ID_REGEX = /^[A-Za-z0-9_-]{8,42}$/;

export async function POST(req: NextRequest) {
  try {
    // 1. Validate Origin / Referer to prevent cross-site request forgery
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json(
        { error: "Untrusted origin for transaction capture" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { orderId } = body;

    // 2. Strict ID input validation
    if (!orderId || typeof orderId !== "string" || !ORDER_ID_REGEX.test(orderId)) {
      return NextResponse.json(
        { error: "Invalid orderId format: must be a valid PayPal order identifier" },
        { status: 400 }
      );
    }

    // 3. Capture authorized order via resilient PayPal client
    const captureResult = await capturePayPalOrder(orderId);
    return NextResponse.json(captureResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to capture order";
    console.error("Order capture route error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
