import logging
from typing import Dict, Any
from backend.app.agent.state import AgentState
from backend.app.core.database import db_manager

logger = logging.getLogger("guardian.node.hitl_gate")


async def hitl_gate_node(state: AgentState) -> Dict[str, Any]:
    """
    Human-In-The-Loop (HITL) Safety Gate Node.
    Intercepts any action requiring funds transfer or invoice dispatch.
    Persists the pending action to SQLite and halts execution until human approval.
    """
    pending = state.get("pending_action")
    status = state.get("action_status", "idle")

    if not pending or not pending.get("requires_approval"):
        logger.info("No HITL approval required. Passing through.")
        return {"action_status": "idle"}

    # If action has already been explicitly approved by user
    if status == "approved":
        logger.info("Action %s is approved by human. Proceeding to execution.", pending.get("action_id"))
        return {"action_status": "approved"}

    # If action was rejected
    if status == "rejected":
        logger.info("Action %s was rejected by human.", pending.get("action_id"))
        return {
            "action_status": "rejected",
            "final_response": "Action cancelled by user. No funds were debited and no invoices were sent.",
        }

    # Otherwise: Register pending action in SQLite database
    action_id = pending["action_id"]
    thread_id = state.get("thread_id", "default_thread")
    user_id = state.get("user_id", "default_user")

    await db_manager.create_pending_action(
        action_id=action_id,
        thread_id=thread_id,
        user_id=user_id,
        action_type=pending["action_type"],
        tool_name=pending["tool_name"],
        payload=pending,
    )

    logger.info("Action %s registered in SQLite. Halting state machine for Human Approval.", action_id)
    return {
        "action_status": "awaiting_approval",
    }


def hitl_decision(state: AgentState) -> str:
    """
    Conditional edge function routing out of HITL Gate:
    - If status == 'approved' -> 'executor'
    - If status in ('awaiting_approval', 'rejected', 'idle') -> '__end__'
    """
    status = state.get("action_status", "idle")
    if status == "approved":
        return "executor"
    return "__end__"

