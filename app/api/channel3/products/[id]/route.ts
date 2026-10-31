import { NextRequest, NextResponse } from "next/server";
import { getChannel3Product } from "@/lib/channel3-server";


export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);

    // Extract option_* parameters for variants
    const selectedOptions: Record<string, string> = {};
    for (const [key, val] of url.searchParams.entries()) {
      if (key.startsWith("option_")) {
        const optionName = key.replace("option_", "");
        selectedOptions[optionName] = val;
      }
    }

    const product = await getChannel3Product(
      id,
      Object.keys(selectedOptions).length > 0 ? selectedOptions : undefined
    );

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product details API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve product" },
      { status: 500 }
    );
  }
}

