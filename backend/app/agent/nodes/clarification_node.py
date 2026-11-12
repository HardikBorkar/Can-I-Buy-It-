"""
Clarification & Conversational Guidance Node for Guardian Copilot.
Handles conversational, exploratory, and open-ended queries using OpenRouter (Gemini 2.5 Flash).
Acts as a warm, knowledgeable, empathetic financial guide while preventing hallucination
and enforcing the $500.00 protected safety floor.
"""

import logging
from typing import Any, Dict
import httpx

from backend.app.agent.state import AgentState
from backend.app.agent.harness import assert_read_only_isolation
from backend.app.core.config import settings

logger = logging.getLogger("guardian.node.clarification")


async def call_llm_guidance(query: str, balance: float, user_id: str) -> str:
    """
    Calls OpenRouter (Gemini 2.5 Flash) to generate warm, empathetic financial guidance.
    """
    api_key = settings.OPENROUTER_API_KEY or settings.GEMINI_API_KEY
    discretionary = max(0.0, balance - 500.0)

    system_prompt = f"""You are Guardian, a warm, thoughtful, and highly capable AI financial copilot integrated with PayPal.
Your mission is to guide the user with financial confidence, help them evaluate purchases, create invoices, and protect their liquidity.
You enforce a strict $500.00 USD protected safety floor to prevent accidental overdrafts.

Active User Profile:
- User ID: {user_id}
- Available PayPal Balance: ${balance:,.2f} USD
- Protected Safety Floor: $500.00 USD (Sacred reserve)
- Discretionary Safe Spend: ${discretionary:,.2f} USD

Tone and Persona Guidelines:
1. Speak in a gentle, reassuring, and conversational tone — like an expert personal financial advisor.
2. NEVER sound like a command-line parser. Do NOT output rigid syntax requirements or tell the user to type in an exact format.
3. If the user greeted you ("hi", "hello", "hey"), greet them warmly, mention their current PayPal balance (${balance:,.2f} USD), and invite them to explore purchases, analyze last month's spending, or draft invoices.
4. If the user mentioned wanting an item or shopping without exact price or merchant (e.g. "I want a keyboard", "Can I buy a laptop?"):
   - Validate their goal warmly.
   - Mention their discretionary spending limit of ${discretionary:,.2f} USD (which preserves their $500 reserve).
   - Gently ask what brand, model, or approximate price they have in mind so you can run the full multi-agent consensus and price benchmark for them.
5. If the user asked general questions about budgeting, PayPal Pay-in-4, or financial health, give clear and practical advice.
6. Keep responses clean, concise (2 to 3 short paragraphs), and well-structured with markdown.
"""

    if not api_key:
        return (
            f"Hello! I'm Guardian, your PayPal financial copilot. "
            f"Your current available balance is **${balance:,.2f} USD** with a protected safety reserve of **$500.00 USD** "
            f"(leaving **${discretionary:,.2f} USD** in safe discretionary spend).\n\n"
            f"I can help you evaluate a purchase, draft a client invoice, or visualize your last 30 days of expenditures. "
            f"What would you like to explore today?"
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query},
                    ],
                    "temperature": 0.6,
                    "max_tokens": 500,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                if content:
                    return content
    except Exception as exc:
        logger.warning("OpenRouter guidance call failed: %s", exc)

    return (
        f"Hello! I'm Guardian, your PayPal financial copilot. "
        f"Your current available balance is **${balance:,.2f} USD**, with **${discretionary:,.2f} USD** "
        f"in safe discretionary spend above your $500.00 protected reserve.\n\n"
        f"Let me know what you'd like to do—whether evaluating a purchase, drafting an invoice, or checking your spending breakdown."
    )


async def clarification_node(state: AgentState) -> Dict[str, Any]:
    """
    Returns gentle, conversational guidance powered by OpenRouter (Gemini 2.5 Flash)
    without executing any unauthorized financial debits.
    """
    intent = state.get("intent") or "CLARIFICATION_NEEDED"
    assert_read_only_isolation(intent, "clarification_node")

    messages = state.get("messages", [])
    user_query = ""
    if messages:
        last = messages[-1]
        user_query = last.content if hasattr(last, "content") else str(last)

    balance = float(state.get("current_balance") or 3500.0)
    user_id = str(state.get("user_id") or "alex_cro")

    reply = await call_llm_guidance(user_query, balance, user_id)

    return {
        "final_response": reply,
        "action_status": "idle",
        "pending_action": None,
        "action_card": None,
        "tools_called": [],
    }

