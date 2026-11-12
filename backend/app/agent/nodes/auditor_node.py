import logging
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from backend.app.agent.state import AgentState
from backend.app.memory.vector_store import vector_store

logger = logging.getLogger("guardian.node.auditor")

VALID_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD", "JPY"}

# Standard benchmark price directory for baseline verification
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
    "api key": 120.0,
    "gpu node": 300.0,
    "gpu nodes": 300.0,
}


async def auditor_node(state: AgentState) -> Dict[str, Any]:
    """
    Agent 2: Risk & Audit Agent (`auditor_node`).
    Adversarial financial critic strictly enforcing:
    - Deterministic subtotal calculation in pure Python Decimal: total == sum(price * qty) + tax.
    - $500.00 sacred cash-flow safety floor on all outgoing debits (PURCHASE_CHECKOUT).
    - Currency format and baseline overpricing validation.
    """
    proposal = state.get("trader_proposal") or {}
    intent_data = state.get("intent_data") or {}
    debate_turns = state.get("debate_turns", 0)
    existing_trace = list(state.get("multi_agent_trace") or [])
    flags: List[str] = []

    item_name = proposal.get("item_name") or intent_data.get("item_name") or "Item"
    total = proposal.get("total", 0.0)
    tax = proposal.get("tax", 0.0)
    currency = proposal.get("currency", "USD")
    merchant = proposal.get("merchant", "Merchant")
    items = proposal.get("items", [])

    logger.info("Auditor node evaluating turn %d: %s ($%s %s)", debate_turns, item_name, total, currency)

    # -------------------------------------------------------------------------
    # 1. Deterministic Math Invariant Check (Pure Python Decimal)
    # -------------------------------------------------------------------------
    subtotal_decimal = Decimal("0.0")
    try:
        for it in items:
            p = Decimal(str(it.get("price", 0.0)))
            q = Decimal(str(it.get("qty", 1)))
            subtotal_decimal += p * q
        tax_decimal = Decimal(str(tax))
        expected_total = subtotal_decimal + tax_decimal
        total_decimal = Decimal(str(total))

        if abs(total_decimal - expected_total) > Decimal("0.001"):
            logger.warning(
                "Auditor detected MATH_ERROR: expected %s (subtotal %s + tax %s), but proposed was %s",
                expected_total, subtotal_decimal, tax_decimal, total_decimal
            )
            flags.append("MATH_ERROR")
    except (InvalidOperation, TypeError, ValueError) as exc:
        logger.warning("Auditor arithmetic parsing exception: %s", exc)
        flags.append("MATH_ERROR")

    # -------------------------------------------------------------------------
    # 2. Financial Safety Buffer Floor Check ($500.00 Sacred Floor)
    # Evaluated ONLY on outgoing debits (PURCHASE_CHECKOUT)
    # -------------------------------------------------------------------------
    intent = proposal.get("intent") or state.get("intent", "PURCHASE_CHECKOUT")
    if intent in ("PURCHASE_CHECKOUT", "create_order", "split_group_payment", "authorize_escrow"):
        # Resolve current balance from proposal, intent data, or state
        balance_val = (
            proposal.get("current_balance")
            or intent_data.get("current_balance")
            or state.get("current_balance")
            or 900.0
        )
        current_balance = Decimal(str(balance_val))
        safety_floor = Decimal("500.00")

        # Effective debit: use computed item cost when available
        effective_spend = subtotal_decimal if subtotal_decimal > Decimal("0.0") else Decimal(str(total))
        if proposal.get("intent") == "split_group_payment" and proposal.get("split_logic"):
            effective_spend = Decimal(str(proposal["split_logic"].get("share_per_person", total)))

        post_balance = current_balance - effective_spend
        if post_balance < safety_floor:
            logger.warning(
                "Auditor detected REJECTED_SAFETY_FLOOR: current balance $%s - spend $%s leaves $%s (breaches $%s sacred floor)",
                current_balance, effective_spend, post_balance, safety_floor
            )
            flags.append("REJECTED_SAFETY_FLOOR")

    # -------------------------------------------------------------------------
    # 3. Currency Validation
    # -------------------------------------------------------------------------
    if currency not in VALID_CURRENCIES:
        logger.warning("Auditor detected INVALID_CURRENCY: %s", currency)
        flags.append("INVALID_CURRENCY")

    # -------------------------------------------------------------------------
    # 4. Overpricing Flag (>15% above benchmark)
    # -------------------------------------------------------------------------
    matched_key = next((k for k in BENCHMARK_CATALOG if k in item_name.lower()), None)
    benchmark_price = BENCHMARK_CATALOG[matched_key] if matched_key else float(total)
    if benchmark_price > 0 and float(total) > (1.15 * benchmark_price) and "MATH_ERROR" not in flags:
        logger.warning("Auditor detected OVERPRICING_FLAG: $%.2f > 15%% baseline $%.2f", float(total), benchmark_price)
        flags.append("OVERPRICING_FLAG")

    # Compile feedback
    passed = len(flags) == 0
    feedback = {
        "passed": passed,
        "flags": flags,
        "math_verified": "MATH_ERROR" not in flags,
        "safety_floor_ok": "REJECTED_SAFETY_FLOOR" not in flags,
        "price_baseline": benchmark_price,
        "turn": debate_turns,
        "notes": (
            "All adversarial audit invariants PASSED."
            if passed
            else f"Audit FAILED on invariants: {', '.join(flags)}."
        ),
    }

    existing_trace.append({
        "agent": "Auditor",
        "turn": debate_turns,
        "action": "adversarial_audit",
        "feedback": feedback,
        "message": (
            f"Auditor completed risk verification. Invariants {'Passed ✅' if passed else 'Failed ❌: ' + ', '.join(flags)}. "
            f"Math verified: {feedback['math_verified']}. Safety floor intact: {feedback['safety_floor_ok']}."
        ),
    })

    return {
        "audit_feedback": feedback,
        "multi_agent_trace": existing_trace,
    }
