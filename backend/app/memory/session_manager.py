import logging
from typing import List
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage

logger = logging.getLogger("guardian.session_manager")


class SessionMemoryManager:
    """
    Manages thread history with a sliding-window context trimmer.
    Preserves system instructions while bounding message history tokens.
    """

    def __init__(self, max_messages: int = 10):
        self.max_messages = max_messages

    def trim_messages(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        """
        Keeps system messages plus the most recent N messages.
        Prevents unbounded message growth in persistent LangGraph checkpoints.
        """
        if len(messages) <= self.max_messages:
            return messages

        system_messages = [m for m in messages if isinstance(m, SystemMessage)]
        non_system = [m for m in messages if not isinstance(m, SystemMessage)]

        # Keep the most recent messages
        trimmed_non_system = non_system[-self.max_messages :]
        result = system_messages + trimmed_non_system
        logger.debug(
            "Trimmed message history from %d to %d messages.",
            len(messages),
            len(result),
        )
        return result


session_manager = SessionMemoryManager(max_messages=12)

