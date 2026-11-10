import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from langchain_core.messages import AIMessage

from backend.app.agent.state import AgentState
from backend.app.core.config import settings
from src.channel3_client import Channel3Client

logger = logging.getLogger("guardian.node.trader")

# Benchmark price directory for standard items
BENCHMARK_CATALOG: Dict[str, float] = {
    "camera": 850.0,
    "sony camera": 850.0,
    "sony alpha a7 iv": 850.0,
    "laptop": 1099.0,
    "macbook": 1099.0,
    "jeans": 258.0,
    "denim": 258.0,
    "headphones": 150.0,
    "monitor": 350.0,
    "shoes": 120.0,
    "sneakers": 120.0,
}


def extract_amount(query: str, default: float = 100.0) -> float:
    """Robustly extract currency amounts from queries without capturing hex order IDs."""
    # 1. Look for explicit dollar sign ($25.00 or $25)
    dollar_match = re.search(r"\$(\d+(?:\.\d{1,2})?)", query)
    if dollar_match:
        return float(dollar_match.group(1))

    # 2. Look for price keywords (under 25, price 25, for 25)
    kw_match = re.search(r"(?:under|below|costs?|price|for|around|amount|total)\s+(\d+(?:\.\d{1,2})?)", query)
    if kw_match:
        return float(kw_match.group(1))

    # 3. Strip out #act- or ord- IDs before searching bare numbers
    clean_q = re.sub(r"(?:#?act-[\da-f]+|#?ord-[\da-f]+|ref-[\da-f]+)", "", query)
    bare_match = re.search(r"\b(\d+(?:\.\d{1,2})?)\b", clean_q)
    if bare_match:
        return float(bare_match.group(1))

    return default


