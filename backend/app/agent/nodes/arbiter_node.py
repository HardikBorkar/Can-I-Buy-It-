import logging
import uuid
from typing import Any, Dict, List, Optional

from backend.app.agent.state import AgentState
from backend.app.core.security import generate_idempotency_key

logger = logging.getLogger("guardian.node.arbiter")


async def arbiter_node(state: AgentState) -> Dict[str, Any]:
    """
    Agent 3: Guardian Arbiter (`arbiter_node`).
    - Evaluates Trader proposals and Auditor feedback for PURCHASE_CHECKOUT.
    - If non-fatal overpricing occurs and debate turns < 2, returns to trader for renegotiation.
    - If critical math or safety invariants fail (e.g. MATH_ERROR or REJECTED_SAFETY_FLOOR),
      firmly rejects and bypasses HITL.
    - If consensus is reached, prepares the PayPal REST v2 action and yields to hitl_gate.
    """
    proposal = state.get("trader_proposal") or {}
    feedback = state.get("audit_feedback") or {}
    debate_turns = state.get("debate_turns", 0)
    existing_trace = list(state.get("multi_agent_trace") or [])
    flags = feedback.get("flags", [])

    logger.info("Arbiter node evaluating turn %d. Auditor passed=%s, flags=%s", debate_turns, feedback.get("passed"), flags)

    # -------------------------------------------------------------------------
    # Case 1: Auditor Flagged Issues - Check if Recoverable or Fatal
    # -------------------------------------------------------------------------
    if not feedback.get("passed", False):
        # Fatal violations: REJECTED_SAFETY_FLOOR or debate turns exhausted or multiple fatal invariants
        is_fatal = (
            "REJECTED_SAFETY_FLOOR" in flags
            or debate_turns >= 2
            or ("MATH_ERROR" in flags and "REJECTED_SAFETY_FLOOR" in flags)
        )

        if not is_fatal and debate_turns < 2:
            logger.info("Arbiter ordering debate round %d -> returning to trader_node", debate_turns + 1)
            existing_trace.append({
                "agent": "Arbiter",
                "turn": debate_turns,
                "action": "request_revision",
                "message": f"Arbiter rejected proposal due to Auditor flags: {', '.join(flags)}. Returning to Trader for debate turn {debate_turns + 1}.",
            })
            return {
                "debate_turns": debate_turns + 1,
                "consensus_reached": False,
                "multi_agent_trace": existing_trace,
            }

        # Final Rejection
        logger.warning("Arbiter: Multi-agent consensus failed on invariants: %s", flags)
        rejection_reason = "Multi-agent consensus failed: " + ", ".join(flags)

        existing_trace.append({
            "agent": "Arbiter",
            "turn": debate_turns,
            "action": "reject_transaction",
            "message": f"Arbiter issued final REJECTION verdict after {debate_turns} debate turns. Flags: {flags}.",
        })

        if "MATH_ERROR" in flags and "REJECTED_SAFETY_FLOOR" in flags:
            response_text = (
                f"🛑 **Audit Invariant & Safety Floor Rejection (MATH_ERROR & REJECTED_SAFETY_FLOOR):**\n\n"
                f"1. Arithmetic subtotal error detected: item calculations do not match stated total.\n"
                f"2. Sacred $500.00 cash-flow safety floor violated: purchase reduces balance below reserve.\n"
                f"PayPal execution blocked and will not proceed to Human-In-The-Loop gate."
            )
        elif "MATH_ERROR" in flags:
            response_text = (
                f"🛑 **Audit Invariant Failure (MATH_ERROR):**\n\n"
                f"The transaction proposal contained arithmetic subtotal discrepancies. "
                f"Deterministic audit check failed: `total != sum(item.price * item.qty) + tax`. "
                f"Action blocked and will not proceed to Human-In-The-Loop gate."
            )
        elif "REJECTED_SAFETY_FLOOR" in flags:
            response_text = (
                f"🛑 **Safety Floor Violation (REJECTED_SAFETY_FLOOR):**\n\n"
                f"The proposed transaction breaches your sacred **$500.00 USD minimum liquidity buffer floor**. "
                f"The risk auditor has blocked this transaction."
            )
        else:
            response_text = f"🛑 **Multi-Agent Consensus Rejected:** {rejection_reason}."

        return {
            "consensus_reached": True,
            "pending_action": None,
            "action_status": "rejected",
            "final_response": response_text,
            "multi_agent_trace": existing_trace,
        }

    # -------------------------------------------------------------------------
    # Case 2: Consensus Reached! (All Invariants Passed)
    # -------------------------------------------------------------------------
    total_amount = float(proposal.get("total", 100.0))
    currency = proposal.get("currency", "USD")
    item_name = proposal.get("item_name", "Authorized Transaction")
    merchant = proposal.get("merchant", "Verified Vendor")
    user_id = state.get("user_id", "default_user")

    balance_val = (
        proposal.get("current_balance")
        or (state.get("intent_data") or {}).get("current_balance")
        or state.get("current_balance")
        or 900.0
    )
    post_balance = float(balance_val) - total_amount

    action_id = f"act-ord-{uuid.uuid4().hex[:8]}"

    raw_payload = {
        "amount": total_amount,
        "currency": currency,
        "description": f"Purchase: {item_name}",
        "reference_id": f"ref-{action_id}",
        "pay_in_4": proposal.get("pay_in_4", False),
        "item_name": item_name,
        "merchant": merchant,
    }

    intent = proposal.get("intent", "create_order")
    if intent == "split_group_payment":
        action_type = "split_group_payment"
        tool_name = "split_group_payment"
    elif intent == "authorize_escrow":
        action_type = "authorize_escrow"
        tool_name = "authorize_escrow"
    else:
        action_type = "create_order"
        tool_name = "create_order"

    pending_action = {
        "action_id": action_id,
        "action_type": action_type,
        "tool_name": tool_name,
        "description": f"Purchase {item_name} for ${total_amount:.2f} {currency} from {merchant}",
        "amount": total_amount,
        "currency": currency,
        "recipient": merchant,
        "merchant": merchant,
        "item": item_name,
        "post_purchase_reserve": post_balance,
        "post_balance_floor": post_balance,
        "requires_approval": True,
        "idempotency_key": generate_idempotency_key(proposal, prefix="ord"),
        "raw_payload": raw_payload,
    }

    action_card = {
        "type": "checkout_approval_required",
        "event": "checkout_approval_required",
        "checkoutApprovalData": {
            "merchant": merchant,
            "item": item_name,
            "amount": total_amount,
            "currency": currency,
            "postPurchaseReserve": post_balance,
            "orderId": action_id,
        },
    }

    response_text = (
        f"✅ **Multi-Agent Consensus Ratified:**\n\n"
        f"Proposal for **{item_name}** at **${total_amount:.2f} {currency}** from {merchant} passed all risk audits.\n"
        f"* **Post-Purchase Reserve:** ${post_balance:.2f} {currency} (Preserves $500.00 safety floor)\n"
        f"* **Human-in-the-Loop:** Explicit user authorization required to dispatch PayPal Sandbox payment."
    )

    existing_trace.append({
        "agent": "Arbiter",
        "turn": debate_turns,
        "action": "ratify_consensus",
        "message": f"Arbiter ratified proposal for '{item_name}' (${total_amount:.2f} {currency}). Pausing at Human-In-The-Loop gate.",
    })

    tools_called = [
        {
            "name": tool_name,
            "input_parameters": {
                "amount": total_amount,
                "currency": currency,
                "description": f"Purchase: {item_name}",
            },
        }
    ]

    return {
        "consensus_reached": True,
        "pending_action": pending_action,
        "action_card": action_card,
        "action_status": "awaiting_approval",
        "final_response": response_text,
        "multi_agent_trace": existing_trace,
        "tools_called": tools_called,
    }


def arbiter_decision(state: AgentState) -> str:
    """
    Conditional edge function routing from Arbiter:
    - If rejected -> '__end__'
    - If debate turns needed (< 2 and not fatal) -> 'trader_node'
    - If consensus reached -> 'hitl_gate'
    """
    status = state.get("action_status", "idle")
    if status == "rejected":
        return "__end__"

    consensus = state.get("consensus_reached", False)
    if not consensus:
        return "trader_node"

    return "hitl_gate"
