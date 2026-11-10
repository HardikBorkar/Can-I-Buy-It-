import logging
import uuid
from typing import Any, Dict, List, Optional

from backend.app.agent.state import AgentState
from backend.app.core.security import generate_idempotency_key
from backend.app.core.invariants import evaluate_spend_invariant

logger = logging.getLogger("guardian.node.arbiter")


async def arbiter_node(state: AgentState) -> Dict[str, Any]:
    """
    Agent 3: Guardian Arbiter (`arbiter_node`).
    - Receives outputs from both Trader and Auditor.
    - If Auditor flags an issue, increments `debate_turns` (max 2) and routes back to `trader_node`
      with feedback to renegotiate or revise the payload.
    - If consensus is reached, compiles the unified verdict, prepares the PayPal REST v2 sandbox payload,
      and yields execution to `hitl_gate`.
    - If critical math or safety invariants fail after debate exhaustion, firmly rejects and bypasses HITL.
    """
    proposal = state.get("trader_proposal") or {}
    feedback = state.get("audit_feedback") or {}
    debate_turns = state.get("debate_turns", 0)
    existing_trace = list(state.get("multi_agent_trace") or [])
    flags = feedback.get("flags", [])

    logger.info("Arbiter node evaluating turn %d. Auditor passed=%s, flags=%s", debate_turns, feedback.get("passed"), flags)

    # =========================================================================
    # Case 1: Auditor Flagged Issues & Debate Turns Available (< 2)
    # =========================================================================
    # If there are flags and we haven't hit max 2 debate rounds, renegotiate
    if not feedback.get("passed", False) and debate_turns < 2:
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

    # =========================================================================
    # Case 2: Auditor Invariants Failed & Debate Exhausted (or Fatal Invariant)
    # =========================================================================
    if not feedback.get("passed", False):
        logger.warning("Arbiter: Multi-agent consensus failed on invariants: %s", flags)
        rejection_reason = "Multi-agent consensus failed: " + ", ".join(flags)

        existing_trace.append({
            "agent": "Arbiter",
            "turn": debate_turns,
            "action": "reject_transaction",
            "message": f"Arbiter issued final REJECTION verdict after {debate_turns} debate turns. Flags: {flags}.",
        })

        if "MATH_ERROR" in flags:
            response_text = (
                f"🛑 **Audit Invariant Failure (MATH_ERROR):**\n\n"
                f"The transaction proposal contained arithmetic subtotal discrepancies. "
                f"Deterministic audit check failed: `total != sum(item.price * item.qty) + tax`. "
                f"Action blocked and will not proceed to Human-In-The-Loop gate."
            )
        elif "REJECTED_SAFETY_FLOOR" in flags:
            response_text = (
                f"🛑 **Safety Floor Violation (REJECTED_SAFETY_FLOOR):**\n\n"
                f"The proposed transaction of **${proposal.get('total', 0.0):.2f} {proposal.get('currency', 'USD')}** "
                f"breaches your sacred **$500.00 USD minimum liquidity buffer floor**. "
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

    # =========================================================================
    # Case 3: Consensus Reached! (Auditor Passed) -> Prepare PayPal REST v2
    # =========================================================================
    intent = proposal.get("intent", "create_order")
    total_amount = float(proposal.get("total", 100.0))
    currency = proposal.get("currency", "USD")
    item_name = proposal.get("item_name", "Authorized Transaction")
    merchant = proposal.get("merchant", "Verified Partner")
    user_id = state.get("user_id", "default_user")

    # Financial post-balance calculation
    inv = evaluate_spend_invariant(total_amount if total_amount > 0 else 1.0)
    action_id = f"act-{uuid.uuid5(uuid.NAMESPACE_DNS, f'{user_id}:{item_name}:{total_amount:.2f}').hex[:8]}"

    # Prepare raw payload according to action type
    if intent == "authorize_escrow":
        raw_payload = {
            "amount": total_amount,
            "currency": currency,
            "payee_email": proposal.get("merchant_email", "contractor@venturecap.io"),
            "milestone_id": "milestone-1",
            "description": f"Milestone Escrow: {item_name}",
        }
        tool_name = "paypal_tools.authorize_escrow"
        action_type = "authorize_escrow"
        desc = f"Authorize Milestone Escrow of ${total_amount:.2f} {currency} to {raw_payload['payee_email']}"

    elif intent == "split_group_payment":
        participants = (proposal.get("split_logic") or {}).get("participants", [
            {"name": "Alex", "email": "alex@example.com"},
            {"name": "Jordan", "email": "jordan@example.com"},
            {"name": "Taylor", "email": "taylor@example.com"},
        ])
        raw_payload = {
            "total_amount": total_amount,
            "participants": participants,
            "currency": currency,
        }
        tool_name = "paypal_tools.split_group_payment"
        action_type = "split_group_payment"
        desc = f"Route group split payment of ${total_amount:.2f} {currency} across {len(participants)} participants"

    elif intent == "send_invoice":
        raw_payload = {
            "recipient_email": proposal.get("merchant_email", "client@venturecap.io"),
            "items": [{"name": item_name, "amount": total_amount, "quantity": 1}],
            "currency": currency,
            "note": "Billed via Guardian Copilot Autonomous Invoicing Agent",
        }
        tool_name = "paypal_client.create_and_send_invoice"
        action_type = "send_invoice"
        desc = f"Dispatch PayPal REST v2 Invoice to {raw_payload['recipient_email']} for ${total_amount:.2f} {currency}"

    elif intent == "bento_analytics":
        raw_payload = {
            "type": "bento_analytics",
            "description": "Guardian Copilot Financial Telemetry & Cash Flow Grid",
        }
        tool_name = "guardian_analytics.render_bento"
        action_type = "bento_analytics"
        desc = "Render interactive financial telemetry and cash flow analytics grid"

    else:  # create_order
        raw_payload = {
            "amount": total_amount,
            "currency": currency,
            "description": f"Purchase: {item_name}",
            "reference_id": f"ref-{action_id}",
            "pay_in_4": proposal.get("pay_in_4", False),
            "item_name": item_name,
        }
        tool_name = "paypal_client.create_order"
        action_type = "create_order"
        desc = f"Authorize PayPal Sandbox Order for '{item_name}' (${total_amount:.2f} {currency})"

    idempotency_key = generate_idempotency_key(raw_payload, prefix="swarm")

    pending_action = {
        "action_id": action_id,
        "action_type": action_type,
        "tool_name": tool_name,
        "description": desc,
        "amount": total_amount,
        "currency": currency,
        "recipient": merchant,
        "risk_score": inv.get("risk_score", 98),
        "safety_buffer_intact": inv.get("buffer_intact", True),
        "post_balance_floor": inv.get("lowest_dip_full", 590.0),
        "requires_approval": True,
        "idempotency_key": idempotency_key,
        "raw_payload": raw_payload,
    }

    # Executive Multi-Agent Consensus Verdict message
    candidate_products = proposal.get("candidate_products") or []
    catalog_section = ""
    if candidate_products:
        catalog_section = "### 💡 Curated Catalog Recommendations & Best Options\n\n"
        for idx, prod in enumerate(candidate_products, start=1):
            is_top = (idx == 1)
            badge = "🌟 **Top Recommendation:** " if is_top else ""
            highlight_str = f"\n  - **Highlight:** {prod['highlight']}" if prod.get("highlight") else ""
            catalog_section += (
                f"{idx}. {badge}**{prod['title']}** — **${prod['price']:.2f} {prod.get('currency', 'USD')}**\n"
                f"  - **Merchant:** {prod.get('retailer', 'Verified Partner')}{highlight_str}\n\n"
            )
        catalog_section += "---\n\n"

    if intent == "bento_analytics":
        verdict_text = (
            "### 📊 Financial Telemetry & Invariant Analysis\n\n"
            "Here is the interactive financial analytics artifact showing cash flow projections, spend velocity, and the recent transaction ledger:\n\n"
            "- **90-Day Cash Flow Trajectory:** Interactive predictive liquidity curve confirming your **$1,350.00 USD** discretionary balance while maintaining the inviolable **$500.00 USD reserve buffer** (projected lowest dip: **$590.00 USD**).\n"
            "- **Weekly Outflow Velocity:** Distribution of PayPal Sandbox debits across authorized merchants.\n"
            "- **Transaction Ledger & KPI Metrics:** Summary of categorized expenses, liquidity reserves, and merchant settlement status.\n\n"
            "Use the artifact header toggles to switch between chart views and the itemized data table, or export the full ledger as CSV."
        )
    else:
        verdict_text = (
            f"{catalog_section}"
            f"### 🤝 Multi-Agent Consensus Ratified\n\n"
            f"- **Trader Proposal:** Selected **{item_name}** at **${total_amount:.2f} {currency}** via **{merchant}**.\n"
            f"- **Risk & Audit Clearance:** Subtotals verified, merchant trust verified ({feedback.get('merchant_trust_score', 95)}/100), and $500 safety floor intact (**${inv.get('lowest_dip_full', 590.0):.2f}** post-purchase reserve).\n"
            f"- **Arbiter Verdict:** Consensus achieved in **{debate_turns + 1} turn(s)**. PayPal Sandbox payload ready.\n\n"
            f"Please choose your authorization method below to finalize the transaction."
        )

    existing_trace.append({
        "agent": "Arbiter",
        "turn": debate_turns,
        "action": "ratify_consensus",
        "consensus_reached": True,
        "pending_action": pending_action,
        "message": f"Arbiter ratified multi-agent consensus for {action_type}. Yielding to HITL gate.",
    })

    return {
        "consensus_reached": True,
        "pending_action": pending_action,
        "action_status": "awaiting_approval",
        "final_response": verdict_text,
        "multi_agent_trace": existing_trace,
    }


def arbiter_decision(state: AgentState) -> str:
    """
    Conditional edge routing function from arbiter_node:
    - If consensus not reached and debate_turns < 2: route back to 'trader_node' (cyclic debate)
    - If MATH_ERROR, REJECTED_SAFETY_FLOOR, rejected, or no pending_action: route to '__end__'
    - If consensus reached with pending_action: route to 'hitl_gate'
    """
    consensus_reached = state.get("consensus_reached", False)
    debate_turns = state.get("debate_turns", 0)

    # 1. Cyclic debate check
    if not consensus_reached and debate_turns < 2:
        return "trader_node"

    # 2. Check for invariant errors that terminate execution
    feedback = state.get("audit_feedback") or {}
    flags = feedback.get("flags", [])
    if "MATH_ERROR" in flags or "REJECTED_SAFETY_FLOOR" in flags:
        return "__end__"

    if state.get("action_status") == "rejected" or not state.get("pending_action"):
        return "__end__"

    # 3. Validated action yields to HITL gate
    return "hitl_gate"

