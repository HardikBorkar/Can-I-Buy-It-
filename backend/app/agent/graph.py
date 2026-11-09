import logging
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from backend.app.agent.state import AgentState
from backend.app.agent.nodes.router import router_node, route_decision
from backend.app.agent.nodes.scraper import scraper_node
from backend.app.agent.nodes.memory_node import memory_node
from backend.app.agent.nodes.planner import planner_node
from backend.app.agent.nodes.hitl_gate import hitl_gate_node, hitl_decision
from backend.app.agent.nodes.executor import executor_node

logger = logging.getLogger("guardian.graph")


def build_guardian_graph():
    """
    Constructs and compiles the deterministic enterprise LangGraph workflow.
    Features:
    - Intent routing & Firecrawl scraping
    - Semantic memory retrieval & context trimming
    - Financial invariant planning
    - Human-In-The-Loop interrupt safety gate
    - Resilient PayPal REST v2 execution
    """
    workflow = StateGraph(AgentState)

    # 1. Register Nodes
    workflow.add_node("router", router_node)
    workflow.add_node("scraper", scraper_node)
    workflow.add_node("memory_node", memory_node)
    workflow.add_node("planner", planner_node)
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
    workflow.add_edge("memory_node", "planner")
    workflow.add_edge("planner", "hitl_gate")

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
    logger.info("Guardian Copilot StateGraph successfully compiled with checkpointer.")
    return app


# Export singleton compiled agent application
guardian_agent_graph = build_guardian_graph()

