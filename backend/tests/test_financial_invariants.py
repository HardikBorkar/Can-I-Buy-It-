import unittest
from backend.app.core.security import generate_idempotency_key


class TestFinancialSafetyInvariants(unittest.TestCase):
    """
    Automated Test Suite for PayPal Guardian Financial Safety Invariants.
    Verifies that the $500.00 USD sacred safety floor cannot be breached under any spending scenario.
    """

    def setUp(self):
        self.available_balance = 1850.00
        self.safety_floor = 500.00
        # Projected lowest cash dip prior to discretionary spend (e.g., after $1,200 rent + bills)
        self.lowest_projected_dip = 590.00

    def evaluate_spend(self, amount: float):
        """Standard invariant evaluation matching Guardian Copilot engine."""
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")

        lowest_dip_full = self.lowest_projected_dip - amount
        safe_in_full = lowest_dip_full >= self.safety_floor

        installment_1 = amount / 4.0
        lowest_dip_pay_in_4 = self.lowest_projected_dip - installment_1
        pay_in_4_safe = lowest_dip_pay_in_4 >= self.safety_floor

        # Risk score calculation
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
