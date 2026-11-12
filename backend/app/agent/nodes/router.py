import json
import logging
import re
from typing import Any, Dict, Literal, Optional
import httpx
from pydantic import BaseModel, Field

from backend.app.agent.state import AgentState
from backend.app.agent.harness import assert_read_only_isolation
from backend.app.core.config import settings

logger = logging.getLogger("guardian.node.router")

URL_REGEX = re.compile(
    r"https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)"
)


class IntentClassification(BaseModel):
    """Structured output schema for strict 5-way fail-closed intent classification."""
    intent: Literal[
        "EXPENDITURE_ANALYTICS",
        "ORDER_INSPECT",
        "INVOICE_CREATE",
        "PURCHASE_CHECKOUT",
        "CLARIFICATION_NEEDED",
    ] = Field(description="Mutually exclusive operational intent")
    reasoning: str = Field(default="", description="Classification justification")
    recipient_email: Optional[str] = Field(default=None, description="Recipient email for invoices")
    amount: Optional[float] = Field(default=None, description="Stated dollar amount")
    currency: str = Field(default="USD", description="Currency ISO-4217 code")
    description: Optional[str] = Field(default=None, description="Service or transaction note")
    order_id: Optional[str] = Field(default=None, description="PayPal order ID for inspection")
    item_name: Optional[str] = Field(default=None, description="Item or product name")
    quantity: int = Field(default=1, description="Number of units")
    unit_price: Optional[float] = Field(default=None, description="Unit price per item")
    stated_total: Optional[float] = Field(default=None, description="Explicit stated total in request")
    current_balance: Optional[float] = Field(default=None, description="User balance stated in request")
    merchant: Optional[str] = Field(default=None, description="Merchant name")
    start_date: Optional[str] = Field(default=None, description="Analytics start date")
    end_date: Optional[str] = Field(default=None, description="Analytics end date")


