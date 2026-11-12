"""
Expenditure Analytics Node for Guardian Copilot.
Exclusively handles EXPENDITURE_ANALYTICS queries.
Queries real PayPal Sandbox Reporting/Invoicing APIs and merges with SQLite Write-Through Ledger.
Eliminates 100% of hardcoded dummy transactions.
Never triggers mutating payment gates or human approval cards.
"""

from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any, Dict, List
from backend.app.agent.state import AgentState
from backend.app.agent.tools.paypal_client import paypal_client
from backend.app.agent.harness import assert_read_only_isolation
from backend.app.core.database import db_manager

logger = logging.getLogger("guardian.node.analytics")


def categorize_transaction(merchant: str = "", item: str = "") -> str:
    """
    Categorizes a real PayPal transaction by merchant/item keywords:
    - Cloud & APIs
    - Hardware
    - Software & SaaS
    - Services & Invoices
    - General Retail
    """
    text = f"{merchant} {item}".lower()

    if any(k in text for k in ("aws", "cloud", "hosting", "azure", "gcp", "vultr", "digitalocean", "api", "openai", "anthropic", "database", "server")):
        return "Cloud & APIs"
    if any(k in text for k in ("sony", "apple", "hardware", "laptop", "phone", "headphone", "wh-1000xm", "camera", "gear", "device", "monitor", "electronics")):
        return "Hardware"
    if any(k in text for k in ("saas", "software", "subscription", "github", "figma", "slack", "notion", "license", "copilot", "intellij", "jetbrains")):
        return "Software & SaaS"
    if any(k in text for k in ("invoice", "consulting", "service", "deliverable", "architecture", "retainer", "contract", "freelance", "fee")):
        return "Services & Invoices"

    return "General Retail"


