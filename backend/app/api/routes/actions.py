import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from backend.app.api.schemas import ActionApprovalRequest, ActionApprovalResponse, ActionItemResponse
from backend.app.core.database import db_manager
from backend.app.agent.tools.paypal_client import paypal_client

logger = logging.getLogger("guardian.api.actions")

router = APIRouter(prefix="/api/copilot/actions", tags=["HITL Action Safety Gates"])


@router.get("", response_model=List[ActionItemResponse])
async def list_actions(status_filter: Optional[str] = None):
    """Lists pending and historical HITL actions."""
    items = await db_manager.list_pending_actions(status=status_filter)
    return items


@router.get("/{action_id}", response_model=ActionItemResponse)
async def get_action(action_id: str):
    """Retrieves full details of a specific HITL action."""
    action = await db_manager.get_pending_action(action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action with ID '{action_id}' not found.",
        )
    return action


@router.post("/{action_id}", response_model=ActionApprovalResponse)
async def approve_or_reject_action(action_id: str, req: ActionApprovalRequest):
    """
    Human-In-The-Loop Approval Gateway.
    When a user approves an action:
    - Verifies action exists and is awaiting approval
    - Invokes PayPal REST v2 with idempotent payload
    - Records execution result and updates audit database
    """
    action = await db_manager.get_pending_action(action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action with ID '{action_id}' not found.",
        )

    current_status = action.get("status")
    if current_status not in ("awaiting_approval", "pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{action_id}' is already {current_status}.",
        )

    # 1. Handle Rejection
    if req.decision == "reject":
        await db_manager.update_action_status(
            action_id=action_id,
            status="rejected",
            feedback=req.feedback or "Rejected by user.",
        )
        return ActionApprovalResponse(
            action_id=action_id,
            status="rejected",
            message="Action has been safely rejected. No charges or invoices were created.",
            execution_result=None,
        )

    # 2. Handle Approval & Execution
    payload = action.get("payload", {})
    action_type = action.get("action_type")
    raw_payload = payload.get("raw_payload", {})

    logger.info("Human approved action %s. Executing via PayPal REST v2...", action_id)

    try:
        execution_result = {}

        if action_type == "create_order":
            execution_result = await paypal_client.create_order(
                amount=float(raw_payload.get("amount", 100.0)),
                currency=raw_payload.get("currency", "USD"),
                description=raw_payload.get("description", "Guardian Approved Commerce"),
                reference_id=raw_payload.get("reference_id"),
                pay_in_4=raw_payload.get("pay_in_4", False),
            )
            msg = f"Order #{execution_result.get('order_id')} successfully created in PayPal Sandbox."

        elif action_type == "capture_order":
            execution_result = await paypal_client.capture_order(
                order_id=raw_payload.get("order_id", ""),
            )
            msg = f"Order captured with capture ID {execution_result.get('capture_id')}."

        elif action_type == "send_invoice":
            execution_result = await paypal_client.create_and_send_invoice(
                recipient_email=raw_payload.get("recipient_email", "client@venturecap.io"),
                items=raw_payload.get("items", []),
                currency=raw_payload.get("currency", "USD"),
                note=raw_payload.get("note", "Billed via Guardian Copilot Autonomous Invoicing"),
            )
            msg = f"Invoice #{execution_result.get('invoice_number')} sent to {execution_result.get('recipient')}."

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported action type '{action_type}'",
            )

        # Update SQLite status
        await db_manager.update_action_status(
            action_id=action_id,
            status="executed",
            execution_result=execution_result,
            feedback=req.feedback,
        )

        return ActionApprovalResponse(
            action_id=action_id,
            status="executed",
            message=msg,
            execution_result=execution_result,
        )

    except Exception as exc:
        logger.error("Execution error on approved action %s: %s", action_id, exc)
        await db_manager.update_action_status(
            action_id=action_id,
            status="failed",
            execution_result={"error": str(exc)},
            feedback=req.feedback,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PayPal API Execution failed: {str(exc)}",
        )

