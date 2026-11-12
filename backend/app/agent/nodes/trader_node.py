import logging
import re
from typing import Any, Dict, List, Optional

from backend.app.agent.state import AgentState
from backend.app.agent.nodes.auditor_node import BENCHMARK_CATALOG
from src.channel3_client import Channel3Client

logger = logging.getLogger("guardian.node.trader")


def extract_amount(query: str, default: Optional[float] = None) -> Optional[float]:
    """Extract currency amounts from queries."""
    dollar_match = re.search(r"\$(\d+(?:\.\d{1,2})?)", query)
    if dollar_match:
        return float(dollar_match.group(1))

    kw_match = re.search(r"(?:under|below|costs?|price|for|around|amount|total)\s+(\d+(?:\.\d{1,2})?)", query)
    if kw_match:
        return float(kw_match.group(1))

    clean_q = re.sub(r"(?:#?act-[\da-f]+|#?ord-[\da-f]+|ref-[\da-f]+)", "", query)
    bare_match = re.search(r"\b(\d+(?:\.\d{1,2})?)\b", clean_q)
    if bare_match:
        return float(bare_match.group(1))

    return default


async def trader_node(state: AgentState) -> Dict[str, Any]:
    """
    Agent 1: Trader / Proposal Agent.
    - Formulates draft transaction proposals for PURCHASE_CHECKOUT.
    - Ingests structured intent metadata (item, quantity, unit price, stated total, current balance).
    - If in a debate revision turn with Auditor feedback, recalculates math or adjusts overpricing.
    """
    messages = state.get("messages", [])
    user_query = ""
    if messages:
        last = messages[-1]
        user_query = (last.content if hasattr(last, "content") else str(last)).lower()

    debate_turns = state.get("debate_turns", 0)
    audit_feedback = state.get("audit_feedback")
    existing_trace = list(state.get("multi_agent_trace") or [])
    intent_data = state.get("intent_data") or {}

    logger.info("Trader node executing turn %d with query: %s", debate_turns, user_query[:50])

    # -------------------------------------------------------------------------
    # Debate Revision Turn (Auditor requested corrections)
    # -------------------------------------------------------------------------
    if debate_turns > 0 and audit_feedback:
        flags = audit_feedback.get("flags", [])
        prev_proposal = state.get("trader_proposal") or {}
        revised_items = list(prev_proposal.get("items", []))
        revised_tax = float(prev_proposal.get("tax", 0.0))
        currency = prev_proposal.get("currency", "USD")

        if "MATH_ERROR" in flags:
            logger.info("Trader correcting arithmetic discrepancies flagged by Auditor.")
            subtotal = sum(float(it.get("price", 0)) * int(it.get("qty", 1)) for it in revised_items)
            total = round(subtotal + revised_tax, 2)
        elif "OVERPRICING_FLAG" in flags:
            logger.info("Trader negotiating price down to verified benchmark baseline.")
            baseline = audit_feedback.get("price_baseline") or 850.0
            if revised_items:
                revised_items[0]["price"] = baseline
            subtotal = sum(float(it.get("price", 0)) * int(it.get("qty", 1)) for it in revised_items)
            total = round(subtotal + revised_tax, 2)
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

    # -------------------------------------------------------------------------
    # Fresh Turn: Proposal Formulation from Intent Data
    # -------------------------------------------------------------------------
    item_title = intent_data.get("item_name")
    qty = intent_data.get("quantity", 1)
    unit_price = intent_data.get("unit_price")
    stated_total = intent_data.get("stated_total")
    current_balance = intent_data.get("current_balance") or state.get("current_balance")
    merchant = intent_data.get("merchant") or "Verified Merchant"
    currency = intent_data.get("currency", "USD")
    tax = 0.0

    # Strict extraction: if no explicit item or dollar amount exists, do NOT invent one
    extracted = extract_amount(user_query)
    if not item_title or (unit_price is None and stated_total is None and extracted is None):
        logger.info("Trader node: missing explicit item or price in prompt. Setting clarification_needed.")
        return {
            "action_status": "clarification_needed",
            "final_response": "Could you please specify what item you would like to purchase and its price or merchant? Guardian requires explicit item and price details to safeguard your transaction.",
            "pending_action": None,
            "action_card": None,
        }

    intent = "create_order"
    split_logic = None

    if "split" in user_query or "divide" in user_query or "share bill" in user_query:
        intent = "split_group_payment"
        total = stated_total if stated_total is not None else (extracted if extracted is not None else 150.0)
        item_title = item_title or "Group Split Bill"
        participants = [
            {"name": "Alex", "email": "alex@example.com"},
            {"name": "Jordan", "email": "jordan@example.com"},
            {"name": "Taylor", "email": "taylor@example.com"},
        ]
        split_logic = {
            "participant_count": len(participants),
            "participants": participants,
            "share_per_person": round(total / len(participants), 2),
        }
        subtotal = total
        items = [{"name": item_title, "price": total, "qty": 1, "total": total}]
    elif "escrow" in user_query or "milestone" in user_query:
        intent = "authorize_escrow"
        total = stated_total if stated_total is not None else (extracted if extracted is not None else 400.0)
        item_title = item_title or "Milestone Escrow"
        subtotal = total
        items = [{"name": item_title, "price": total, "qty": 1, "total": total}]
    elif unit_price is not None:
        actual_subtotal = round(unit_price * qty, 2)
        total = stated_total if stated_total is not None else actual_subtotal
        items = [
            {
                "name": item_title,
                "price": unit_price,
                "qty": qty,
                "total": actual_subtotal,
            }
        ]
        subtotal = actual_subtotal
    elif stated_total is not None:
        total = stated_total
        subtotal = stated_total
        items = [
            {
                "name": item_title,
                "price": round(stated_total / qty, 2),
                "qty": qty,
                "total": stated_total,
            }
        ]
    elif extracted is not None:
        total = extracted
        subtotal = extracted
        items = [
            {
                "name": item_title,
                "price": round(extracted / qty, 2),
                "qty": qty,
                "total": extracted,
            }
        ]
    else:
        matched_benchmark = next((k for k in BENCHMARK_CATALOG if k in user_query), None)
        if matched_benchmark:
            base_price = BENCHMARK_CATALOG[matched_benchmark]
            items = [
                {
                    "name": item_title,
                    "price": base_price,
                    "qty": qty,
                    "total": round(base_price * qty, 2),
                }
            ]
            subtotal = round(base_price * qty, 2)
            total = subtotal
        else:
            return {
                "action_status": "clarification_needed",
                "final_response": "Could you please specify the price or budget for this purchase? Guardian requires explicit pricing to perform safety buffer audits.",
                "pending_action": None,
                "action_card": None,
            }

    proposal = {
        "intent": intent,
        "item_name": item_title,
        "items": items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "currency": currency,
        "merchant": merchant,
        "current_balance": current_balance,
        "split_logic": split_logic,
        "reasoning": f"Trader formulated purchase proposal for {qty}x '{item_title}' at ${total:.2f} {currency}.",
        "turn": debate_turns,
    }

    existing_trace.append({
        "agent": "Trader",
        "turn": debate_turns,
        "action": "propose_transaction",
        "proposal": proposal,
        "message": f"Trader proposed transaction for {qty}x '{item_title}' (${total:.2f} {currency}) from {merchant}.",
    })

    return {
        "trader_proposal": proposal,
        "multi_agent_trace": existing_trace,
    }
