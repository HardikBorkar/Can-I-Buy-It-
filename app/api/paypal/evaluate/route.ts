import { NextRequest, NextResponse } from "next/server";
import { evaluateSpendAgainstInvariants } from "@/lib/financial-state";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON body
    }

    const { amount = 0, currency = "USD", item_name = "Product Purchase" } = body;
    const result = evaluateSpendAgainstInvariants(
      Number(amount) || 0,
      String(item_name || "Product Purchase"),
      String(currency || "USD")
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("PayPal Evaluation Error:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