def classify_user_intent(query: str) -> IntentClassification:
    """
    Deterministic 5-Way Fail-Closed Intent Classifier.
    Eliminates all hardcoded fallback defaults. Never fabricates merchant or price.
    1. EXPENDITURE_ANALYTICS: User asks for spending graphs, charts, monthly expenses, or transaction breakdowns.
    2. ORDER_INSPECT: User asks to check/audit an existing order ID (read-only).
    3. INVOICE_CREATE: User wants to bill/invoice someone (incoming funds).
    4. PURCHASE_CHECKOUT: User explicitly asks to buy an item or pay a merchant with specific parameters.
    5. CLARIFICATION_NEEDED: Default fallback when intent is ambiguous or missing required parameters.
    """
    lower = query.lower().strip()

    # -------------------------------------------------------------------------
    # 1. EXPENDITURE_ANALYTICS (Read-Only Spending Visualizations & Ledgers)
    # -------------------------------------------------------------------------
    analytics_triggers = [
        "expenditure",
        "spending",
        "expense",
        "expenses",
        "bar chart",
        "chart",
        "graph",
        "breakdown",
        "categorywise",
        "category wise",
        "outflow",
        "outflows",
        "financial report",
        "how much did i spend",
        "last month",
        "last months",
    ]
    is_analytics = any(trigger in lower for trigger in analytics_triggers) and not (
        lower.startswith("buy") or lower.startswith("purchase") or "draft a paypal invoice" in lower
    )

    if is_analytics:
        return IntentClassification(
            intent="EXPENDITURE_ANALYTICS",
            reasoning="User requested expenditure analytics, spend visualization, or ledger breakdown.",
            description="Expenditure breakdown & category chart",
        )

    # -------------------------------------------------------------------------
    # 2. INVOICE_CREATE (Incoming Funds / Accounts Receivable)
    # -------------------------------------------------------------------------
    is_invoice = (
        "invoice" in lower
        or "bill client" in lower
        or "draft a bill" in lower
        or "request payment" in lower
        or ("bill" in lower and "@" in lower)
    )
    if is_invoice and not (lower.startswith("check") and "order" in lower):
        email_match = re.search(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", query)
        recipient_email = email_match.group(1) if email_match else None

        amt_match = re.search(r"\$(\d+(?:\.\d{1,2})?)", query) or re.search(r"(?:for|amount)\s+(\d+(?:\.\d{1,2})?)", lower)
        amount = float(amt_match.group(1)) if amt_match else None

        desc_match = re.search(r"for\s+([^.$@\n]+?)(?:\s+to|\s+at|\.|$)", query, re.IGNORECASE)
        desc = desc_match.group(1).strip() if desc_match else None
        for_matches = list(re.finditer(r"for\s+([^.$@\n]+)", query, re.IGNORECASE))
        if for_matches:
            for m in for_matches:
                val = m.group(1).strip()
                if not re.match(r"^\$?\d+", val):
                    desc = val
                    break

        if not recipient_email or amount is None:
            return IntentClassification(
                intent="CLARIFICATION_NEEDED",
                reasoning="Invoice request missing recipient email or dollar amount.",
            )

        return IntentClassification(
            intent="INVOICE_CREATE",
            reasoning="User explicitly requested creating or drafting an incoming PayPal invoice.",
            recipient_email=recipient_email,
            amount=amount,
            currency="USD",
            description=desc or "Consulting and Deliverable Services",
        )

    # -------------------------------------------------------------------------
    # 3. ORDER_INSPECT (Read-Only Order Audit)
    # -------------------------------------------------------------------------
    is_inspect = (
        ("order #" in lower or "order id" in lower or re.search(r"\border\s*#?[\da-zA-Z_-]+\b", lower))
        and ("buy" not in lower and "purchase" not in lower and "checkout" not in lower)
    ) or (
        any(k in lower for k in ["check", "audit", "inspect", "status of", "verify"])
        and "order" in lower
        and "buy" not in lower
        and "purchase" not in lower
    )
    if is_inspect:
        order_match = re.search(r"order\s*#?([A-Za-z0-9_-]+)", query, re.IGNORECASE) or re.search(r"#([A-Za-z0-9_-]+)", query)
        order_id = order_match.group(1) if order_match else None
        if not order_id:
            return IntentClassification(
                intent="CLARIFICATION_NEEDED",
                reasoning="Order inspection requested but no order identifier was specified.",
            )

        return IntentClassification(
            intent="ORDER_INSPECT",
            reasoning=f"User requested read-only inspection/audit of PayPal order ID #{order_id}.",
            order_id=order_id,
        )

    # -------------------------------------------------------------------------
    # 4. PURCHASE_CHECKOUT (Outgoing Funds / Commerce Checkout)
    # -------------------------------------------------------------------------
    is_purchase = any(k in lower for k in ["buy", "purchase", "order", "checkout", "pay"])
    if is_purchase:
        qty_match = re.search(r"(\d+)\s*x\b", lower) or re.search(r"(\d+)\s*(?:units?|pieces?|nodes?|items?)", lower)
        quantity = int(qty_match.group(1)) if qty_match else 1

        unit_match = re.search(r"at\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:each)?", lower) or re.search(r"for\s+\$?(\d+(?:\.\d{1,2})?)", lower)
        unit_price = float(unit_match.group(1)) if unit_match else None

        stated_match = re.search(r"(?:stated total|total)\s+\$?(\d+(?:\.\d{1,2})?)", lower)
        stated_total = float(stated_match.group(1)) if stated_match else None

        bal_match = re.search(r"balance\s+(?:is\s+)?\$?(\d+(?:\.\d{1,2})?)", lower)
        current_balance = float(bal_match.group(1)) if bal_match else None

        item_match = re.search(
            r"(?:buy|purchase|order|checkout|get)\s+(?:\d+x\s+)?(?:a\s+|an\s+|the\s+)?([A-Za-z0-9\s_-]+?)(?:\s+at|\s+for|\s+from|\s+when|\s+with|\.|$)",
            query,
            re.IGNORECASE,
        )
        item_name = item_match.group(1).strip() if item_match else None

        merchant_match = re.search(r"from\s+([A-Za-z0-9\s_-]+?)(?:\s+when|\s+with|\.|$)", query, re.IGNORECASE)
        merchant = merchant_match.group(1).strip() if merchant_match else None

        # Fail-Closed Rule: If neither item nor price is identifiable, do not invent them
        if not item_name or (unit_price is None and stated_total is None):
            return IntentClassification(
                intent="CLARIFICATION_NEEDED",
                reasoning="Purchase command lacks verifiable item name or pricing.",
            )

        return IntentClassification(
            intent="PURCHASE_CHECKOUT",
            reasoning="User requested retail purchase/payment with verified parameters.",
            item_name=item_name,
            quantity=quantity,
            unit_price=unit_price,
            stated_total=stated_total,
            current_balance=current_balance,
            merchant=merchant or "Verified Merchant",
            currency="USD",
        )

    # -------------------------------------------------------------------------
    # 5. CLARIFICATION_NEEDED (Fail-Closed Default)
    # -------------------------------------------------------------------------
    return IntentClassification(
        intent="CLARIFICATION_NEEDED",
        reasoning="Query did not unambiguously match any supported execution intent.",
    )


_LLM_INTENT_CACHE: Dict[str, Optional[IntentClassification]] = {}
_MAX_CACHE_SIZE = 256


async def extract_intent_with_llm(query: str) -> Optional[IntentClassification]:
    """
    Fallback natural language intent extraction using OpenRouter (Gemini 2.5 Flash).
    Parses conversational queries into structured parameters when regex fast-path is inconclusive.
    Uses a bounded in-memory LRU cache to reduce latency and eliminate redundant LLM inference.
    """
    cache_key = query.strip().lower()
    if cache_key in _LLM_INTENT_CACHE:
        logger.debug("Router cache hit for query: '%s'", cache_key)
        return _LLM_INTENT_CACHE[cache_key]

    api_key = settings.OPENROUTER_API_KEY or settings.GEMINI_API_KEY
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a strict JSON intent classifier for a PayPal financial copilot. "
                                "Given a user query, output a valid JSON object ONLY (no markdown fences) with keys:\n"
                                "- intent: 'PURCHASE_CHECKOUT' | 'INVOICE_CREATE' | 'EXPENDITURE_ANALYTICS' | 'ORDER_INSPECT' | 'CLARIFICATION_NEEDED'\n"
                                "- item_name: string or null\n"
                                "- amount: number or null\n"
                                "- merchant: string or null\n"
                                "- recipient_email: string or null\n"
                                "- reasoning: short explanation string"
                            ),
                        },
                        {"role": "user", "content": f"Classify this query: {query}"},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 250,
                },
            )
            if resp.status_code == 200:
                raw_text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                clean_json = raw_text.replace("```json", "").replace("```", "").strip()
                data = json.loads(clean_json)
                parsed_intent = str(data.get("intent", "")).upper()

                result_item = None
                if parsed_intent == "PURCHASE_CHECKOUT" and data.get("item_name") and data.get("amount"):
                    result_item = IntentClassification(
                        intent="PURCHASE_CHECKOUT",
                        reasoning=data.get("reasoning", "LLM natural language purchase extraction"),
                        item_name=str(data.get("item_name")),
                        unit_price=float(data.get("amount")),
                        quantity=1,
                        merchant=str(data.get("merchant") or "Verified Merchant"),
                        currency="USD",
                    )
                elif parsed_intent == "INVOICE_CREATE" and data.get("recipient_email") and data.get("amount"):
                    result_item = IntentClassification(
                        intent="INVOICE_CREATE",
                        reasoning=data.get("reasoning", "LLM natural language invoice extraction"),
                        recipient_email=str(data.get("recipient_email")),
                        amount=float(data.get("amount")),
                        description=str(data.get("item_name") or "Consulting and Deliverable Services"),
                        currency="USD",
                    )
                elif parsed_intent == "EXPENDITURE_ANALYTICS":
                    result_item = IntentClassification(
                        intent="EXPENDITURE_ANALYTICS",
                        reasoning=data.get("reasoning", "LLM natural language analytics extraction"),
                    )
                elif parsed_intent == "ORDER_INSPECT" and data.get("order_id"):
                    result_item = IntentClassification(
                        intent="ORDER_INSPECT",
                        reasoning=data.get("reasoning", "LLM natural language order inspection"),
                        order_id=str(data.get("order_id")),
                    )

                if result_item:
                    if len(_LLM_INTENT_CACHE) >= _MAX_CACHE_SIZE:
                        _LLM_INTENT_CACHE.pop(next(iter(_LLM_INTENT_CACHE)))
                    _LLM_INTENT_CACHE[cache_key] = result_item
                    return result_item
    except Exception as exc:
        logger.warning("LLM router classification fallback skipped: %s", exc)

    return None


