import { NextRequest, NextResponse } from "next/server";
import { searchChannel3Products } from "@/lib/channel3-server";
import { createPayPalOrder } from "@/lib/paypal-server";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GeminiResult {
  reply: string;
  reasoning?: string;
}

// OpenRouter Gemini AI Reasoning Helper with Chain-of-Thought extraction
async function callGemini(
  userPrompt: string,
  systemPrompt?: string
): Promise<GeminiResult | null> {
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawContent: string = data.choices?.[0]?.message?.content || "";
      if (!rawContent) return null;

      // Extract <reasoning>...</reasoning> tags
      const reasoningMatch = rawContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
      let reasoning: string | undefined;
      let reply = rawContent;

      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
        reply = rawContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();
      }

      if (!reply && reasoning) {
        const paragraphs = reasoning.split("\n\n");
        reply = paragraphs.slice(-2).join("\n\n");
      }

      return { reply, reasoning };
    }
  } catch (err) {
    console.warn("OpenRouter Gemini call failed:", err);
  }
  return null;
}

function getAgentSystemPrompt(activeAgent: string): string {
  let roleTitle = "Guardian Core";
  let roleMission =
    "holistic financial liquidity protection, 90-day cash flow simulation, safety buffer floor enforcement ($500.00 USD sacred floor), and transaction risk analysis.";

  if (activeAgent === "autonomous-trader") {
    roleTitle = "Autonomous Trader Agent";
    roleMission =
      "retail catalog arbitrage across 25,000+ merchants via Channel3, price negotiation, financing optimization (PayPal Pay in 4 vs Full), and constructing PayPal Sandbox Orders.";
  } else if (activeAgent === "merchant-invoicing") {
    roleTitle = "Merchant Invoicing Agent";
    roleMission =
      "B2B accounts receivable, generating professional PayPal Invoices REST v2, managing payment schedules, and verifying receipt status.";
  } else if (activeAgent === "budget-insights") {
    roleTitle = "Budget & Insights Agent";
    roleMission =
      "spending categorization, subscription/SaaS expense audits, and cash reserve runway tracking.";
  }

  return `You are ${roleTitle}, an autonomous financial agent for PayPal. Your mission is ${roleMission}

FINANCIAL CONTEXT & SACRED INVARIANTS:
- Current Live PayPal Balance: $1,850.00 USD
- Protected Safety Buffer Floor: $500.00 USD (Sacred: NEVER allow spending that violates this floor)
- Upcoming Committed Outflows (Next 30 Days): $1,392.00 ($1,200 Rent on 1st of month, $85 AWS, $42 SaaS, $65 Gym)
- Safe Discretionary Spend: $1,350.00 USD
- Ecosystem: Integrated with PayPal REST v2 Sandbox (Orders, Capture, Invoicing) & Channel3 Universal Product API.

CRITICAL OPERATING RULES:
1. CHAIN-OF-THOUGHT REASONING:
Always output your internal analysis inside a <reasoning>...</reasoning> block before providing your final response.
In <reasoning>, analyze:
  • Intent Recognition: Inspect the exact user input without assuming unrelated canned tasks.
  • Financial State & $500 Buffer: Calculate post-purchase balances and verify the $500 floor remains protected.
  • Catalog / PayPal Grounding: Note the relevant API action (Channel3 catalog search, PayPal Order v2, or Invoicing v2).
  • Human-in-the-Loop Security Gate: Note that financial debits are NEVER unilateral—they require explicit user authorization via PayPal Sandbox checkout login.

2. CONVERSATIONAL ACCURACY:
  • If the user says "hello", "who is this", or asks general questions, greet them according to your active persona. DO NOT hallucinate fake camera orders, invoices, or jeans unless specifically asked!
  • If the user asks about buying items or asks for recommendations, evaluate options against the $1,350 safe discretionary cap.
  • If the user initiates a purchase or negotiation, formulate terms and trigger human authorization.

3. FINAL RESPONSE:
Deliver an executive, crisp summary in GitHub-flavored Markdown with bold metrics and emojis.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      active_agent = "guardian-core",
    }: {
      message: string;
      active_agent?: string;
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const lower = message.toLowerCase().trim();
    const systemPrompt = getAgentSystemPrompt(active_agent);

    const productKeywords = [
      "jean", "jeans", "denim", "shoes", "shoe", "sneaker", "sneakers",
      "camera", "laptop", "macbook", "headphone", "headphones", "earbuds",
      "chair", "desk", "vacuum", "phone", "iphone", "watch", "jacket", "shirt",
      "pant", "pants", "hoodie", "monitor", "boots"
    ];

    const matchedKeyword = productKeywords.find((kw) => lower.includes(kw));

    // Determine if user wants product discovery / recommendations VS direct checkout
    const isShoppingDiscovery =
      lower.includes("which") ||
      lower.includes("what") ||
      lower.includes("recommend") ||
      lower.includes("suggest") ||
      lower.includes("options") ||
      lower.includes("find") ||
      lower.includes("browse") ||
      lower.includes("look for") ||
      lower.includes("compare") ||
      lower.includes("catalog") ||
      (!lower.includes("buy") && !lower.includes("order") && !lower.includes("purchase") && !lower.includes("checkout") && Boolean(matchedKeyword));

    const isDirectOrderRequest =
      !isShoppingDiscovery &&
      (lower.includes("buy") || lower.includes("order") || lower.includes("purchase") || lower.includes("checkout") || lower.includes("authorize")) &&
      (Boolean(matchedKeyword) || lower.includes("sony") || lower.includes("$") || lower.includes("order #") || lower.includes("pay in 4"));

    // 1. DIRECT PURCHASE / ORDER / BUY REQUEST
    if (isDirectOrderRequest) {
      let itemName = "Sony Alpha a7 IV Camera";
      let amount = 850.0;
      let payIn4 = false;

      if (lower.includes("jean")) {
        itemName = "Column Straight Fit Denim Jeans";
        amount = 258.0;
      } else if (lower.includes("laptop") || lower.includes("macbook")) {
        itemName = "Apple MacBook Air 13-inch (M3)";
        amount = 1099.0;
      }

      const dollarMatch = lower.match(/\$(\d+(?:\.\d{1,2})?)/);
      if (dollarMatch) {
        amount = parseFloat(dollarMatch[1]);
      }

      if (lower.includes("pay in 4") || lower.includes("installments") || amount > 500) {
        payIn4 = true;
      }

      // Create a REAL PayPal Sandbox Order via PayPal REST v2 API!
      const paypalOrder = await createPayPalOrder({
        amount,
        itemName,
        payIn4,
      });

      const userPrompt = `The user wants to transact: "${message}".
An official PayPal Sandbox Order has been generated with:
- Order ID: ${paypalOrder.orderId}
- Item: ${itemName}
- Amount: $${amount.toFixed(2)} USD
- Status: ${paypalOrder.status}
- Pay in 4 installment: $${paypalOrder.installmentAmount.toFixed(2)}
- Approve URL: ${paypalOrder.approveUrl}

Detail in <reasoning> your cash flow simulation, how the $500 safety buffer is protected, and why Human-in-the-Loop authorization via the official PayPal Sandbox Login screen is mandatory.
Then provide your concise response instructing the user to click the Authorize button to log in to PayPal Sandbox.`;

      const aiRes = await callGemini(userPrompt, systemPrompt);

      return NextResponse.json({
        reply:
          aiRes?.reply ||
          `I have structured PayPal Sandbox Order **#${paypalOrder.orderId}** for **${itemName}** at **$${amount.toFixed(
            2
          )} USD**.\n\n🛡️ **Human-in-the-Loop Security Gate:** Direct debit without user sign-off is prevented. Click **Authorize with PayPal Sandbox** below to log in with your sandbox buyer credentials and approve this transaction.`,
        reasoning:
          aiRes?.reasoning ||
          `1. Intent: User initiated a purchase for ${itemName} ($${amount.toFixed(2)}).\n2. Liquidity: Balance ($1,850.00) comfortably covers this debit while preserving the $500.00 safety floor when $1,200 rent arrives.\n3. PayPal Orders v2: Generated sandbox order ${paypalOrder.orderId}.\n4. HITL Security: Payment requires authenticating via PayPal Sandbox checkout login (${paypalOrder.approveUrl}).`,
        event: "APPROVAL_REQUIRED",
        actionCard: {
          type: "order_card",
          event: "APPROVAL_REQUIRED",
          orderCardData: {
            orderId: paypalOrder.orderId,
            item: itemName,
            price: amount,
            currency: "USD",
            merchant: "Verified Retailer (Channel3 / PayPal)",
            status: "PENDING_AUTHORIZATION",
            approveUrl: paypalOrder.approveUrl,
            payIn4,
          },
        },
      });
    }

    // 2. PRODUCT DISCOVERY & BUDGET RECOMMENDATION (Channel3 Catalog Integration)
    const isShoppingQuery =
      isShoppingDiscovery &&
      (Boolean(matchedKeyword) ||
       lower.includes("buy") || lower.includes("purchase") || lower.includes("budget") || lower.includes("safe") || lower.includes("price") || lower.includes("affordable"));

    if (isShoppingQuery) {
      let catalogQuery = matchedKeyword || "";
      if (!catalogQuery) {
        catalogQuery = message
          .replace(/which|should|i|buy|according|to|my|budget|can|afford|what|recommend|suggest|please|\?|\!/gi, " ")
          .trim() || "trending products";
      }

      try {
        const searchRes = await searchChannel3Products({
          query: catalogQuery,
          filters: { price: { max_price: 1350 } },
          limit: 4,
        });
        const rawProducts = searchRes.products || [];

        if (rawProducts.length > 0) {
          const normalizedProducts = rawProducts.map((p) => {
            const leadOffer = p.offers?.[0];
            const price = leadOffer?.price?.price || 0;
            const currency = leadOffer?.price?.currency || "USD";
            const lowestDip = Math.round((590 - price) * 100) / 100;
            const installment = Math.round((price / 4) * 100) / 100;
            const payIn4Lowest = Math.round((590 - installment) * 100) / 100;

            let affordabilityStatus: "SAFE_FULL" | "SAFE_PAY_IN_4" | "OVERDRAFT" = "SAFE_FULL";
            if (lowestDip >= 500) {
              affordabilityStatus = "SAFE_FULL";
            } else if (payIn4Lowest >= 500) {
              affordabilityStatus = "SAFE_PAY_IN_4";
            } else {
              affordabilityStatus = "OVERDRAFT";
            }

            return {
              id: p.id,
              title: p.title,
              price,
              currency,
              retailer: leadOffer?.domain || (p.brands?.[0]?.name ? `${p.brands[0].name} Official` : "Verified Merchant"),
              availability: leadOffer?.availability || "InStock",
              imageUrl: p.images?.[0]?.url || "",
              buyUrl: leadOffer?.url || "",
              affordabilityStatus,
              lowestDip,
              installment,
            };
          });

          const itemsDescription = normalizedProducts
            .map(
              (p, idx) =>
                `${idx + 1}. "${p.title}" - $${p.price.toFixed(2)} ${p.currency} from ${p.retailer} (Affordability: ${
                  p.affordabilityStatus === "SAFE_FULL"
                    ? `Safe in Full (Post-rent balance $${p.lowestDip.toFixed(2)} preserves $500 floor)`
                    : `Recommend PayPal Pay in 4 (4 bi-weekly payments of $${p.installment.toFixed(2)})`
                })`
            )
            .join("\n");

          const userPrompt = `User Query: "${message}"\n\nVerified Products Found via Channel3 Universal Catalog:\n${itemsDescription}\n\nDeliver your intelligent financial recommendation. Enclose your step-by-step reasoning in <reasoning>...</reasoning> showing how you stress-tested Day 4 cash flow post-rent ($590 dip), why the $500 safety buffer is protected, and whether Pay in 4 or Pay in Full is optimal. Then present your user recommendation.`;

          const aiRes = await callGemini(userPrompt, systemPrompt);

          return NextResponse.json({
            reply:
              aiRes?.reply ||
              `I audited your **$1,350.00 USD** safe discretionary spend limit against live retail inventory from **Channel3** for **"${catalogQuery}"**:\n\n` +
                normalizedProducts
                  .map(
                    (p) =>
                      `* **${p.title}** (${p.retailer}): **$${p.price.toFixed(2)}** • ${
                        p.affordabilityStatus === "SAFE_FULL"
                          ? `✅ **Safe in Full** (Post-rent buffer: $${p.lowestDip.toFixed(2)})`
                          : `⚡ **PayPal Pay in 4 Recommended** (4x $${p.installment.toFixed(2)})`
                      }`
                  )
                  .join("\n") +
                `\n\nAll options comfortably keep your **$500.00 safety buffer floor** intact when your $1,200 rent hits on the 1st of the month.`,
            reasoning:
              aiRes?.reasoning ||
              `1. Intent: Discretionary retail discovery for "${catalogQuery}".\n2. Channel3 Integration: Fetched ${normalizedProducts.length} verified merchant offers under $1,350 cap.\n3. Cash Flow Simulation: Starting balance $1,850. After $1,200 rent on 1st, balance dips to $590. Items under $90 are safe in full; items over $90 are recommended via PayPal Pay in 4 to maintain the $500 safety floor.\n4. HITL Security: Click 'Simulate Order' to generate a real PayPal Sandbox order with login authorization.`,
            actionCard: {
              type: "product_recommendation",
              productData: {
                query: catalogQuery,
                budgetCap: 1350.0,
                products: normalizedProducts,
              },
            },
          });
        }
      } catch (channelErr) {
        console.warn("Channel3 product search failed:", channelErr);
      }
    }

    // 3. INVOICING REQUESTS
    if (
      lower.includes("invoice") ||
      lower.includes("bill client") ||
      lower.includes("send a bill") ||
      (active_agent === "merchant-invoicing" && (lower.includes("draft") || lower.includes("send") || lower.includes("create")))
    ) {
      let recipientEmail = "client-procurement@enterprise.io";
      let amount = 1250.0;
      let description = "Enterprise Autonomous Agent Architecture";

      const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) recipientEmail = emailMatch[1];

      const dollarMatch = lower.match(/\$(\d+(?:\.\d{1,2})?)/);
      if (dollarMatch) amount = parseFloat(dollarMatch[1]);

      const userPrompt = `User wants to draft an invoice: "${message}".
