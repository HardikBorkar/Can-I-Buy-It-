import { NextRequest, NextResponse } from "next/server";
import { getChannel3Similar } from "@/lib/channel3-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productId = body.product_id;
    const limit = body.limit || 6;

    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    const products = await getChannel3Similar(productId, limit);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Similar products API error:", error);
    return NextResponse.json({ error: "Failed to fetch similar products", products: [] }, { status: 500 });
  }
}