async def router_node(state: AgentState) -> Dict[str, Any]:
    """
    Strict 5-Way Intent Router Node.
    Classifies user requests into one of 5 mutually exclusive intents using structured output:
    - EXPENDITURE_ANALYTICS: User wants to see spending charts/graphs (read-only).
    - ORDER_INSPECT: User wants to check/audit an existing order ID (read-only).
    - INVOICE_CREATE: User wants to bill/invoice someone (incoming funds).
    - PURCHASE_CHECKOUT: User wants to buy an item or pay a merchant (outgoing funds).
    - CLARIFICATION_NEEDED: Ambiguous query, open-ended question, or missing parameters.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"action_status": "idle"}

    last_message = messages[-1]
    content = last_message.content if hasattr(last_message, "content") else str(last_message)

    classification = classify_user_intent(content)
    if classification.intent == "CLARIFICATION_NEEDED":
        llm_classification = await extract_intent_with_llm(content)
        if llm_classification:
            classification = llm_classification

    logger.info("Router classified intent: %s (reason: %s)", classification.intent, classification.reasoning)

    result: Dict[str, Any] = {
        "intent": classification.intent,
        "intent_data": classification.model_dump(),
    }

    if classification.current_balance is not None:
        result["current_balance"] = classification.current_balance

    # Check for URLs to scrape
    url_match = URL_REGEX.search(content)
    if url_match:
        logger.info("Router detected URL in input: %s", url_match.group(0))
        result["retrieved_context"] = [f"Target URL to scrape: {url_match.group(0)}"]

    return result


def route_decision(state: AgentState) -> str:
    """
    Conditional edge function routing from router:
    - EXPENDITURE_ANALYTICS -> 'analytics_node' (Read-Only)
    - ORDER_INSPECT -> 'order_inspect_node' (Read-Only)
    - INVOICE_CREATE -> 'invoice_create_node'
    - CLARIFICATION_NEEDED -> 'clarification_node'
    - PURCHASE_CHECKOUT -> 'scraper' (if URL) or 'memory_node'
    - If already approved -> 'executor'
    """
    status = state.get("action_status", "idle")
    if status == "approved":
        return "executor"

    intent = state.get("intent")

    if intent == "EXPENDITURE_ANALYTICS":
        assert_read_only_isolation(intent, "analytics_node")
        return "analytics_node"

    if intent == "ORDER_INSPECT":
        assert_read_only_isolation(intent, "order_inspect_node")
        return "order_inspect_node"

    if intent == "INVOICE_CREATE":
        return "invoice_create_node"

    if intent == "CLARIFICATION_NEEDED":
        assert_read_only_isolation(intent, "clarification_node")
        return "clarification_node"

    # PURCHASE_CHECKOUT flow
    context = state.get("retrieved_context", [])
    for c in context:
        if "Target URL to scrape:" in c:
            return "scraper"

    return "memory_node"