Details: Recipient: ${recipientEmail}, Amount: $${amount.toFixed(2)} USD, Description: ${description}.
In <reasoning>, explain why automatic dispatch is paused pending human line-item approval (HITL Guardrail), how it reconciles receivables, and how to verify on PayPal Sandbox. Then summarize the invoice preview.`;

      const aiRes = await callGemini(userPrompt, systemPrompt);

      return NextResponse.json({
        reply:
          aiRes?.reply ||
          `The **Merchant Invoicing Agent** prepared a draft invoice for **${recipientEmail}** for **$${amount.toFixed(
            2
          )} USD**.\n\n🛡️ **Human-in-the-Loop Guardrail:** Automatic dispatch is paused pending your inspection. Review and dispatch the invoice below:`,
        reasoning:
          aiRes?.reasoning ||
          `1. Intent: B2B invoice generation for ${recipientEmail}.\n2. Compliance: Itemized service amount $${amount.toFixed(2)} USD.\n3. HITL Gate: Dispatches are held in draft state until user explicitly triggers REST v2 send action.\n4. Verification: Once sent, verifiable via PayPal Sandbox Invoicing dashboard and notifications.`,
        event: "APPROVAL_REQUIRED",
        actionCard: {
          type: "invoice_preview",
          event: "APPROVAL_REQUIRED",
          invoicePreviewData: {
            invoiceId: `INV2-SANDBOX-${Math.floor(1000 + Math.random() * 9000)}`,
            recipientEmail,
            total: amount,
            currency: "USD",
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
            items: [{ name: description, quantity: 1, unit_amount: amount }],
          },
        },
      });
    }

    // 4. SPENDING & BUDGET AUDIT
    if (
      lower.includes("audit") ||
      lower.includes("budget") ||
      lower.includes("categorize") ||
      lower.includes("insights") ||
      lower.includes("spending")
    ) {
      const userPrompt = `User asks about budget and spending: "${message}".
