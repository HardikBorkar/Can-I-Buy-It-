import { NextRequest, NextResponse } from "next/server";
import { searchChannel3Products } from "@/lib/channel3-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await searchChannel3Products(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to process search", products: [], nextPageToken: null },
      { status: 500 }
    );
  }
}

