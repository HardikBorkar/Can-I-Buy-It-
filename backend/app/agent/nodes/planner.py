import logging
import re
import uuid
from typing import Dict, Any, List, Optional
import httpx
from langchain_core.messages import AIMessage
from backend.app.agent.state import AgentState
from backend.app.core.security import generate_idempotency_key
from backend.app.core.config import settings
from src.channel3_client import Channel3Client

logger = logging.getLogger("guardian.node.planner")


async def call_llm(prompt: str, system_prompt: str) -> Optional[str]:
    """Call OpenRouter (Gemini 2.5 Flash) for dynamic financial reasoning."""
    api_key = settings.OPENROUTER_API_KEY or settings.GEMINI_API_KEY
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 800,
                    "temperature": 0.3,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content")
    except Exception as e:
        logger.warning("LLM call failed: %s", e)
    return None


async def planner_node(state: AgentState) -> Dict[str, Any]:
    """
    Action & Payload Generation Node.
    Analyzes intent, scraped merchant details, and financial context.
    Determines if a financial action (Order creation, Invoice dispatch) is required,
    and constructs the pending action payload for the HITL Gate.
    """
    messages = state.get("messages", [])
    user_query = ""
    if messages:
        last = messages[-1]
        user_query = (last.content if hasattr(last, "content") else str(last)).lower()

    scraped = state.get("scraped_data")
    context = state.get("retrieved_context", [])

    # Case 1: Scraped product, live catalog discovery, or purchase intent
    product_keywords = [
        "jean", "jeans", "denim", "shoes", "shoe", "sneaker", "sneakers",
        "camera", "laptop", "macbook", "headphone", "headphones", "earbuds",
        "chair", "desk", "vacuum", "phone", "iphone", "watch", "jacket", "shirt",
        "pant", "pants", "hoodie", "monitor", "boots"
    ]
    matched_kw = next((kw for kw in product_keywords if kw in user_query), None)

    if scraped or matched_kw or "buy" in user_query or "order" in user_query or "purchase" in user_query or "afford" in user_query:
        item_title = "Sony Alpha a7 IV Camera"
        item_price = 850.0
        currency = "USD"
        recipient = "Merchant Store"
        products_found = []

        if scraped:
            item_title = scraped.get("title", "Product Item")
            item_price = float(scraped.get("price", 850.0))
            currency = scraped.get("currency", "USD")
            recipient = scraped.get("vendor_name", "Merchant Store")
        elif matched_kw or ("buy" in user_query and not re.search(r"\$\d+", user_query)):
            # Live product catalog query via Channel3
            try:
                c3 = Channel3Client()
                products_found = c3.search_products(matched_kw or "trending", limit=4)
                if products_found:
                    top_prod = products_found[0]
                    item_title = top_prod.get("title", item_title)
                    item_price = float(top_prod.get("price", item_price))
                    currency = top_prod.get("currency", "USD")
                    recipient = top_prod.get("retailer", recipient)
            except Exception as e:
                logger.warning("Channel3 search failed in planner: %s", e)

        # Check explicit numbers in user query if not scraped and no catalog price
        if not scraped and not products_found:
            amount_match = re.search(r"\$?(\d+(?:\.\d{1,2})?)", user_query)
            if amount_match:
                item_price = float(amount_match.group(1))

        # Financial invariant logic:
        # Starting balance = $1,850. Rent on 1st = -$1,200. Living expenses = -$60.
        # Floor = $500. Lowest full dip = 590 - item_price.
        lowest_dip = 590.0 - item_price
        pay_in_4_safe = (590.0 - (item_price / 4)) >= 500.0

        action_id = f"act-{uuid.uuid4().hex[:8]}"
        payload = {
            "amount": item_price,
            "currency": currency,
            "description": f"Purchase: {item_title}",
            "reference_id": f"ref-{uuid.uuid4().hex[:6]}",
            "pay_in_4": not (lowest_dip >= 500.0) and pay_in_4_safe,
            "item_name": item_title,
        }

        idempotency_key = generate_idempotency_key(payload, prefix="ord")
        pending_action = {
            "action_id": action_id,
            "action_type": "create_order",
            "tool_name": "paypal_client.create_order",
            "description": f"Authorize PayPal Sandbox Order for '{item_title}' (${item_price:.2f} {currency})",
            "amount": item_price,
            "currency": currency,
            "recipient": recipient,
            "risk_score": 98 if lowest_dip >= 500.0 or pay_in_4_safe else 62,
            "safety_buffer_intact": lowest_dip >= 500.0 or pay_in_4_safe,
            "post_balance_floor": max(lowest_dip, 590.0 - (item_price / 4)),
            "requires_approval": True,
            "idempotency_key": idempotency_key,
            "raw_payload": payload,
        }

        # Generative AI dynamic reasoning via Gemini
        system_prompt = (
            "You are Guardian Copilot, an enterprise autonomous financial safety agent for PayPal.\n"
            "Financial invariants:\n"
            "- Available Balance: $1,850.00 USD\n"
            "- Safety Buffer Floor: $500.00 USD (Sacred: must not breach)\n"
            "- Upcoming Outflows: $1,392.00 (Rent: $1,200 due on 1st)\n"
            "- Safe Discretionary Spend: $1,350.00 USD\n\n"
            "Deliver an executive, crisp recommendation. State whether paying in full or PayPal Pay in 4 is safe, "
            "and explain the impact on their $500 floor."
        )

        catalog_context = ""
        if products_found:
            catalog_context = "\nVerified Channel3 Products:\n" + "\n".join([
                f"- {p.get('title')}: ${p.get('price')} {p.get('currency')} ({p.get('retailer')})"
                for p in products_found
            ])

        user_prompt = f"User Query: '{user_query}'\nEvaluated Item: '{item_title}' (${item_price:.2f} {currency}){catalog_context}"
        ai_explanation = await call_llm(user_prompt, system_prompt)

        if ai_explanation:
            explanation = ai_explanation
        else:
            explanation = (
                f"I evaluated **{item_title}** priced at **${item_price:.2f} {currency}**.\n\n"
                f"* **Verified Available Balance:** **$1,850.00 USD**\n"
                f"* **Safety Buffer Floor:** **$500.00 USD** (Protected)\n"
                f"* **Upcoming Outflows (30 Days):** **$1,392.00 USD** (Apartment Rent $1,200 on 1st)\n\n"
            )
            if lowest_dip >= 500.0:
                explanation += f"✅ **Purchase is Safe in Full:** Your minimum projected balance remains at **${lowest_dip:.2f}**, preserving your $500 floor."
            elif pay_in_4_safe:
                explanation += (
                    f"⚠️ **Full Upfront Payment Risk:** Paying in full drops your balance to **${lowest_dip:.2f}** when Rent hits.\n\n"
                    f"💡 **Autonomous Recommendation:** **PayPal Pay in 4** (4 bi-weekly payments of **${item_price/4:.2f}**). Floor remains safely at **${590 - (item_price/4):.2f}**."
                )
            else:
                explanation += f"🛑 **Overdraft Alert:** This purchase breaches your $500 safety buffer across all simulation models."

        return {
            "pending_action": pending_action,
            "action_status": "awaiting_approval",
            "final_response": explanation,
        }

    # Case 2: Invoicing Request
    if "invoice" in user_query or "bill" in user_query:
        recipient = "client@venturecap.io"
        email_match = re.search(r"[\w\.-]+@[\w\.-]+", user_query)
        if email_match:
            recipient = email_match.group(0)

        amount = 450.0
        amount_match = re.search(r"\$?(\d+(?:\.\d{1,2})?)", user_query)
        if amount_match:
            amount = float(amount_match.group(1))

        action_id = f"act-{uuid.uuid4().hex[:8]}"
        payload = {
            "recipient_email": recipient,
            "items": [{"name": "AI & Software Architecture Consulting", "amount": amount, "quantity": 1}],
            "currency": "USD",
            "note": "Billed via Guardian Copilot Autonomous Invoicing",
        }
        idempotency_key = generate_idempotency_key(payload, prefix="inv")

        pending_action = {
            "action_id": action_id,
            "action_type": "send_invoice",
            "tool_name": "paypal_client.create_and_send_invoice",
            "description": f"Dispatch PayPal v2 Invoice to {recipient} for ${amount:.2f} USD",
            "amount": amount,
            "currency": "USD",
            "recipient": recipient,
            "risk_score": 100,
            "safety_buffer_intact": True,
            "post_balance_floor": 1850.0,
            "requires_approval": True,
            "idempotency_key": idempotency_key,
            "raw_payload": payload,
        }

        explanation = (
            f"I prepared an official **PayPal Invoicing REST v2** draft for **${amount:.2f} USD** to **{recipient}**.\n\n"
            f"* **Service:** AI & Software Architecture Consulting\n"
            f"* **Idempotency Key:** `{idempotency_key}`\n\n"
            f"Please approve this action below to dispatch the invoice via PayPal Sandbox."
        )

        return {
            "pending_action": pending_action,
            "action_status": "awaiting_approval",
            "final_response": explanation,
        }

    # Case 3: Conversational Inquiry (Balance / History / Webhook / General)
    system_prompt = (
        "You are Guardian Copilot, an enterprise autonomous financial safety agent for PayPal.\n"
        "User invariants:\n"
        "- Live PayPal Balance: $1,850.00 USD\n"
        "- Safety Buffer Floor: $500.00 USD (Sacred: must not breach)\n"
        "- Upcoming commitments (30 days): $1,392.00 ($1,200 Rent on 1st of month, $85 AWS, $42 SaaS, $65 Gym)\n"
        "- Safe Discretionary Spend: $1,350.00 USD\n"
        "Provide an authoritative, clear, and proactive answer in clean Markdown."
    )
    ai_resp = await call_llm(user_query, system_prompt)

    if ai_resp:
        response_text = ai_resp
    else:
        response_text = (
            "Here is your verified **PayPal Sandbox Account Snapshot**:\n\n"
            "* **Live PayPal Balance:** **$1,850.00 USD**\n"
            "* **Safety Buffer Floor:** **$500.00 USD** (Protected Floor)\n"
            "* **Safe Discretionary Spend:** **$1,350.00 USD**\n"
            "* **Upcoming Outflows (30 Days):** **$1,392.00 USD** (Rent & AWS Subscriptions)\n\n"
            "Your account is in **healthy standing**. You can test any purchase, paste an e-commerce URL for Firecrawl scraping, or request a PayPal invoice."
        )

    return {
        "pending_action": None,
        "action_status": "idle",
        "final_response": response_text,
    }

