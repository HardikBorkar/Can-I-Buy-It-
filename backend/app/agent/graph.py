import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from backend.app.agent.state import AgentState
from backend.app.agent.nodes.router import router_node, route_decision
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
    Constructs and compiles the multi-agent consensus swarm workflow.
    Features:
    - Intent routing & Firecrawl scraping
    - Semantic memory retrieval (ChromaDB)
    - Multi-Agent Consensus Swarm:
        1. Agent 1: Trader / Proposal Agent (`trader_node`)
        2. Agent 2: Risk & Audit Agent (`auditor_node`)
        3. Agent 3: Guardian Arbiter (`arbiter_node`)
      With a cyclic debate/validation loop (max 2 turns)
    - Human-In-The-Loop interrupt safety gate (`hitl_gate`)
    - Resilient PayPal REST v2 Sandbox execution (`executor`)
    """
    workflow = StateGraph(AgentState)

    # 1. Register Nodes
    workflow.add_node("router", router_node)
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
            "scraper": "scraper",
            "memory_node": "memory_node",
            "executor": "executor",
        },
    )

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

    # In-memory thread checkpointer for state pause and resume
    checkpointer = MemorySaver()
    app = workflow.compile(checkpointer=checkpointer)
    logger.info("Guardian Multi-Agent Swarm StateGraph successfully compiled with checkpointer.")
    return app


# Export singleton compiled agent application
guardian_agent_graph = build_guardian_graph()
