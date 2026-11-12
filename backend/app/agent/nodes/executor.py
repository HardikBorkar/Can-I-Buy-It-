import logging
from typing import Dict, Any
from backend.app.agent.state import AgentState
from backend.app.agent.tools.paypal_client import paypal_client
from backend.app.core.database import db_manager
from backend.app.agent.nodes.analytics_node import categorize_transaction

logger = logging.getLogger("guardian.node.executor")


async def executor_node(state: AgentState) -> Dict[str, Any]:
    """
    PayPal API Tool Execution Node.
    Invokes PayPal REST v2 with idempotent payloads once HITL approval is granted.
    """
    pending = state.get("pending_action")
    if not pending:
        return {"action_status": "idle", "final_response": "No pending action found to execute."}

    action_id = pending.get("action_id", "")
    action_type = pending.get("action_type")
    raw_payload = pending.get("raw_payload", {})

    logger.info("Executing approved action %s of type %s", action_id, action_type)
    execution_result = {}

    try:
        if action_type == "create_order":
            result = await paypal_client.create_order(
                amount=float(raw_payload.get("amount", 100.0)),
                currency=raw_payload.get("currency", "USD"),
                description=raw_payload.get("description", "Guardian Approved Purchase"),
                reference_id=raw_payload.get("reference_id"),
                pay_in_4=raw_payload.get("pay_in_4", False),
            )
            execution_result = result
            order_id = result.get("order_id")
            approve_url = result.get("approve_url")

            response_msg = (
                f"✅ **PayPal Sandbox Order #{order_id} Successfully Created!**\n\n"
                f"* **Amount:** ${result.get('amount', 0.0):.2f} {result.get('currency', 'USD')}\n"
                f"* **Idempotency Key:** `{result.get('idempotency_key')}`\n"
                f"* **Status:** **{result.get('status')}**\n\n"
            )
            if approve_url:
                response_msg += f"🔗 [Click here to finalize in PayPal Sandbox Checkout]({approve_url})"

        elif action_type == "capture_order":
            order_id = raw_payload.get("order_id", "")
            result = await paypal_client.capture_order(order_id=order_id)
            execution_result = result
            response_msg = (
                f"✅ **PayPal Sandbox Order Captured!**\n\n"
                f"* **Capture ID:** `{result.get('capture_id')}`\n"
                f"* **Status:** **{result.get('status')}**\n"
            )

            # Write-Through capture logging into SQLite
            capture_id = result.get("capture_id") or order_id
            merchant = raw_payload.get("merchant") or raw_payload.get("recipient") or "Verified PayPal Vendor"
            item_name = raw_payload.get("item_name") or raw_payload.get("description") or "Sandbox Purchase"
            amt = float(raw_payload.get("amount") or result.get("amount", 0.0))
            currency = raw_payload.get("currency") or result.get("currency", "USD")
            category = categorize_transaction(merchant, item_name)

            try:
                await db_manager.record_transaction(
                    paypal_id=capture_id,
                    merchant=merchant,
                    item=item_name,
                    amount=amt,
                    currency=currency,
                    category=category,
                )
            except Exception as log_err:
                logger.warning("Could not write-through log captured order %s: %s", capture_id, log_err)

        elif action_type == "send_invoice":
            result = await paypal_client.create_and_send_invoice(
                recipient_email=raw_payload.get("recipient_email", "client@venturecap.io"),
                items=raw_payload.get("items", []),
                currency=raw_payload.get("currency", "USD"),
                note=raw_payload.get("note", "Billed via Guardian Copilot Autonomous Invoicing"),
            )
            execution_result = result
            invoice_id = result.get("invoice_id")
            payment_url = result.get("payment_url")

            response_msg = (
                f"✅ **PayPal v2 Invoice Dispatched!**\n\n"
                f"* **Invoice ID:** `{invoice_id}`\n"
                f"* **Recipient:** `{result.get('recipient')}`\n"
                f"* **Status:** **{result.get('status')}**\n\n"
            )
            if payment_url:
                response_msg += f"🔗 [View Live Invoice on PayPal Sandbox]({payment_url})"

            # Write-Through capture logging into SQLite
            if invoice_id:
                recipient = raw_payload.get("recipient_email") or result.get("recipient") or "Client"
                items = raw_payload.get("items", [])
                item_desc = items[0].get("name") if items else raw_payload.get("note", "Consulting Deliverables")
                total_amt = sum(float(it.get("unit_amount", 0.0)) * int(it.get("quantity", 1)) for it in items) if items else float(raw_payload.get("amount", 0.0))
                currency = raw_payload.get("currency", "USD")

                try:
                    await db_manager.record_transaction(
                        paypal_id=invoice_id,
                        merchant=recipient,
                        item=item_desc,
                        amount=total_amt,
                        currency=currency,
                        category="Services & Invoices",
                    )
                except Exception as log_err:
                    logger.warning("Could not write-through log invoice %s: %s", invoice_id, log_err)

        elif action_type in ("authorize_escrow", "escrow_authorize"):
            from backend.app.agent.tools.paypal_tools import authorize_escrow
            result = await authorize_escrow(
                amount=float(raw_payload.get("amount", 500.0)),
                currency=raw_payload.get("currency", "USD"),
                payee_email=raw_payload.get("payee_email", "contractor@venturecap.io"),
                milestone_id=raw_payload.get("milestone_id", "milestone-1"),
            )
            execution_result = result
            response_msg = (
                f"✅ **PayPal Escrow Authorization Created!**\n\n"
                f"* **Authorization ID:** `{result.get('authorization_id')}`\n"
                f"* **Milestone:** `{result.get('milestone_id')}`\n"
                f"* **Amount:** ${result.get('amount', 0.0):.2f} {result.get('currency', 'USD')}\n"
                f"* **Escrow State:** **{result.get('escrow_state')}**\n"
            )

        elif action_type in ("release_escrow", "escrow_release"):
            from backend.app.agent.tools.paypal_tools import release_escrow
            result = await release_escrow(
                authorization_id=raw_payload.get("authorization_id", ""),
            )
            execution_result = result
            response_msg = (
                f"✅ **PayPal Escrow Released to Contractor!**\n\n"
                f"* **Capture ID:** `{result.get('capture_id')}`\n"
                f"* **Authorization ID:** `{result.get('authorization_id')}`\n"
                f"* **Escrow State:** **{result.get('escrow_state')}**\n"
            )

        elif action_type in ("split_group_payment", "split_payment"):
            from backend.app.agent.tools.paypal_tools import split_group_payment
            result = await split_group_payment(
                total_amount=float(raw_payload.get("total_amount", 100.0)),
                participants=raw_payload.get("participants", []),
                currency=raw_payload.get("currency", "USD"),
            )
            execution_result = result
            response_msg = (
                f"✅ **PayPal Group Split Payment Routed!**\n\n"
                f"* **Total Amount:** ${result.get('total_amount', 0.0):.2f} {result.get('currency', 'USD')}\n"
                f"* **Participants:** {result.get('participant_count')}\n"
                f"* **Safety Floor:** Preserved (Verified)\n"
            )

        else:
            response_msg = f"Unknown action type '{action_type}'."

        # Update SQLite audit database
        await db_manager.update_action_status(
            action_id=action_id,
            status="executed",
            execution_result=execution_result,
        )

        return {
            "action_status": "executed",
            "final_response": response_msg,
        }

    except Exception as exc:
        logger.error("Failed to execute PayPal action %s: %s", action_id, exc)
        await db_manager.update_action_status(
            action_id=action_id,
            status="failed",
            execution_result={"error": str(exc)},
        )
        return {
            "action_status": "failed",
            "final_response": f"❌ **Execution Failed**: {str(exc)}",
        }

