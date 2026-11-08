import logging
from typing import Dict, Any
from backend.app.agent.state import AgentState
from backend.app.memory.vector_store import vector_store
from backend.app.memory.session_manager import session_manager

logger = logging.getLogger("guardian.node.memory")


async def memory_node(state: AgentState) -> Dict[str, Any]:
    """
    Performs semantic vector search against ChromaDB memory.
    Trims token context and attaches relevant financial invariants.
    """
    messages = state.get("messages", [])
    query = ""
    if messages:
        last = messages[-1]
        query = last.content if hasattr(last, "content") else str(last)

    # 1. Semantic search in ChromaDB
    semantic_docs = vector_store.search_similar(query=query or "financial safety buffer", n_results=3)

    # 2. Context trimming
    trimmed = session_manager.trim_messages(messages)

    existing_context = state.get("retrieved_context", [])
    merged_context = list(set(existing_context + semantic_docs))

    logger.info("Memory node retrieved %d context items from ChromaDB.", len(semantic_docs))
    return {
        "messages": trimmed,
        "retrieved_context": merged_context,
    }

