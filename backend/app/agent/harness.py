"""
Deterministic Financial Execution Harness for Guardian Copilot.
Enforces pre-execution policy checks, provenance validation, liquidity buffer floors,
and strict read-only isolation boundaries.
"""

from decimal import Decimal
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from backend.app.agent.schemas import ProposedOrderPayload

logger = logging.getLogger("guardian.harness")


class HallucinationBlockedError(Exception):
    """Raised when an agent proposes a purchase without grounding in user input or verified tool output."""
    def __init__(self, message: str, clarification_prompt: str):
        super().__init__(message)
        self.message = message
        self.clarification_prompt = clarification_prompt


class PolicyResult(BaseModel):
    passed: bool
    current_balance: Decimal
    debit_amount: Decimal
    floor: Decimal = Decimal("500.00")
    post_balance: Decimal
    reason: str


def validate_purchase_provenance(
    user_prompt: str,
    tool_outputs: Optional[List[Dict[str, Any]]],
    proposal: ProposedOrderPayload,
) -> bool:
    """
    Provenance Validator:
    Verifies that proposal.amount and proposal.item_name are grounded in either:
    1. user_prompt (explicit numbers and words provided by user)
    2. verified tool outputs (Channel3 / Firecrawl scrape output)

    If ungrounded, raises HallucinationBlockedError.
    """
    prompt_lower = user_prompt.lower()
    tool_text = ""
    if tool_outputs:
        for t in tool_outputs:
            tool_text += " " + str(t).lower()

    # 1. Grounding check for amount
    amt_float = float(proposal.amount)
    amt_str_candidates = [
        f"{amt_float:.2f}",
        f"{amt_float:.0f}" if amt_float.is_integer() else f"{amt_float:.2f}",
        str(int(amt_float)) if amt_float.is_integer() else str(amt_float),
    ]

    amount_grounded = any(cand in prompt_lower or cand in tool_text for cand in amt_str_candidates)
    if not amount_grounded:
        logger.warning(
            "Provenance Violation: Amount $%s not found in user prompt or tool outputs.",
            proposal.amount,
        )
        raise HallucinationBlockedError(
            message=f"Proposed amount ${proposal.amount} is ungrounded.",
            clarification_prompt="Could you please specify how much you would like to pay or the price of the item?",
        )

    # 2. Grounding check for item_name
    item_tokens = [tok for tok in re.split(r"\s+", proposal.item_name.lower()) if len(tok) >= 3]
    item_grounded = False
    if not item_tokens:
        item_grounded = True
    else:
        # At least one significant token must appear in user prompt or tool text
        item_grounded = any(tok in prompt_lower or tok in tool_text for tok in item_tokens)

    if not item_grounded:
        logger.warning(
            "Provenance Violation: Item '%s' not found in user prompt or tool outputs.",
            proposal.item_name,
        )
        raise HallucinationBlockedError(
            message=f"Proposed item '{proposal.item_name}' is ungrounded.",
            clarification_prompt="Could you please specify what item you want to buy and from which merchant?",
        )

    return True


def enforce_liquidity_floor(
    current_balance: Decimal,
    debit_amount: Decimal,
    floor: Decimal = Decimal("500.00"),
) -> PolicyResult:
    """
    Pure Decimal liquidity buffer floor check:
    Rejects any transaction where (current_balance - debit_amount) < floor ($500.00).
    """
    post_balance = current_balance - debit_amount
    if post_balance < floor:
        return PolicyResult(
            passed=False,
            current_balance=current_balance,
            debit_amount=debit_amount,
            floor=floor,
            post_balance=post_balance,
            reason=f"Post-purchase balance ${post_balance:.2f} breaches the inviolable ${floor:.2f} safety floor.",
        )

    return PolicyResult(
        passed=True,
        current_balance=current_balance,
        debit_amount=debit_amount,
        floor=floor,
        post_balance=post_balance,
        reason=f"Liquidity reserve intact (${post_balance:.2f} >= ${floor:.2f}).",
    )


def assert_read_only_isolation(intent: str, next_node: str):
    """
    Hard runtime security assertion preventing read-only or informational intents
    from ever transitioning into mutating payment nodes (trader_node, arbiter_node, hitl_gate, executor).
    """
    READ_ONLY_INTENTS = {"EXPENDITURE_ANALYTICS", "ORDER_INSPECT", "CLARIFICATION_NEEDED"}
    MUTATING_NODES = {"trader_node", "arbiter_node", "hitl_gate", "executor"}

    if intent in READ_ONLY_INTENTS and next_node in MUTATING_NODES:
        error_msg = (
            f"SECURITY VIOLATION: Read-only intent '{intent}' cannot transition "
            f"to mutating payment node '{next_node}'."
        )
        logger.critical(error_msg)
        raise AssertionError(error_msg)

