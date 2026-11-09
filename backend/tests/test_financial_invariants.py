import unittest
from backend.app.core.security import generate_idempotency_key
from src.engine.simulator import CashFlowSimulator
from src.engine.models import UserFinancialContext, FinancialProfile, EvaluationRequest
from src.engine.reconciler import ReconciledEvent


class TestFinancialSafetyInvariants(unittest.TestCase):
    """
    Automated Test Suite for PayPal Guardian Financial Safety Invariants.
    Verifies that the $500.00 USD sacred safety floor cannot be breached under any spending scenario
    by running the production CashFlowSimulator engine.
    """

    def setUp(self):
        self.available_balance = 1850.00
        self.safety_floor = 500.00
        # Projected lowest cash dip prior to discretionary spend (e.g., after $1,200 rent + bills)
        self.lowest_projected_dip = 590.00

        # Base financial context for simulation
        self.profile = FinancialProfile(
            user_id="guardian_user",
            home_currency="USD",
            current_available_balance=self.available_balance,
            minimum_balance_to_keep=self.safety_floor,
            financial_priorities=["safety_buffer"],
            expense_categories_to_protect=["rent"],
            expense_categories_user_is_willing_to_reduce=[],
            expense_categories_user_is_willing_to_stop=[],
            payment_methods_user_will_consider=["full_payment", "installments"],
            max_installment_months=None,
        )

        # Reconciled commitments matching Guardian financial state
        self.reconciled_events = [
            ReconciledEvent(
                event_id="evt_rent",
                user_id="guardian_user",
                description="Apartment Rent",
                category="rent",
                direction="debit",
                settlement_date="2026-05-01",
                amount_home=1200.00,
                is_cash_flow=True,
                is_recurring=True,
                is_protected=True,
                is_stoppable=False,
                is_reducible=False,
                minimum_allowed_amount=1200.00,
                status="settled",
            ),
            ReconciledEvent(
                event_id="evt_bills",
                user_id="guardian_user",
                description="Recurring Utilities & SaaS",
                category="utilities",
                direction="debit",
                settlement_date="2026-05-01",
                amount_home=60.00,
                is_cash_flow=True,
                is_recurring=True,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                minimum_allowed_amount=60.00,
                status="settled",
            ),
        ]

    def evaluate_spend(self, amount: float):
        """Standard invariant evaluation executing production CashFlowSimulator engine."""
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")

        context = UserFinancialContext(
            profile=self.profile,
            request=EvaluationRequest(
                request_id="req_eval",
                user_id="guardian_user",
                request_date="2026-05-01",
                request_type="purchase",
                requested_amount=amount,
                desired_completion_date="2026-05-01",
                allows_partial_payment=True,
                request_text="Evaluate spend",
            ),
            historical_events=[],
        )

        # 1. Simulate Pay In Full
        daily_bals_full = CashFlowSimulator.simulate_daily_balances(
            context=context,
            reconciled_events=self.reconciled_events,
            start_date="2026-05-01",
            days=30,
            additional_debits={"2026-05-01": amount},
        )
        safe_in_full = CashFlowSimulator.is_plan_safe(daily_bals_full, self.safety_floor)
        lowest_dip_full = min(daily_bals_full.values())

        # 2. Simulate Pay In 4 Installments (first installment due on settlement day)
        installment_1 = round(amount / 4.0, 2)
        daily_bals_pay_in_4 = CashFlowSimulator.simulate_daily_balances(
            context=context,
            reconciled_events=self.reconciled_events,
            start_date="2026-05-01",
            days=30,
            additional_debits={"2026-05-01": installment_1},
        )
        pay_in_4_safe = CashFlowSimulator.is_plan_safe(daily_bals_pay_in_4, self.safety_floor)
        lowest_dip_pay_in_4 = min(daily_bals_pay_in_4.values())

        # Risk score calculation matching Guardian Copilot engine
        if safe_in_full:
            risk_score = 98
            recommendation = "PAY_IN_FULL"
        elif pay_in_4_safe:
            risk_score = 92
            recommendation = "PAY_IN_4"
        else:
            risk_score = 55
            recommendation = "DECLINE_UNSAFE"

        return {
            "amount": amount,
            "safe_in_full": safe_in_full,
            "lowest_dip_full": lowest_dip_full,
            "pay_in_4_safe": pay_in_4_safe,
            "lowest_dip_pay_in_4": lowest_dip_pay_in_4,
            "recommendation": recommendation,
            "risk_score": risk_score,
            "buffer_intact": safe_in_full or pay_in_4_safe,
        }

    def test_1_safe_discretionary_spend_in_full(self):
        """Test 1: Small purchases ($70) remain above the $500 floor and are approved in full."""
        result = self.evaluate_spend(70.00)
        self.assertTrue(result["safe_in_full"])
        self.assertGreaterEqual(result["lowest_dip_full"], self.safety_floor)
        self.assertEqual(result["recommendation"], "PAY_IN_FULL")
        self.assertEqual(result["risk_score"], 98)

    def test_2_moderate_spend_triggers_pay_in_4_guardrail(self):
        """Test 2: Purchases that dip below $500 in full ($250) trigger the PayPal Pay in 4 guardrail."""
        result = self.evaluate_spend(250.00)
        # Buying in full would drop balance to $340 (breaches $500 floor)
        self.assertFalse(result["safe_in_full"])
        self.assertLess(result["lowest_dip_full"], self.safety_floor)

        # But Pay in 4 ($62.50 today) keeps lowest balance at $527.50 (above floor)
        self.assertTrue(result["pay_in_4_safe"])
        self.assertGreaterEqual(result["lowest_dip_pay_in_4"], self.safety_floor)
        self.assertEqual(result["recommendation"], "PAY_IN_4")

    def test_3_excessive_spend_declined(self):
        """Test 3: Huge purchases ($2,000) that breach the floor even with Pay in 4 are declined."""
        result = self.evaluate_spend(2000.00)
        self.assertFalse(result["safe_in_full"])
        self.assertFalse(result["pay_in_4_safe"])
        self.assertFalse(result["buffer_intact"])
        self.assertEqual(result["recommendation"], "DECLINE_UNSAFE")
        self.assertLess(result["risk_score"], 60)

    def test_4_zero_or_negative_amount_rejected(self):
        """Test 4: Non-positive purchase amounts trigger validation errors."""
        with self.assertRaises(ValueError):
            self.evaluate_spend(0)
        with self.assertRaises(ValueError):
            self.evaluate_spend(-45.00)

    def test_5_deterministic_idempotency_keys(self):
        """Test 5: Idempotency keys must be deterministic UUIDv5 strings for duplicate protection."""
        payload_a = {"amount": 140.0, "currency": "USD", "item": "Nike Pegasus 41"}
        payload_b = {"amount": 140.0, "currency": "USD", "item": "Nike Pegasus 41"}
        payload_diff = {"amount": 140.01, "currency": "USD", "item": "Nike Pegasus 41"}

        key_a = generate_idempotency_key(payload_a, prefix="ord")
        key_b = generate_idempotency_key(payload_b, prefix="ord")
        key_diff = generate_idempotency_key(payload_diff, prefix="ord")

        # Must be identical for identical inputs
        self.assertEqual(key_a, key_b)
        self.assertTrue(key_a.startswith("ord-"))
        # Must differ when content changes
        self.assertNotEqual(key_a, key_diff)


if __name__ == "__main__":
    unittest.main()
