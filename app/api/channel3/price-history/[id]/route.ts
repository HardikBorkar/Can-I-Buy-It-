import { NextRequest, NextResponse } from "next/server";
import { getChannel3PriceHistory } from "@/lib/channel3-server";


export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "90", 10);

    const history = await getChannel3PriceHistory(id, days);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Price history API error:", error);
    return NextResponse.json({ error: "Failed to retrieve price history" }, { status: 500 });
  }
}

