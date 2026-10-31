import { NextRequest, NextResponse } from "next/server";
import { searchChannel3Categories } from "@/lib/channel3-server";


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
    const categories = await searchChannel3Categories(query);
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json({ categories: [] });
  }
}