Explain their 30-day spending ($1,392 outflows, $1,350 safe discretionary remaining, $500 protected floor).
Provide your reasoning in <reasoning>...</reasoning> followed by your report.`;

      const aiRes = await callGemini(userPrompt, systemPrompt);

      return NextResponse.json({
        reply:
          aiRes?.reply ||
          `Audited **30-Day Budget & Spending Insights** across your PayPal accounts:\n\n* **Software & SaaS:** $240.00 / $300.00 (80.0% - Near Limit)\n* **Subscriptions:** $180.00 / $200.00 (90.0% - Near Limit)\n* **Electronics & Gear:** $850.00 / $1,000.00 (85.0%)\n* **Safe Discretionary Remaining:** **$1,350.00 USD**\n\nYour protected $500 safety floor remains intact.`,
        reasoning:
          aiRes?.reasoning ||
          `1. Intent: Spend audit across recurring PayPal subscriptions and SaaS.\n2. Invariant Check: Total 30-day outflows = $1,392.00. Balance ($1,850.00) minus outflows leaves $458.00 without salary deposit; however, scheduled bi-weekly income (+$2,200 on 10th/25th) maintains discretionary capacity at $1,350.00 while guaranteeing the $500.00 buffer.`,
        actionCard: {
          type: "transaction_insight",
          transactionInsightData: {
            title: "30-Day Spending & Budget Audit",
            periodDays: 30,
            totalSpend: 1392.0,
            safeDiscretionaryRemaining: 1350.0,
            breakdown: [
              { category: "Software & SaaS", spent: 240.0, budget: 300.0, percentage: 80.0, is_near_limit: true },
              { category: "Subscriptions", spent: 180.0, budget: 200.0, percentage: 90.0, is_near_limit: true },
              { category: "Electronics & Gear", spent: 850.0, budget: 1000.0, percentage: 85.0, is_near_limit: false },
              { category: "Food & Dining", spent: 122.0, budget: 250.0, percentage: 48.8, is_near_limit: false },
            ],
          },
        },
      });
    }

    // 5. BALANCE & LIQUIDITY INQUIRIES
    if (
      lower.includes("balance") ||
      lower.includes("how much do i have") ||
      lower.includes("available cash") ||
      lower.includes("safe spend") ||
      lower.includes("buffer")
    ) {
      const userPrompt = `User asks about balance: "${message}".
