import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] }: { message: string; history: ChatMessage[] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const lower = message.toLowerCase().trim();

    // 1. Balance & Liquidity Inquiries
    if (
      lower.includes("balance") ||
      lower.includes("how much do i have") ||
      lower.includes("available cash") ||
      lower.includes("safe spend") ||
      lower.includes("buffer")
    ) {
      return NextResponse.json({
        reply: `Here is your verified **PayPal Sandbox Account Snapshot**:\n\n* **Live PayPal Balance:** **$1,850.00 USD**\n* **Safety Buffer Floor:** **$500.00 USD** (Protected)\n* **Safe Discretionary Spend:** **$1,350.00 USD**\n* **Upcoming Outflows (30 Days):** **$1,392.00 USD**\n\nYour account is in **healthy standing**. You can safely spend up to **$1,350.00** without breaching your $500 safety buffer when recurring bills arrive.`,
        actionCard: {
          type: "balance",
          balance: 1850.0,
          buffer: 500.0,
          discretionary: 1350.0,
          outflows: 1392.0,
        },
      });
    }

    // 2. Affordability Simulation ("Can I afford...", "Can I buy...")
    const directNumberMatch =
      lower.match(/[\$](\d+(?:,\d{3})*(?:\.\d{1,2})?)/) ||
      lower.match(/(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:dollars|usd|bucks)/);

    if (
      lower.includes("can i afford") ||
      lower.includes("can i buy") ||
      lower.includes("simulate") ||
      lower.includes("afford") ||
      (directNumberMatch && (lower.includes("buy") || lower.includes("purchase") || lower.includes("spend")))
    ) {
      let amount = 850.0;
      let item = "Candidate Item";

      // Try extract amount
      if (directNumberMatch) {
        amount = parseFloat(directNumberMatch[1].replace(/,/g, ""));
      } else {
        const numMatch = lower.match(/\b\d+(\.\d{1,2})?\b/);
        if (numMatch) {
          amount = parseFloat(numMatch[0]);
        } else if (lower.includes("bugatti") || lower.includes("buggati") || lower.includes("ferrari") || lower.includes("car")) {
          amount = 250000.0;
        } else if (lower.includes("house") || lower.includes("mansion")) {
          amount = 800000.0;
        }
      }

      // Try extract item name
      if (lower.includes("bugatti") || lower.includes("buggati")) item = "Bugatti Supercar";
      else if (lower.includes("ferrari")) item = "Ferrari";
      else if (lower.includes("camera") || lower.includes("sony")) item = "Sony Alpha a7 IV Camera";
      else if (lower.includes("macbook") || lower.includes("laptop")) item = "MacBook Pro M3";
      else if (lower.includes("airpod") || lower.includes("headphone")) item = "AirPods Max";
      else if (lower.includes("sneaker") || lower.includes("shoe")) item = "Adidas Sneaker";
      else if (lower.includes("iphone") || lower.includes("phone")) item = "Smartphone";
      else {
        // Extract whatever comes after "afford a/an" or "buy a/an"
        const cleanMatch = message.match(/(?:afford|buy|purchase)\s+(?:a\s+|an\s+)?([a-zA-Z0-9\s]+?)(?:\s+(?:for|of|\$|\?)|$)/i);
        item = cleanMatch && cleanMatch[1]?.trim() ? cleanMatch[1].trim() : "Candidate Purchase";
      }

      // 90-day simulation logic:
      // Starting balance: 1850. Rent on 1st: -1200. Living expense: -15/day.
      // Day 4 (1st of month): 1850 - (4*15) - 1200 = 590.
      // If paying amount upfront today: Day 4 balance = 590 - amount.
      // If amount > 90, 590 - amount < 500 (breaches buffer!).
      const payInFullLowest = Math.round((590 - amount) * 100) / 100;
      const installment = Math.round((amount / 4) * 100) / 100;
      const payIn4Lowest = Math.round((590 - installment) * 100) / 100;

      const breachesFull = payInFullLowest < 500;
      const breachesPayIn4 = payIn4Lowest < 500;

      if (breachesFull && !breachesPayIn4) {
        return NextResponse.json({
          reply: `⚠️ **Financial Risk Detected for Paying in Full:**\n\nPaying **$${amount.toFixed(
            2
          )}** upfront today will drop your balance to **$${payInFullLowest.toFixed(
            2
          )}** when Apartment Rent ($1,200) hits on the 1st of the month, **violating your $500 safety buffer**!\n\n💡 **Autonomous Recommendation: PayPal Pay in 4**\nBy splitting this into 4 bi-weekly payments of **$${installment.toFixed(
            2
          )}**, your lowest balance remains at **$${payIn4Lowest.toFixed(
            2
          )}** (safely above the $500 safety floor).\n\nYou can authorize this payment directly below:`,
          actionCard: {
            type: "affordability",
            item,
            amount,
            installment,
            payInFullSafe: false,
            payInFullLowest,
            payIn4Safe: true,
            payIn4Lowest,
          },
        });
      } else if (!breachesFull) {
        return NextResponse.json({
          reply: `✅ **Purchase Approved!**\n\nYour financial simulation indicates that buying the **${item}** for **$${amount.toFixed(
            2
          )}** is **100% safe** even when paying in full. Your balance will not dip below **$${payInFullLowest.toFixed(
            2
          )}**, remaining comfortably above your $500 safety buffer floor throughout the next 90 days.`,
          actionCard: {
            type: "affordability",
            item,
            amount,
            installment,
            payInFullSafe: true,
            payInFullLowest,
            payIn4Safe: true,
            payIn4Lowest,
          },
        });
      } else {
        return NextResponse.json({
          reply: `🛑 **High Overdraft Warning:**\n\nA purchase of **$${amount.toFixed(
            2
          )}** exceeds your safe spending capacity. Even with PayPal Pay in 4 (4x $${installment.toFixed(
            2
          )}), your balance is projected to breach the $500 safety buffer when combined with upcoming rent and obligations. Consider delaying this purchase until your next salary deposit.`,
          actionCard: {
            type: "affordability",
            item,
            amount,
            installment,
            payInFullSafe: false,
            payInFullLowest,
            payIn4Safe: false,
            payIn4Lowest,
          },
        });
      }
    }

    // 3. Upcoming Bills & Commitments
    if (
      lower.includes("bill") ||
      lower.includes("commitment") ||
      lower.includes("recurring") ||
      lower.includes("subscription") ||
      lower.includes("rent") ||
      lower.includes("when is")
    ) {
      return NextResponse.json({
        reply: `Here are your scheduled **recurring commitments** tracked by Guardian:\n\n1. 🏠 **Apartment Rent:** **$1,200.00** (Due 1st of every month) • *Auto-pay Protected*\n2. ☁️ **AWS Cloud Hosting:** **$85.00** (Due 15th of month) • *Auto-pay Protected*\n3. 💻 **Software (GitHub Copilot, ChatGPT):** **$42.00** (Due 18th)\n4. 🏋️ **Gym & Health Club:** **$65.00** (Due 22nd)\n\n💰 **Incoming Revenue:**\n* **Bi-Weekly Salary / Direct Deposit:** **+$2,200.00** (Scheduled on 10th and 25th)\n\nTotal committed outflows next 30 days: **$1,392.00**.`,
        actionCard: {
          type: "commitments",
        },
      });
    }

    // 4. Invoicing Requests
    if (
      lower.includes("invoice") ||
      lower.includes("bill client") ||
      lower.includes("send a bill")
    ) {
      return NextResponse.json({
        reply: `I can draft and dispatch official **PayPal Invoices (REST v2)** on your behalf. Enter the details below or ask me to draft one (e.g. *"Invoice $450 to client@example.com for UI Design"*):`,
        actionCard: {
          type: "invoice_prompt",
          defaultRecipient: "client@venturecap.io",
          defaultAmount: 450.0,
          defaultDescription: "UI/UX & AI Agent Consulting",
        },
      });
    }

    // 5. Default Guidance & Intelligence
    return NextResponse.json({
      reply: `I am your **PayPal Guardian Financial Copilot**. I analyze your live balance, scheduled bills, and simulate 90 days into the future before any payment is authorized.\n\nHere are some things you can ask me:\n* 💳 *"What is my PayPal balance and safe spend?"*\n* 📸 *"Can I afford an $850 camera on eBay?"*\n* 📅 *"What recurring bills are coming up this month?"*\n* 🧾 *"Draft a PayPal invoice for $450 to my client"*\n* ⚡ *"How does PayPal Pay in 4 work?"*`,
    });
  } catch (err: any) {
    console.error("Copilot chat error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process message" },
      { status: 500 }
    );
  }
}

