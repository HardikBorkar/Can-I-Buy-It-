import logging
import re
from typing import Dict, Any
from langchain_core.messages import HumanMessage
from backend.app.agent.state import AgentState

logger = logging.getLogger("guardian.node.router")

URL_REGEX = re.compile(r"https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)")


async def router_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyzes user intent and extracts routing metadata.
    Detects URLs for Firecrawl scraping and classifies operational intent.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"action_status": "idle"}

    last_message = messages[-1]
    content = last_message.content if hasattr(last_message, "content") else str(last_message)

    # Check if a URL is present in the prompt
    url_match = URL_REGEX.search(content)
    if url_match:
        logger.info("Router detected URL in input: %s", url_match.group(0))
        # Keep URL in state context
        return {
            "retrieved_context": [f"Target URL to scrape: {url_match.group(0)}"],
        }

    return {}


def route_decision(state: AgentState) -> str:
    """
    Conditional edge function routing from router:
    - If URL in context -> 'scraper'
    - If action is already approved -> 'executor'
    - Otherwise -> 'memory_node'
    """
    status = state.get("action_status", "idle")
    if status == "approved":
        return "executor"

    context = state.get("retrieved_context", [])
    for c in context:
        if "Target URL to scrape:" in c:
            return "scraper"

    return "memory_node"