async def analytics_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes expenditure analytics:
    - Verifies read-only isolation boundary
    - Queries real PayPal Sandbox Reporting + Invoicing APIs
    - Merges with local SQLite Write-Through Ledger, deduplicating by paypal_id
    - Groups by category using pure Python Decimal math
    - If 0 transactions exist, returns empty-state chart message (totalSpent: 0.00)
    """
    intent = state.get("intent") or "EXPENDITURE_ANALYTICS"
    assert_read_only_isolation(intent, "analytics_node")

    logger.info("Executing analytics_node for real PayPal Sandbox expenditure breakdown")

    # 1. Dual fetch from PayPal Sandbox (Reporting + Invoices)
    raw_sandbox_txns: List[Dict[str, Any]] = []
    try:
        raw_sandbox_txns = await paypal_client.fetch_sandbox_expenditures(days=30)
    except Exception as exc:
        logger.warning("Could not fetch remote sandbox expenditures: %s", exc)

    # 2. Fetch local write-through ledger from SQLite (bypasses 3-hr index lag)
    recorded_txns: List[Dict[str, Any]] = []
    try:
        recorded_txns = await db_manager.get_recorded_transactions(days=30)
    except Exception as exc:
        logger.warning("Could not fetch local SQLite recorded transactions: %s", exc)

    # 3. Merge and deduplicate by paypal_id
    tx_map: Dict[str, Dict[str, Any]] = {}
    for tx in recorded_txns:
        pid = tx.get("paypal_id")
        if pid:
            tx_map[pid] = tx

    for tx in raw_sandbox_txns:
        pid = tx.get("paypal_id")
        if pid and pid not in tx_map:
            tx_map[pid] = tx

    # 4. Handle genuine empty state (0 transactions found)
    if not tx_map:
        empty_chart = {
            "title": "Last Month Expenditure by Category",
            "period": "Last 30 Days",
            "totalSpent": 0.0,
            "total_spent": 0.0,
            "currency": "USD",
            "source": "PayPal Sandbox Ledger",
            "data_source": "PayPal Sandbox Ledger",
            "categories": [],
            "series": [],
        }
        empty_reply = (
            "📊 **Last Month Expenditure Analytics (Last 30 Days)**\n\n"
            "- **Total Outflow:** **$0.00 USD**\n"
            "- **Data Source:** Live PayPal Sandbox & Write-Through Ledger\n\n"
            "No completed sandbox purchases or invoices were found for the last 30 days. "
            "To populate real expenditure analytics, authorize a Sandbox payment or dispatch an invoice in the chat."
        )
        trace = [
            {
                "agent": "AnalyticsEngine",
                "turn": 0,
                "action": "aggregate_expenditure",
                "message": "Queried PayPal Sandbox & Write-Through Ledger: 0 transactions found (empty state active).",
            }
        ]
        return {
            "final_response": empty_reply,
            "action_status": "completed",
            "pending_action": None,
            "action_card": {
                "type": "expenditure_chart",
                "event": "expenditure_chart",
                "chartData": empty_chart,
                "chart_data": empty_chart,
            },
            "multi_agent_trace": trace,
            "tools_called": [
                {
                    "name": "get_expenditure_analytics",
                    "input_parameters": {"period": "30d", "results_count": 0},
                }
            ],
        }

    # 5. Group expenditures by category using Decimal arithmetic
    category_totals: Dict[str, Decimal] = {}
    for tx in tx_map.values():
        cat = tx.get("category") or categorize_transaction(tx.get("merchant", ""), tx.get("item", ""))
        amt_dec = Decimal(str(tx.get("amount", 0.0)))
        category_totals[cat] = category_totals.get(cat, Decimal("0.00")) + amt_dec

    total_spent_dec = sum(category_totals.values(), Decimal("0.00"))
    total_spent = float(total_spent_dec)

    categories_list: List[Dict[str, Any]] = []
    for cat, amt in category_totals.items():
        pct = float((amt / total_spent_dec * Decimal("100")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)) if total_spent_dec > 0 else 0.0
        categories_list.append({
            "category": cat,
            "amount": float(amt),
            "percentage": pct,
        })

    categories_list.sort(key=lambda x: x["amount"], reverse=True)

    trace = [
        {
            "agent": "AnalyticsEngine",
            "turn": 0,
            "action": "aggregate_expenditure",
            "message": f"Aggregated last 30 days expenditure across {len(categories_list)} categories from {len(tx_map)} PayPal Sandbox transactions.",
        }
    ]

    chart_data = {
        "title": "Last Month Expenditure by Category",
        "period": "Last 30 Days",
        "totalSpent": total_spent,
        "total_spent": total_spent,
        "currency": "USD",
        "source": "PayPal Sandbox Ledger",
        "data_source": "PayPal Sandbox Ledger",
        "categories": categories_list,
        "series": [
            {"label": c["category"], "amount": c["amount"], "category": c["category"]}
            for c in categories_list
        ],
    }

    action_card = {
        "type": "expenditure_chart",
        "event": "expenditure_chart",
        "chartData": chart_data,
        "chart_data": chart_data,
    }

    category_lines = "\n".join(f"- **{c['category']}**: ${c['amount']:,.2f} ({c['percentage']}%)" for c in categories_list)
    final_reply = (
        f"📊 **Last Month Expenditure by Category (Last 30 Days)**\n\n"
        f"- **Total Outflow:** **${total_spent:,.2f} USD**\n"
        f"- **Data Source:** PayPal Sandbox & Write-Through Ledger ({len(tx_map)} live transactions)\n\n"
        f"**Category Breakdown:**\n{category_lines}\n\n"
        f"Here is your category-wise expenditure chart rendered below."
    )

    return {
        "final_response": final_reply,
        "action_status": "completed",
        "pending_action": None,
        "action_card": action_card,
        "multi_agent_trace": trace,
        "tools_called": [
            {
                "name": "get_expenditure_analytics",
                "input_parameters": {"period": "30d", "results_count": len(tx_map)},
            }
        ],
    }
