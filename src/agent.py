"""
PayPal Guardian - Autonomous Financial Agent Orchestrator.
Exposes tool-calling capabilities to LLMs:
- evaluate_purchase(item_name, price): Deterministic 90-day simulation using PayPal balance and recurring commitments.
- create_paypal_checkout(item_name, price): Creates PayPal Orders v2 with Pay Later links.
- generate_paypal_bill(recipient_email, amount, description): Invoices v2 dispatch.
- get_paypal_account_summary(): Live balance and cash flow health breakdown.
"""

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from src.adapter import PayPalContextAdapter
from src.engine.plan_selector import PlanSelector
from src.engine.reconciler import FinancialReconciler
from src.paypal_client import PayPalClient

load_dotenv()
logger = logging.getLogger("paypal_guardian.agent")


class PayPalGuardianAgent:
    """
    Autonomous Financial Guardian for safe commerce.
    Executes financial simulations and triggers PayPal Developer platform operations.
    """

    def __init__(
        self,
        paypal_client: Optional[PayPalClient] = None,
        default_minimum_balance: float = 500.0,
    ):
        self.paypal = paypal_client or PayPalClient()
        self.default_minimum_balance = float(
            os.getenv("DEFAULT_MINIMUM_SAFETY_BALANCE", default_minimum_balance)
        )

    # =========================================================================
    # TOOL 1: EVALUATE PURCHASE (THE CORE "BUY OR WAIT?" ENGINE)
    # =========================================================================

    def evaluate_purchase(
        self,
        item_name: str,
        price: float,
        minimum_balance: Optional[float] = None,
        currency: str = "USD",
    ) -> Dict[str, Any]:
        """
        Tool: Evaluate whether a requested purchase is safe to buy today.
        Runs a 90-day rolling cash flow simulation against live PayPal balances,
        salary cycles, recurring bills, and the user's minimum reserve threshold.
        """
        min_bal = minimum_balance if minimum_balance is not None else self.default_minimum_balance

        # 1. Fetch live or sandbox account state
        balance_data = self.paypal.get_balances(currency_code=currency)
        transactions = self.paypal.get_transactions()

        # 2. Build relational context
        context = PayPalContextAdapter.create_user_financial_context(
            item_name=item_name,
            price=price,
            balance_data=balance_data,
            transactions=transactions,
            minimum_balance=min_bal,
        )

        # 3. Deterministic ledger reconciliation
        reconciled_events = FinancialReconciler.reconcile(context)

        # 4. 6-Tier tie-breaker decision simulation
        decision = PlanSelector.select_plan(context, reconciled_events)

        return {
            "item_name": item_name,
            "requested_price": price,
            "currency": currency,
            "current_available_balance": balance_data.get("available_balance", 0.0),
            "minimum_safety_buffer": min_bal,
            "amount_safe_to_pay_today": decision.get("amount_safe_to_pay", 0.0),
            "affordability_status": decision.get("affordability_status", "not_affordable"),
            "recommended_payment_method": decision.get("recommended_payment_method", "not_recommended"),
            "recommended_payment_plan": decision.get("payment_plan", "none"),
            "earliest_date_for_full_payment": decision.get("earliest_date_for_full_payment", ""),
            "spending_changes_needed": decision.get("spending_changes_needed", "none"),
            "decision_explanation": decision.get("decision_explanation", ""),
            "is_sandbox_mock": balance_data.get("is_mock", False),
        }

    # =========================================================================
    # TOOL 2: CREATE PAYPAL CHECKOUT (ORDERS v2 + PAY LATER)
    # =========================================================================

    def create_paypal_checkout(
        self,
        item_name: str,
        price: float,
        currency: str = "USD",
    ) -> Dict[str, Any]:
        """
        Tool: Create a PayPal Checkout order with Pay Later (Pay in 4) enabled.
        Returns the checkout approval URL for the user to finalize payment.
        """
        return self.paypal.create_order(
            amount=price,
            currency=currency,
            item_name=item_name,
            description=f"Purchase of {item_name} approved by PayPal Guardian Agent",
        )

    # =========================================================================
    # TOOL 3: GENERATE PAYPAL BILL / INVOICE (INVOICING v2)
    # =========================================================================

    def generate_paypal_bill(
        self,
        recipient_email: str,
        amount: float,
        description: str,
        currency: str = "USD",
        note: str = "Issued by PayPal Guardian AI Agent",
    ) -> Dict[str, Any]:
        """
        Tool: Issue and dispatch a professional PayPal v2 invoice.
        Sends email and returns payment link.
        """
        return self.paypal.create_and_send_invoice(
            recipient_email=recipient_email,
            amount=amount,
            description=description,
            currency=currency,
            note=note,
        )

    # =========================================================================
    # TOOL 4: ACCOUNT SUMMARY & RECURRING SPEND DIAGNOSTIC
    # =========================================================================

    def get_paypal_account_summary(self, currency: str = "USD") -> Dict[str, Any]:
        """
        Tool: Inspect live PayPal account financial health, balances,
        and recurring commitments (subscriptions, rent, salary cycles).
        """
        balances = self.paypal.get_balances(currency_code=currency)
        transactions = self.paypal.get_transactions()
        context = PayPalContextAdapter.create_user_financial_context(
            item_name="Status Check",
            price=0.0,
            balance_data=balances,
            transactions=transactions,
            minimum_balance=self.default_minimum_balance,
        )
        reconciled = FinancialReconciler.reconcile(context)

        recurring = [
            {
                "description": e.description,
                "amount": e.amount_home,
                "direction": e.direction,
                "category": e.category,
                "flexibility": "stoppable" if e.is_stoppable else ("reducible" if e.is_reducible else "fixed"),
            }
            for e in reconciled
            if e.is_recurring
        ]

        return {
            "currency": balances.get("currency", currency),
            "available_balance": balances.get("available_balance", 0.0),
            "total_balance": balances.get("total_balance", 0.0),
            "minimum_safety_reserve": self.default_minimum_balance,
            "discretionary_buffer": max(0.0, balances.get("available_balance", 0.0) - self.default_minimum_balance),
            "recurring_commitments": recurring,
            "total_transactions_analyzed": len(transactions),
            "is_mock": balances.get("is_mock", False),
        }

    # =========================================================================
    # NATURAL LANGUAGE QUERY HANDLER (GEMINI / FALLBACK LOGIC)
    # =========================================================================

    def ask(self, query: str) -> str:
        """
        Process natural language queries:
        Uses Google Gemini (or rule-based intent parsing if GEMINI_API_KEY is not set)
        to map natural language into tool calls and deliver a friendly response.
        """
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_key and "your_" not in gemini_key.lower():
            return self._ask_gemini(query)
        return self._ask_heuristic(query)

    def _ask_gemini(self, query: str) -> str:
        """Execute query using Google Gemini with function calling."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            model = genai.GenerativeModel("gemini-1.5-flash")

            system_instruction = (
                "You are PayPal Guardian, an autonomous AI financial advisor. "
                "You protect users from overspending by evaluating purchases against their PayPal account, "
                "recommending PayPal Pay in 4 or waiting if a full payment breaches their minimum safety balance."
            )

            # Extract any purchase intent or question
            summary = self.get_paypal_account_summary()
            prompt = (
                f"{system_instruction}\n\n"
                f"Current Account State: Balance: ${summary['available_balance']} {summary['currency']}, "
                f"Safety Buffer: ${summary['minimum_safety_reserve']}\n"
                f"Recurring commitments: {json.dumps(summary['recurring_commitments'])}\n\n"
                f"User Question: {query}\n"
                f"If the user asks to evaluate a purchase, explain the recommendation clearly."
            )
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.warning("Gemini invocation failed (%s); using native agent engine.", e)
            return self._ask_heuristic(query)

    def _ask_heuristic(self, query: str) -> str:
        """Fast offline rule-based router if no LLM key is configured."""
        q = query.lower()

        # Check for bill / invoice request
        if "invoice" in q or "bill" in q or "charge" in q:
            # Parse simple invoice intent: e.g. "invoice user@example.com $100 for web design"
            import re
            email_match = re.search(r'[\w\.-]+@[\w\.-]+', query)
            amt_match = re.search(r'\$?(\d+(\.\d+)?)', query)
            recipient = email_match.group(0) if email_match else "client@example.com"
            amount = float(amt_match.group(1)) if amt_match else 150.0
            res = self.generate_paypal_bill(recipient_email=recipient, amount=amount, description="Consulting Services")
            return (
                f"🧾 **PayPal Invoice Generated**\n\n"
                f"- **Invoice #:** `{res['invoice_number']}`\n"
                f"- **Recipient:** {res['recipient']}\n"
                f"- **Amount:** ${res['amount']:.2f}\n"
                f"- **Status:** {res['status']}\n"
                f"- **Payment Link:** [Pay Invoice Online]({res['payment_url']})\n"
            )

        # Check for balance / account summary request
        if any(w in q for w in ("balance", "status", "how much do i have", "account")):
            summary = self.get_paypal_account_summary()
            return (
                f"💳 **PayPal Account Health Summary**\n\n"
                f"- **Available Balance:** ${summary['available_balance']:.2f} {summary['currency']}\n"
                f"- **Minimum Safety Reserve:** ${summary['minimum_safety_reserve']:.2f}\n"
                f"- **Safe Discretionary Spending:** ${summary['discretionary_buffer']:.2f}\n"
                f"- **Active Recurring Commitments:** {len(summary['recurring_commitments'])}\n"
            )

        # Default to purchase evaluation
        import re
        amt_match = re.search(r'\$?(\d+(\.\d+)?)', query)
        price = float(amt_match.group(1)) if amt_match else 750.0
        item = "Requested Item"
        for word in ("laptop", "camera", "shoes", "phone", "tv", "course", "watch", "headphones"):
            if word in q:
                item = word.title()
                break

        res = self.evaluate_purchase(item_name=item, price=price)
        status_badges = {
            "affordable_now": "✅ **Affordable Now** (Safe to pay in full today)",
            "affordable_with_plan": "⚡ **Affordable with Plan** (Recommended: PayPal Pay Later / Pay in 4)",
            "affordable_later": "⏳ **Affordable Later** (Wait until upcoming paycheck)",
            "not_affordable": "❌ **Not Recommended** (Breaches safety balance)",
        }

        checkout = self.create_paypal_checkout(item_name=item, price=price)
        approval_link = checkout.get("approval_url") or "#"

        output = [
            f"### 🛡️ PayPal Guardian: Purchase Evaluation for {item}",
            f"- **Requested Cost:** ${price:.2f}",
            f"- **Current Balance:** ${res['current_available_balance']:.2f}",
            f"- **Safety Buffer:** ${res['minimum_safety_buffer']:.2f}",
            f"- **Status:** {status_badges.get(res['affordability_status'], res['affordability_status'])}",
            f"\n**Decision Analysis:**",
            f"> {res['decision_explanation']}",
        ]

        if res["affordability_status"] in ("affordable_now", "affordable_with_plan"):
            output.append(f"\n🛒 [**Proceed with PayPal Checkout / Pay in 4**]({approval_link})")
        elif res["earliest_date_for_full_payment"]:
            output.append(f"\n📅 **Earliest Safe Full Payment Date:** `{res['earliest_date_for_full_payment']}`")

        return "\n".join(output)

