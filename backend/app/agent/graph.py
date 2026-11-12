import logging
from langgraph.graph import StateGraph, START, END
from backend.app.agent.checkpoint import PersistentSqliteCheckpointer

from backend.app.agent.state import AgentState
from backend.app.agent.nodes.router import router_node, route_decision
from backend.app.agent.nodes.direct_nodes import order_inspect_node, invoice_create_node
from backend.app.agent.nodes.analytics_node import analytics_node
from backend.app.agent.nodes.clarification_node import clarification_node
from backend.app.agent.nodes.scraper import scraper_node
from backend.app.agent.nodes.memory_node import memory_node
from backend.app.agent.nodes.trader_node import trader_node
from backend.app.agent.nodes.auditor_node import auditor_node
from backend.app.agent.nodes.arbiter_node import arbiter_node, arbiter_decision
from backend.app.agent.nodes.hitl_gate import hitl_gate_node, hitl_decision
from backend.app.agent.nodes.executor import executor_node

logger = logging.getLogger("guardian.graph")


def build_guardian_graph():
    """
    Constructs and compiles the strict 3-way intent routing & multi-agent consensus workflow.
    - Strict 3-Way Intent Router:
        1. INVOICE_CREATE: Direct to invoice_create_node (incoming funds).
        2. ORDER_INSPECT: Direct to order_inspect_node (read-only audit, never debit/capture).
        3. PURCHASE_CHECKOUT: Multi-agent consensus debate (Trader -> Auditor -> Arbiter).
    - Deterministic Pure Decimal Math & $500 Sacred Safety Floor Audit.
    - Human-In-The-Loop interrupt safety gate (hitl_gate).
    - Real PayPal REST v2 Sandbox execution (executor).
    """
    workflow = StateGraph(AgentState)

    # 1. Register Nodes
    workflow.add_node("router", router_node)
    workflow.add_node("analytics_node", analytics_node)
    workflow.add_node("clarification_node", clarification_node)
    workflow.add_node("order_inspect_node", order_inspect_node)
    workflow.add_node("invoice_create_node", invoice_create_node)
    workflow.add_node("scraper", scraper_node)
    workflow.add_node("memory_node", memory_node)
    workflow.add_node("trader_node", trader_node)
    workflow.add_node("auditor_node", auditor_node)
    workflow.add_node("arbiter_node", arbiter_node)
    workflow.add_node("hitl_gate", hitl_gate_node)
    workflow.add_node("executor", executor_node)

    # 2. Wire Edges
    workflow.add_edge(START, "router")

    # Conditional branch from Router
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "analytics_node": "analytics_node",
            "clarification_node": "clarification_node",
            "order_inspect_node": "order_inspect_node",
            "invoice_create_node": "invoice_create_node",
            "scraper": "scraper",
            "memory_node": "memory_node",
            "executor": "executor",
        },
    )

    # Direct routes
    workflow.add_edge("analytics_node", END)
    workflow.add_edge("clarification_node", END)
    workflow.add_edge("order_inspect_node", END)
    workflow.add_edge("invoice_create_node", "hitl_gate")

    # Multi-agent consensus pipeline (PURCHASE_CHECKOUT)
    workflow.add_edge("scraper", "memory_node")
    workflow.add_edge("memory_node", "trader_node")
    workflow.add_edge("trader_node", "auditor_node")
    workflow.add_edge("auditor_node", "arbiter_node")

    # Cyclic debate & validation branch from Arbiter
    workflow.add_conditional_edges(
        "arbiter_node",
        arbiter_decision,
        {
            "trader_node": "trader_node",  # Cyclic debate loop (max 2 turns)
            "hitl_gate": "hitl_gate",      # Consensus ratified
            "__end__": END,                # Invariant failure or rejected
        },
    )

    # Conditional branch from HITL Gate
    workflow.add_conditional_edges(
        "hitl_gate",
        hitl_decision,
        {
            "executor": "executor",
            "__end__": END,
        },
    )

    workflow.add_edge("executor", END)

    # Persistent SQLite thread checkpointer for state pause, resume, and restart survivability
    checkpointer = PersistentSqliteCheckpointer()
    app = workflow.compile(checkpointer=checkpointer)
    logger.info("Guardian Multi-Agent Swarm StateGraph successfully compiled with checkpointer.")
    return app


# Export singleton compiled agent application
guardian_agent_graph = build_guardian_graph()
