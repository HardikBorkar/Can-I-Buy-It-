"""
Data Adapter for PayPal Guardian.
Bridges raw PayPal Sandbox API responses (balances, transaction histories)
into the deterministic 'Buy or Wait?' 90-day simulation schemas:
- FinancialProfile
- FinancialEvent
- PaymentOption (Full payment vs. PayPal Pay in 4)
- UserFinancialContext
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
import re
from typing import Any, Dict, List, Optional

from src.engine.models import (
    EvaluationRequest,
    FinancialEvent,
    FinancialProfile,
    PaymentOption,
    UserFinancialContext,
)
from src.engine.reconciler import ReconciledEvent

logger = logging.getLogger("paypal_guardian.adapter")


class PayPalContextAdapter:
    """
    Transforms live PayPal account state and item checkout requests
    into rich relational contexts for 90-day rolling cash flow forecasting.
    """

    DEFAULT_MINIMUM_BALANCE = 500.00  # Default user safety buffer

    @classmethod
    def build_financial_profile(
        cls,
        balance_data: Dict[str, Any],
        user_id: str = "paypal_user_1",
        minimum_balance: Optional[float] = None,
        home_currency: str = "USD",
    ) -> FinancialProfile:
        """Construct a FinancialProfile model from PayPal balance data."""
        avail = float(balance_data.get("available_balance", 0.0))
        currency = balance_data.get("currency", home_currency)
        min_balance = minimum_balance if minimum_balance is not None else cls.DEFAULT_MINIMUM_BALANCE

        return FinancialProfile(
            user_id=user_id,
            home_currency=currency,
            current_available_balance=avail,
            minimum_balance_to_keep=min_balance,
            financial_priorities=["essential_living", "emergency_savings", "debt_avoidance"],
            expense_categories_to_protect=["housing", "utilities", "groceries", "healthcare"],
            expense_categories_user_is_willing_to_reduce=["dining", "shopping", "leisure"],
            expense_categories_user_is_willing_to_stop=["subscriptions", "entertainment"],
            payment_methods_user_will_consider=["full_payment", "installments"],
            max_installment_months=6,
        )

    @classmethod
    def build_financial_events(
        cls,
        raw_transactions: List[Dict[str, Any]],
        user_id: str = "paypal_user_1",
        home_currency: str = "USD",
    ) -> List[FinancialEvent]:
        """Convert raw PayPal transaction records into FinancialEvent models."""
        events: List[FinancialEvent] = []

        for idx, item in enumerate(raw_transactions):
            tx_info = item.get("transaction_info", {})
            payer_info = item.get("payer_info", {})

            tx_id = tx_info.get("transaction_id", f"tx_{idx}")
            init_date_str = tx_info.get("transaction_initiation_date", "")
            amt_obj = tx_info.get("transaction_amount", {})

            try:
                amt_val = float(amt_obj.get("value", "0.0"))
            except (ValueError, TypeError):
                amt_val = 0.0

            currency = amt_obj.get("currency_code", home_currency)
            subject = (tx_info.get("transaction_subject") or "").strip()
            payer_name = payer_info.get("payer_name", {}).get("alternate_full_name", "")
            description = subject or payer_name or "PayPal Transaction"

            # Parse date YYYY-MM-DD
            event_date = init_date_str[:10] if len(init_date_str) >= 10 else datetime.now().strftime("%Y-%m-%d")

            # Determine direction & categorization
            if amt_val >= 0:
                direction = "credit"
                amount = amt_val
                # Check for salary/payroll indicators
                desc_lower = description.lower()
                if any(w in desc_lower for w in ("salary", "payroll", "deposit", "employer", "wage")):
                    category = "salary"
                    event_type = "salary"
                else:
                    category = "income"
                    event_type = "incoming_transfer"
                flexibility = "fixed"
            else:
                direction = "debit"
                amount = abs(amt_val)
                desc_lower = description.lower()
                if any(w in desc_lower for w in ("rent", "lease", "apartment", "mortgage")):
                    category = "housing"
                    flexibility = "fixed"
                    event_type = "recurring_expense"
                elif any(w in desc_lower for w in ("sub", "subscription", "stream", "netflix", "spotify", "cloud")):
                    category = "subscriptions"
                    flexibility = "stoppable"
                    event_type = "recurring_expense"
                elif any(w in desc_lower for w in ("market", "grocery", "food", "supermarket")):
                    category = "groceries"
                    flexibility = "reducible"
                    event_type = "essential_expense"
                elif any(w in desc_lower for w in ("dining", "cafe", "restaurant", "uber eats")):
                    category = "dining"
                    flexibility = "reducible_or_stoppable"
                    event_type = "discretionary_expense"
                else:
                    category = "general_merchandise"
                    flexibility = "reducible"
                    event_type = "expense"

            status_raw = tx_info.get("transaction_status", "S")
            status = "settled" if status_raw in ("S", "COMPLETED") else "pending"

            events.append(
                FinancialEvent(
                    event_id=tx_id,
                    user_id=user_id,
                    event_type=event_type,
                    description=description,
                    category=category,
                    direction=direction,
                    amount=amount,
                    currency=currency,
                    event_date=event_date,
                    settlement_date=event_date,
                    status=status,
                    flexibility=flexibility,
                    minimum_allowed_amount=round(amount * 0.5, 2) if flexibility in ("reducible", "reducible_or_stoppable") else None,
                    normalized_amount=amount,
                    exchange_rate_applied=1.0,
                    conversion_path=[currency, home_currency],
                )
            )

        return events

    @classmethod
    def generate_paypal_payment_options(
        cls,
        request_id: str,
        requested_amount: float,
        request_date: str,
    ) -> List[PaymentOption]:
        """
        Generate candidate payment options for the target expense:
        1. Full Payment today.
        2. PayPal 'Pay in 4' (4 equal bi-weekly payments of amount/4, 0% fee).
        3. 3-Month Monthly Installment plan (equal monthly payments).
        """
        options: List[PaymentOption] = []

        # Option 1: Pay in Full
        options.append(
            PaymentOption(
                payment_option_id=f"{request_id}_full",
                request_id=request_id,
                payment_method="full_payment",
                payment_amount=round(requested_amount, 2),
                number_of_payments=1,
                first_payment_date=request_date,
                payment_frequency_days=0,
                financing_fee=0.0,
                total_payable_amount=round(requested_amount, 2),
            )
        )

        # Option 2: PayPal Pay in 4 (Bi-weekly, 4 payments, zero financing fee)
        pay_in_4_installment = round(requested_amount / 4.0, 2)
        options.append(
            PaymentOption(
                payment_option_id=f"{request_id}_pay_in_4",
                request_id=request_id,
                payment_method="installments",
                payment_amount=pay_in_4_installment,
                number_of_payments=4,
                first_payment_date=request_date,
                payment_frequency_days=14,  # Bi-weekly (every 14 days)
                financing_fee=0.0,
                total_payable_amount=round(pay_in_4_installment * 4, 2),
            )
        )

        # Option 3: 3-Month Installment
        three_mo_installment = round(requested_amount / 3.0, 2)
        options.append(
            PaymentOption(
                payment_option_id=f"{request_id}_monthly_3",
                request_id=request_id,
                payment_method="installments",
                payment_amount=three_mo_installment,
                number_of_payments=3,
                first_payment_date=request_date,
                payment_frequency_days=30,  # Monthly (every 30 days)
                financing_fee=0.0,
                total_payable_amount=round(three_mo_installment * 3, 2),
            )
        )

        return options

    @classmethod
    def create_user_financial_context(
        cls,
        item_name: str,
        price: float,
        balance_data: Dict[str, Any],
        transactions: List[Dict[str, Any]],
        user_id: str = "paypal_user_1",
        minimum_balance: Optional[float] = None,
        request_date: Optional[str] = None,
    ) -> UserFinancialContext:
        """
        Assemble the full unified relational context bundle ready for PlanSelector.
        """
        req_date = request_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        deadline_date = (datetime.fromisoformat(req_date) + timedelta(days=90)).strftime("%Y-%m-%d")
        req_id = f"req_{int(datetime.now().timestamp())}"

        profile = cls.build_financial_profile(
            balance_data=balance_data,
            user_id=user_id,
            minimum_balance=minimum_balance,
        )

        events = cls.build_financial_events(
            raw_transactions=transactions,
            user_id=user_id,
            home_currency=profile.home_currency,
        )

        payment_options = cls.generate_paypal_payment_options(
            request_id=req_id,
            requested_amount=price,
            request_date=req_date,
        )

        req = EvaluationRequest(
            request_id=req_id,
            user_id=user_id,
            request_date=req_date,
            request_type="purchase_evaluation",
            requested_amount=price,
            desired_completion_date=deadline_date,
            allows_partial_payment=True,
            request_text=f"Evaluating purchase: {item_name} for ${price:.2f}",
        )

        return UserFinancialContext(
            request=req,
            profile=profile,
            events=events,
            payment_options=payment_options,
            messages=[],
            images=[],
        )