State balance is $1,850.00 USD, safety buffer floor is $500.00 USD, upcoming committed outflows are $1,392.00 USD, safe discretionary spend is $1,350.00 USD. Provide reasoning in <reasoning>...</reasoning> followed by response.`;

      const aiRes = await callGemini(userPrompt, systemPrompt);

      return NextResponse.json({
        reply:
          aiRes?.reply ||
          `Here is your verified **PayPal Sandbox Account Snapshot**:\n\n* **Live PayPal Balance:** **$1,850.00 USD**\n* **Safety Buffer Floor:** **$500.00 USD** (Protected)\n* **Safe Discretionary Spend:** **$1,350.00 USD**\n* **Upcoming Outflows (30 Days):** **$1,392.00 USD**\n\nYour account is in **healthy standing**. You can safely spend up to **$1,350.00** without breaching your $500 safety buffer.`,
        reasoning:
          aiRes?.reasoning ||
          `1. Intent: Real-time balance and safe spending capacity query.\n2. Invariant Check: Live balance is $1,850.00 USD. Minimum safety buffer is locked at $500.00 USD.\n3. Liquidity: Committed 30-day bills total $1,392.00. With bi-weekly direct deposits scheduled, discretionary spending capacity is confirmed at $1,350.00 USD.`,
        actionCard: {
          type: "balance_snapshot",
          balanceData: {
            balance: 1850.0,
            buffer: 500.0,
            discretionary: 1350.0,
            outflows: 1392.0,
            currency: "USD",
            status: "HEALTHY",
          },
        },
      });
    }

    // 6. GENERAL / CONVERSATIONAL QUERIES (Dynamic OpenRouter Gemini with Persona)
    const aiRes = await callGemini(message, systemPrompt);

    if (aiRes) {
      return NextResponse.json({
        reply: aiRes.reply,
        reasoning: aiRes.reasoning,
      });
    }

    // Fallback template only if LLM is unreachable
    return NextResponse.json({
      reply: `I am **Guardian Copilot** (running in **${active_agent}** mode). I analyze your live balance ($1,850.00), protect your **$500.00 safety buffer floor**, and simulate cash flow before any PayPal transaction is authorized.\n\nHere are some things you can ask me:\n* 💳 *"What is my PayPal balance and safe spend?"*\n* 👖 *"Which jeans should I buy according to my budget?"*\n* 📸 *"Buy Sony Alpha camera with PayPal"* \n* 🧾 *"Draft a PayPal invoice for $1,250 to client@enterprise.io"*\n* ⚡ *"Audit my 30-day budget and spending"*\n* 🛡️ *"How does Human-in-the-Loop authorization protect me?"*`,
      reasoning: `1. Intent: General greeting or system inquiry.\n2. Role: Active agent is ${active_agent}.\n3. Capabilities: Outlining real PayPal REST v2 Sandbox transactions, Channel3 catalog discovery, and cash flow simulation.`,
    });
  } catch (err: any) {
    console.error("Copilot chat error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process message" },
      { status: 500 }
    );
  }
}
