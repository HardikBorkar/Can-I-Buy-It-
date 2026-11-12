import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from langchain_core.messages import HumanMessage

from backend.app.agent.graph import guardian_agent_graph
from backend.app.api.schemas import ChatRequest, ChatResponse
from backend.app.core.database import db_manager

logger = logging.getLogger("guardian.api.copilot")

router = APIRouter(prefix="/api/copilot", tags=["Guardian Copilot"])


@router.post("/chat")
async def copilot_chat_endpoint(req: ChatRequest, request: Request):
    """
    Main SSE Streaming Endpoint for Guardian Copilot.
    Streams execution steps:
    - Intent routing & Firecrawl scraping
    - Semantic memory retrieval
    - Action planning & Human-In-The-Loop gate halts
    - Final assistant message & rich action cards
    """
    thread_id = req.thread_id or f"thread-{uuid.uuid4().hex[:8]}"
    accept_header = request.headers.get("accept", "")

    # Check if thread was left in an interrupted HITL state; fork fresh sub-thread to prevent 500 error
    config = {"configurable": {"thread_id": thread_id}}
    try:
        prev_state = await guardian_agent_graph.aget_state(config)
        if prev_state and prev_state.next:
            logger.info(
                "Interrupted state detected on thread %s (next=%s). Forking fresh thread context.",
                thread_id,
                prev_state.next,
            )
            thread_id = f"{thread_id}_{uuid.uuid4().hex[:6]}"
            config = {"configurable": {"thread_id": thread_id}}
    except Exception as state_err:
        logger.warning("Error checking thread state for %s: %s", thread_id, state_err)

    # Helper generator for SSE streaming
    async def event_generator() -> AsyncGenerator[str, None]:
        # Step 1: Initial acknowledgment
        yield {
            "event": "status",
            "data": json.dumps({"status": "routing", "message": "Classifying intent & inspecting merchant URL..."}),
        }
        await asyncio.sleep(0.15)

        # Step 2: Prepare LangGraph initial state with multi-agent consensus swarm
        user_id = req.user_id or "alex_cro"
        user_account = await db_manager.get_user_account(user_id)
        current_balance = user_account["balance"] if user_account else 3500.0

        initial_state = {
            "messages": [HumanMessage(content=req.message)],
            "user_id": user_id,
            "thread_id": thread_id,
            "active_agent": req.active_agent or "guardian_core",
            "current_balance": current_balance,
            "scraped_data": None,
            "retrieved_context": [],
            "pending_action": None,
            "action_status": "idle",
            "final_response": None,
            "trader_proposal": None,
            "audit_feedback": None,
            "debate_turns": 0,
            "consensus_reached": False,
            "arbitration_verdict": None,
            "multi_agent_trace": [],
        }

        config = {"configurable": {"thread_id": thread_id}}

        yield {
            "event": "status",
            "data": json.dumps({"status": "memory", "message": "Retrieving semantic context from ChromaDB..."}),
        }
        await asyncio.sleep(0.1)

        yield {
            "event": "status",
            "data": json.dumps({"status": "swarm_debate", "message": "Multi-agent swarm evaluating proposal (Trader ↔ Auditor ↔ Arbiter)..."}),
        }

        # Step 3: Run Graph execution
        try:
            final_state = await guardian_agent_graph.ainvoke(initial_state, config=config)

            # Check if Firecrawl scraped merchant data
            scraped = final_state.get("scraped_data")
            if scraped:
                yield {
                    "event": "card",
                    "data": json.dumps({
                        "type": "scraped_merchant",
                        "data": scraped,
                    }),
                }

            # Emit multi-agent trace events
            multi_agent_trace = final_state.get("multi_agent_trace", [])
            for trace_item in multi_agent_trace:
                yield {
                    "event": "agent_trace",
                    "data": json.dumps(trace_item),
                }

            # Check if HITL gate triggered
            pending = final_state.get("pending_action")
            action_status = final_state.get("action_status", "idle")

            if pending and action_status == "awaiting_approval":
                yield {
                    "event": "hitl_required",
                    "data": json.dumps({
                        "action_id": pending["action_id"],
                        "action_type": pending["action_type"],
                        "description": pending["description"],
                        "amount": pending["amount"],
                        "currency": pending["currency"],
                        "recipient": pending.get("recipient"),
                        "risk_score": pending.get("risk_score", 98),
                        "idempotency_key": pending.get("idempotency_key"),
                        "raw_payload": pending.get("raw_payload"),
                    }),
                }

            # Check if an action card was generated
            action_card = final_state.get("action_card")
            if action_card:
                if (
                    action_card.get("event") == "expenditure_chart"
                    or action_card.get("type") == "expenditure_chart"
                ):
                    yield {
                        "event": "expenditure_chart",
                        "data": json.dumps(action_card.get("chart_data", action_card)),
                    }
                yield {
                    "event": "card",
                    "data": json.dumps(action_card),
                }

            # Emit final message
            reply = final_state.get("final_response") or "Analysis completed successfully."
            yield {
                "event": "message",
                "data": json.dumps({
                    "thread_id": thread_id,
                    "reply": reply,
                    "action_status": action_status,
                    "multi_agent_trace": multi_agent_trace,
                }),
            }

            # Final done signal
            yield {
                "event": "done",
                "data": json.dumps({
                    "thread_id": thread_id,
                    "status": "complete",
                }),
            }

        except Exception as exc:
            logger.error("Error during LangGraph execution: %s", exc)
            yield {
                "event": "error",
                "data": json.dumps({"error": str(exc)}),
            }

    # If client accepts SSE (or standard stream request)
    if "text/event-stream" in accept_header or request.query_params.get("stream") == "true":
        return EventSourceResponse(event_generator())

    # Fallback to standard synchronous JSON response for REST clients
    user_id = req.user_id or "alex_cro"
    user_account = await db_manager.get_user_account(user_id)
    current_balance = user_account["balance"] if user_account else 3500.0

    initial_state = {
        "messages": [HumanMessage(content=req.message)],
        "user_id": user_id,
        "thread_id": thread_id,
        "active_agent": req.active_agent or "guardian_core",
        "current_balance": current_balance,
        "scraped_data": None,
        "retrieved_context": [],
        "pending_action": None,
        "action_status": "idle",
        "final_response": None,
        "trader_proposal": None,
        "audit_feedback": None,
        "debate_turns": 0,
        "consensus_reached": False,
        "arbitration_verdict": None,
        "multi_agent_trace": [],
    }
    config = {"configurable": {"thread_id": thread_id}}
    final_state = await guardian_agent_graph.ainvoke(initial_state, config=config)

    return ChatResponse(
        thread_id=thread_id,
        reply=final_state.get("final_response") or "Analysis complete.",
        action_status=final_state.get("action_status", "idle"),
        pending_action=final_state.get("pending_action"),
        retrieved_context=final_state.get("retrieved_context", []),
        scraped_data=final_state.get("scraped_data"),
        multi_agent_trace=final_state.get("multi_agent_trace", []),
        action_card=final_state.get("action_card"),
    )

