from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Payload for conversational interaction with Guardian Copilot."""
    message: str = Field(..., description="User prompt or inquiry")
    thread_id: Optional[str] = Field(default=None, description="Persistent thread conversation identifier")
    user_id: Optional[str] = Field(default="alex_cro", description="Authenticated user handle")
    active_agent: Optional[str] = Field(
        default="guardian_core",
        description="Target specialized sub-agent (guardian_core, risk_analyst, escrow_agent, scraper_bot, code_audit)",
    )


class ChatResponse(BaseModel):
    """Structured response from LangGraph execution."""
    thread_id: str
    reply: str
    action_status: str
    pending_action: Optional[Dict[str, Any]] = None
    retrieved_context: List[str] = []
    scraped_data: Optional[Dict[str, Any]] = None
    multi_agent_trace: Optional[List[Dict[str, Any]]] = None


class ActionApprovalRequest(BaseModel):
    """Human decision payload to approve or reject a pending action."""
    decision: Literal["approve", "reject"]
    feedback: Optional[str] = None


class ActionApprovalResponse(BaseModel):
    """Confirmation response after human approval or rejection."""
    action_id: str
    status: str
    message: str
    execution_result: Optional[Dict[str, Any]] = None


class ActionItemResponse(BaseModel):
    """Detailed view of an individual pending action."""
    action_id: str
    thread_id: str
    user_id: str
    action_type: str
    tool_name: str
    payload: Dict[str, Any]
    status: str
    feedback: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None
    created_at: str

