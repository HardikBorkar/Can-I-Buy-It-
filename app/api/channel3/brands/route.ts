import { NextRequest, NextResponse } from "next/server";
import { searchChannel3Brands } from "@/lib/channel3-server";


export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || url.searchParams.get("q") || "";
    const brands = await searchChannel3Brands(query);
    return NextResponse.json({ brands });
  } catch (error) {
    console.error("Brands API error:", error);
    return NextResponse.json({ brands: [] });
  }
}

