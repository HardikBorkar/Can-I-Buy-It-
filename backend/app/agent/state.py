from typing import Annotated, Any, Dict, List, Literal, Optional, TypedDict
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# =============================================================================
# LANGGRAPH AGENT STATE TYPEDDICT & EXPLICIT FSM LIFECYCLE
# =============================================================================

AgentActionStatus = Literal[
    "idle",
    "awaiting_approval",
    "approved",
    "rejected",
    "executed",
    "failed",
]

class AgentState(TypedDict):
    """
    Enterprise State Machine schema for Guardian Copilot.
    Orchestrates messages, scraping results, semantic memory, and HITL gate states.
    """
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str
    thread_id: str
    active_agent: str  # "guardian_core" | "autonomous_trader" | "invoicing" | "insights"
    scraped_data: Optional[Dict[str, Any]]
    retrieved_context: List[str]
    pending_action: Optional[Dict[str, Any]]  # Holds payload when HITL gate triggers
    action_status: AgentActionStatus  # Explicit Finite State Machine lifecycle
    final_response: Optional[str]


# =============================================================================
# PYDANTIC SCHEMAS FOR HITL ACTIONS & APPROVALS
# =============================================================================

class PendingActionPayload(BaseModel):
    """Structured description of an action waiting for Human-In-The-Loop approval."""
    action_id: str = Field(description="Unique deterministic identifier for the action")
    action_type: Literal["create_order", "capture_order", "send_invoice", "escrow_release"]
    tool_name: str
    description: str
    amount: float = Field(default=0.0)
    currency: str = Field(default="USD")
    recipient: Optional[str] = None
    risk_score: int = Field(default=98, description="Safety score out of 100")
    safety_buffer_intact: bool = Field(default=True)
    post_balance_floor: float = Field(default=500.0)
    requires_approval: bool = Field(default=True)
    idempotency_key: str
    raw_payload: Dict[str, Any]


class ActionDecision(BaseModel):
    """Human decision payload to approve or reject a pending transaction."""
    action_id: str
    decision: Literal["approve", "reject"]
    feedback: Optional[str] = None