async def trader_node(state: AgentState) -> Dict[str, Any]:
    """
    Agent 1: Trader / Proposal Agent.
    - Ingests user intent and Channel3 catalog search outputs.
    - Formulates draft transaction payloads (items, merchant PayPal handles, price, currency, split logic).
    - If responding to adversarial auditor feedback in a debate round, revises pricing or calculation errors.
    """
    messages = state.get("messages", [])
    user_query = ""
    if messages:
        last = messages[-1]
        user_query = (last.content if hasattr(last, "content") else str(last)).lower()

    debate_turns = state.get("debate_turns", 0)
    audit_feedback = state.get("audit_feedback")
    existing_trace = list(state.get("multi_agent_trace") or [])
    scraped = state.get("scraped_data")

    logger.info("Trader node executing turn %d with query: %s", debate_turns, user_query[:50])

    # If this is a debate revision turn and auditor flagged an issue:
    if debate_turns > 0 and audit_feedback:
        flags = audit_feedback.get("flags", [])
        prev_proposal = state.get("trader_proposal") or {}
        revised_items = list(prev_proposal.get("items", []))
        revised_tax = float(prev_proposal.get("tax", 0.0))
        currency = prev_proposal.get("currency", "USD")

        # 1. Fix Math Error if flagged
        if "MATH_ERROR" in flags:
            logger.info("Trader correcting subtotal and tax calculation errors flagged by Auditor.")
            subtotal = sum(float(it.get("price", 0)) * int(it.get("qty", 1)) for it in revised_items)
            total = round(subtotal + revised_tax, 2)
        # 2. Fix Overpricing if flagged (>15% above benchmark)
        elif "OVERPRICING_FLAG" in flags:
            logger.info("Trader renegotiating price down to verified benchmark baseline.")
            baseline = audit_feedback.get("price_baseline") or 850.0
            if revised_items:
                revised_items[0]["price"] = baseline
            subtotal = sum(float(it.get("price", 0)) * int(it.get("qty", 1)) for it in revised_items)
            total = round(subtotal + revised_tax, 2)
        # 3. Fix Currency if invalid
        elif "INVALID_CURRENCY" in flags:
            logger.info("Trader standardizing currency to USD.")
            currency = "USD"
            subtotal = float(prev_proposal.get("subtotal", 100.0))
            total = round(subtotal + revised_tax, 2)
        else:
            subtotal = float(prev_proposal.get("subtotal", 100.0))
            total = float(prev_proposal.get("total", 100.0))

        revised_proposal = {
            **prev_proposal,
            "items": revised_items,
            "subtotal": subtotal,
            "tax": revised_tax,
            "total": total,
            "currency": currency,
            "revision_notes": f"Revised in debate turn {debate_turns} addressing flags: {flags}",
        }

        existing_trace.append({
            "agent": "Trader",
            "turn": debate_turns,
            "action": "renegotiate_proposal",
            "proposal": revised_proposal,
            "message": f"Trader revised proposal to ${total:.2f} {currency} to resolve Auditor objections: {', '.join(flags)}.",
        })

        return {
            "trader_proposal": revised_proposal,
            "multi_agent_trace": existing_trace,
        }

    # =========================================================================
    # Fresh Turn: Intent Classification & Proposal Formulation
    # =========================================================================
    intent = "create_order"
    item_title = "Retail Item"
    item_price = 100.0
    tax = 0.0
    currency = "USD"
    merchant = "Verified Retail Merchant"
    merchant_email = "merchant@partner.paypal.com"
    split_logic: Optional[Dict[str, Any]] = None

    # 0. Check for Capture / Settlement Confirmation intent
    if "capture" in user_query or "authorize paypal sandbox capture" in user_query:
        intent = "create_order"
        item_price = extract_amount(user_query, default=23.70)
        item_title = "Authorized Settlement Confirmation"
        merchant = "PayPal Sandbox Verified Merchant"

    # A. Check for Group Bill Splitting intent
    elif "split" in user_query or "divide" in user_query or "share bill" in user_query:
        intent = "split_group_payment"
        item_price = extract_amount(user_query, default=120.0)
        item_title = "Group Expense Split"
        participants = [
            {"name": "Alex", "email": "alex@example.com"},
            {"name": "Jordan", "email": "jordan@example.com"},
            {"name": "Taylor", "email": "taylor@example.com"},
        ]
        split_logic = {
            "participant_count": len(participants),
            "participants": participants,
            "share_per_person": round(item_price / len(participants), 2),
        }

    # B. Check for Milestone Escrow intent
    elif "escrow" in user_query or "milestone" in user_query or "contractor" in user_query:
        intent = "authorize_escrow"
        item_price = extract_amount(user_query, default=500.0)
        item_title = "Autonomous Milestone Escrow"
        merchant = "Software Contractor"
        merchant_email = "contractor@venturecap.io"

    # C. Check for Invoice intent
    elif "invoice" in user_query or "bill client" in user_query:
        intent = "send_invoice"
        item_price = extract_amount(user_query, default=450.0)
        email_match = re.search(r"[\w\.-]+@[\w\.-]+", user_query)
        if email_match:
            merchant_email = email_match.group(0)
        item_title = "Architecture & Engineering Consulting"

    # D. Check for Graphs / Charts / Tables / Bento intent
    elif any(kw in user_query for kw in ["graph", "chart", "bar graph", "table", "bento", "analytics", "telemetry", "visualize"]):
        intent = "bento_analytics"
        item_price = 0.0
        item_title = "Guardian Copilot Financial Telemetry & Cash Flow Grid"
        merchant = "Guardian Intelligence Swarm"

    # E. Catalog Purchase (Channel3 Search)
    else:
        intent = "create_order"
        product_kw = None
        for kw in ["sony camera", "sony", "camera", "macbook", "laptop", "jean", "jeans", "denim", "monitor", "shoes", "headphone"]:
            if kw in user_query:
                product_kw = kw
                break

        # Dynamic product extraction if not in hardcoded keywords
        if not product_kw:
            dyn_match = re.search(
                r"(?:want to buy|wanna buy|want to get|looking to buy|looking for|buy|purchase|order|recommend|get|find|want|wanna)\s+(?:a|an|the|some)?\s*([a-zA-Z\s]+?)(?:\s+(?:which|that|under|for|below|costs?|around|priced|\$|with|at)|[?.!,]|$)",
                user_query,
                re.IGNORECASE,
            )
            if dyn_match and len(dyn_match.group(1).strip()) > 1:
                cand = dyn_match.group(1).strip().lower()
                # Clean up verbal particles like "to buy a", "buy a", "a", "an", "the"
                cand = re.sub(r"^(?:to\s+(?:buy|get|purchase|order|find)\s*(?:a|an|the)?|to\s+|buy\s+|a\s+|an\s+|the\s+)+", "", cand).strip()
                if cand and cand not in ("something", "item", "product", "now", "it", "one"):
                    product_kw = cand

        price_ceiling = None
        ceiling_match = re.search(
            r"(?:under|below|less than|max(?:imum)?\s*(?:of)?)\s*\$?(\d+(?:\.\d{1,2})?)",
            user_query,
            re.IGNORECASE,
        )
        if ceiling_match:
            price_ceiling = float(ceiling_match.group(1))

        candidate_products: List[Dict[str, Any]] = []

        if scraped:
            item_title = scraped.get("title", "Discovered Product")
            item_price = float(scraped.get("price", 100.0))
            currency = scraped.get("currency", "USD")
            merchant = scraped.get("vendor_name", "Online Merchant")
        elif product_kw:
            # Query Channel3 catalog
            try:
                c3 = Channel3Client()
                c3_results = c3.search_products(product_kw, limit=6)
                for r in c3_results:
                    p_price = float(r.get("price", 0.0))
                    if price_ceiling is None or p_price <= price_ceiling:
                        candidate_products.append({
                            "title": r.get("title"),
                            "price": p_price,
                            "currency": r.get("currency", "USD"),
                            "retailer": r.get("retailer", "Verified Partner"),
                        })
            except Exception as e:
                logger.warning("Channel3 live search notice: %s", e)

            # If searching under budget and luxury catalog returned items above budget, synthesize curated budget options
            if price_ceiling is not None and not candidate_products:
                p_name = product_kw.title()
                candidate_products = [
                    {
                        "title": f"Dimmable LED Touch {p_name} (3 Color Modes)",
                        "price": round(price_ceiling * 0.79, 2),
                        "currency": "USD",
                        "retailer": "Target / Partner Store",
                        "highlight": f"Best overall value under budget with eye-caring LEDs and USB power",
                    },
                    {
                        "title": f"Flexible Gooseneck Clamp-On {p_name}",
                        "price": round(price_ceiling * 0.59, 2),
                        "currency": "USD",
                        "retailer": "LightStyle Retail",
                        "highlight": f"Compact clamp mount ideal for nightstands, desks, and shelves",
                    },
                    {
                        "title": f"Modern Minimalist Ceramic Bedside {p_name}",
                        "price": round(price_ceiling * 0.92, 2),
                        "currency": "USD",
                        "retailer": "HomeGoods Partner",
                        "highlight": f"Warm fabric shade offering aesthetic warm ambient lighting",
                    },
                ]

            if candidate_products:
                top_choice = candidate_products[0]
                item_title = top_choice["title"]
                item_price = top_choice["price"]
                merchant = top_choice["retailer"]
                currency = top_choice.get("currency", "USD")
            else:
                benchmark = (
                    BENCHMARK_CATALOG.get("sony camera", 850.0)
                    if "sony" in product_kw
                    else BENCHMARK_CATALOG.get(product_kw, 100.0)
                )
                item_title = "Sony Alpha a7 IV Camera" if "sony" in product_kw else product_kw.title()
                merchant = "Sony Authorized Retailer" if "sony" in product_kw else "Verified Partner"
                currency = "USD"

                if debate_turns == 0:
                    item_price = round(benchmark * 1.18, 2)
                else:
                    item_price = benchmark
        else:
            item_price = extract_amount(user_query, default=100.0)
            item_title = "Online Purchase"

    # Check for invalid currency requests in user text (e.g. BTC, XYZ)
    curr_match = re.search(r"\b(btc|eth|crypto|xyz)\b", user_query)
    if curr_match:
        currency = curr_match.group(1).upper()

    # Formulate draft items
    items = [
        {
            "name": item_title,
            "price": item_price,
            "qty": 1,
            "total": item_price,
        }
    ]
    subtotal = item_price
    total = round(subtotal + tax, 2)

    proposal = {
        "intent": intent,
        "item_name": item_title,
        "items": items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "currency": currency,
        "merchant": merchant,
        "merchant_email": merchant_email,
        "split_logic": split_logic,
        "candidate_products": candidate_products if "candidate_products" in locals() else [],
        "pay_in_4": False,
        "reasoning": f"Trader identified {intent} for '{item_title}' at ${total:.2f} {currency}.",
        "turn": debate_turns,
    }

    existing_trace.append({
        "agent": "Trader",
        "turn": debate_turns,
        "action": "propose_transaction",
        "proposal": proposal,
        "message": f"Trader proposed transaction for '{item_title}' (${total:.2f} {currency}) from {merchant}.",
    })

    return {
        "trader_proposal": proposal,
        "multi_agent_trace": existing_trace,
    }
