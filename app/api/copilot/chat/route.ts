import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: req.headers.get("accept") || "text/event-stream",
    };

    const fastApiResponse = await fetch(`${FASTAPI_URL}/api/copilot/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!fastApiResponse.ok) {
      return NextResponse.json(
        { error: `FastAPI backend error: ${fastApiResponse.statusText}` },
        { status: fastApiResponse.status }
      );
    }

    const contentType = fastApiResponse.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && fastApiResponse.body) {
      return new Response(fastApiResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const data = await fastApiResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to forward request to FastAPI backend", detail: error?.message },
      { status: 502 }
    );
  }
}
