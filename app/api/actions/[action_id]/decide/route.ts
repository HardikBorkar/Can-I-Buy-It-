import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action_id: string }> }
) {
  try {
    const { action_id } = await context.params;
    const body = await request.json().catch(() => ({}));

    // Forward to FastAPI backend on port 8000 to resume interrupted LangGraph states
    const backendUrl = `http://127.0.0.1:8000/api/copilot/actions/${action_id}/decide`;
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Fallback try without /decide if needed
      const fallbackUrl = `http://127.0.0.1:8000/api/copilot/actions/${action_id}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await fallbackRes.json().catch(() => ({}));
      return NextResponse.json(data, { status: fallbackRes.status });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Error calling FastAPI /actions/decide:", error);
    return NextResponse.json(
      { error: "Failed to connect to FastAPI agent runtime", detail: error?.message },
      { status: 502 }
    );
  }
}

