import { NextRequest, NextResponse } from "next/server";
import { searchChannel3Websites } from "@/lib/channel3-server";


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
    const websites = await searchChannel3Websites(query);
    return NextResponse.json({ websites });
  } catch (error) {
    console.error("Websites API error:", error);
    return NextResponse.json({ websites: [] });
  }
}

