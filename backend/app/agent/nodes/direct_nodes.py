import logging
import uuid
from typing import Any, Dict
from backend.app.agent.state import AgentState
from backend.app.agent.tools.paypal_client import paypal_client

logger = logging.getLogger("guardian.node.direct")


async def order_inspect_node(state: AgentState) -> Dict[str, Any]:
    """
    Direct Read-Only Order Audit Node.
    Invoked ONLY for ORDER_INSPECT intents.
    Calls real PayPal REST v2 GET /v2/checkout/orders/{order_id}.
    Never emits a capture or debit action card.
    """
    intent_data = state.get("intent_data") or {}
    order_id = intent_data.get("order_id", "8492")

    logger.info("Order inspect node executing for order_id: %s", order_id)
    details = await paypal_client.get_order_details(order_id)

    tools_called = [
        {
            "name": "get_order_details",
            "input_parameters": {"order_id": order_id},
        }
    ]

    if not details.get("found", False):
        final_reply = (
            f"Order #{order_id} does not exist in PayPal Sandbox (RESOURCE_NOT_FOUND). "
            f"Because this order does not exist, no transaction details, dollar amounts, or merchant information "
            f"can be provided, and no capture button is displayed."
        )
        card_data = {
            "orderId": order_id,
            "status": "NOT_FOUND",
            "found": False,
            "error": details.get("error", "Order ID not found in PayPal Sandbox"),
        }
    else:
        status_val = details.get("status", "CREATED")
        amt_val = details.get("amount", 0.0)
        curr_val = details.get("currency", "USD")
        final_reply = (
            f"PayPal Sandbox Order #{order_id} verified. "
            f"Status: **{status_val}**, Amount: ${amt_val:.2f} {curr_val}. "
            f"This is a read-only transaction inspection."
        )
        card_data = {
            "orderId": order_id,
            "status": status_val,
            "found": True,
            "amount": amt_val,
            "currency": curr_val,
            "description": details.get("description", ""),
        }

    action_card = {
        "type": "order_inspection_result",
        "event": "order_inspection_result",
        "orderInspectionData": card_data,
    }

    return {
        "final_response": final_reply,
        "action_status": "idle",
        "pending_action": None,
        "action_card": action_card,
        "order_inspection": details,
        "tools_called": tools_called,
    }


async def invoice_create_node(state: AgentState) -> Dict[str, Any]:
    """
    Direct Invoicing Node.
    Invoked ONLY for INVOICE_CREATE intents (incoming funds).
    Prepares a draft PayPal v2 invoice without running buyer retail checks or subtracting cash balance.
    Emits an INVOICE_APPROVAL card showing Incoming Receivable (+amount).
    """
    intent_data = state.get("intent_data") or {}
    recipient_email = intent_data.get("recipient_email", "client@example.com")
    amount = float(intent_data.get("amount", 450.0))
    currency = intent_data.get("currency", "USD")
    description = intent_data.get("description", "Software architecture")

    logger.info("Invoice create node generating draft for %s: $%.2f %s (%s)", recipient_email, amount, currency, description)

    draft_invoice = await paypal_client.create_draft_invoice(
        recipient_email=recipient_email,
        amount=amount,
        currency=currency,
        description=description,
    )

    action_id = f"act-inv-{uuid.uuid4().hex[:8]}"
    pending_action = {
        "action_id": action_id,
        "action_type": "send_invoice",
        "tool_name": "create_draft_invoice",
        "description": f"Send PayPal Invoice to {recipient_email} for +${amount:.2f} {currency}",
        "amount": amount,
        "currency": currency,
        "recipient": recipient_email,
        "invoice_id": draft_invoice.get("invoice_id"),
        "raw_payload": draft_invoice,
        "requires_approval": True,
        "idempotency_key": draft_invoice.get("idempotency_key", f"inv-{uuid.uuid4().hex[:8]}"),
    }

    action_card = {
        "type": "invoice_approval_required",
        "event": "invoice_approval_required",
        "invoiceApprovalData": {
            "recipientEmail": recipient_email,
            "description": description,
            "amount": amount,
            "currency": currency,
            "invoiceId": draft_invoice.get("invoice_id"),
            "paymentUrl": draft_invoice.get("payment_url"),
        },
    }

    final_reply = (
        f"Draft PayPal Invoice #{draft_invoice.get('invoice_number', 'DRAFT')} prepared for "
        f"**+${amount:.2f} {currency}** (Incoming Receivable) to `{recipient_email}` for '{description}'. "
        f"Human approval is required before dispatching to client."
    )

    tools_called = [
        {
            "name": "create_draft_invoice",
            "input_parameters": {
                "recipient_email": recipient_email,
                "amount": amount,
                "currency": currency,
                "description": description,
            },
        }
    ]

    return {
        "final_response": final_reply,
        "action_status": "awaiting_approval",
        "pending_action": pending_action,
        "action_card": action_card,
        "tools_called": tools_called,
    }

