"""
Test Suite for Phase 5: Payment Plan Selection & 6-Tier Tie-Breaker Engine.
Verifies CandidatePlan data model, 5 candidate evaluators, 4 critical financial invariants,
the deterministic 6-tier tie-breaker ranking, decision explanations, and output formatting.
"""

import datetime
from pathlib import Path
import sys
import pytest

# Add code/ to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "code"))

from data_loader import FinancialDataLoader
from models import EvaluationRequest, FinancialProfile, PaymentOption, UserFinancialContext
from plan_selector import (
    CandidatePlan,
    PlanSelector,
    format_amount,
    format_output_number,
)
from reconciler import FinancialReconciler, ReconciledEvent


@pytest.fixture(scope="module")
def data_loader():
    """Shared FinancialDataLoader fixture."""
    return FinancialDataLoader("dataset")


class TestCandidatePlanModel:
    """Test the CandidatePlan dataclass and field invariants."""

    def test_candidate_plan_fields(self):
        plan = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="2026-09-07:300|2026-10-07:300",
            spending_changes_needed="none",
            first_payment_date="2026-09-07",
            completion_date="2026-10-07",
            total_payable_amount=600.0,
            number_of_payments=2,
            payment_option_id="opt_01",
        )
        assert plan.recommended_payment_method == "installments"
        assert plan.affordability_status == "affordable_with_plan"
        assert plan.payment_plan == "2026-09-07:300|2026-10-07:300"
        assert plan.spending_changes_needed == "none"
        assert plan.first_payment_date == "2026-09-07"
        assert plan.completion_date == "2026-10-07"
        assert plan.total_payable_amount == 600.0
        assert plan.number_of_payments == 2
        assert plan.payment_option_id == "opt_01"

    def test_candidate_plan_defaults(self):
        plan = CandidatePlan(
            recommended_payment_method="full_payment",
            affordability_status="affordable_now",
            payment_plan="2026-01-01:100",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-01-01",
            total_payable_amount=100.0,
            number_of_payments=1,
        )
        assert plan.payment_option_id == ""


class TestCandidateEvaluators:
    """Test candidate evaluator logic and invariants."""

    def _make_context(
        self,
        payment_methods=None,
        allows_partial=True,
        max_installment_months=None,
        current_balance=1000.0,
        minimum_balance=200.0,
        requested_amount=300.0,
        request_date="2026-01-01",
        desired_completion_date="2026-02-15",
    ):
        profile = FinancialProfile(
            user_id="u_test",
            home_currency="USD",
            current_available_balance=current_balance,
            minimum_balance_to_keep=minimum_balance,
            financial_priorities=[],
            expense_categories_to_protect=[],
            expense_categories_user_is_willing_to_reduce=[],
            expense_categories_user_is_willing_to_stop=[],
            payment_methods_user_will_consider=payment_methods or ["full_payment", "partial_payment", "installments"],
            max_installment_months=max_installment_months,
        )
        request = EvaluationRequest(
            request_id="req_test",
            user_id="u_test",
            request_date=request_date,
            request_type="purchase",
            requested_amount=requested_amount,
            desired_completion_date=desired_completion_date,
            allows_partial_payment=allows_partial,
            request_text="Can I afford this?",
        )
        return UserFinancialContext(
            request=request,
            profile=profile,
            events=[],
            payment_options=[],
            messages=[],
            images=[],
        )

    def test_full_payment_disqualified_when_not_in_preferences(self):
        ctx = self._make_context(payment_methods=["installments"])
        plans = PlanSelector._evaluate_full_payment(ctx, [], 300.0)
        assert len(plans) == 0

    def test_full_payment_affordable_now(self):
        ctx = self._make_context(payment_methods=["full_payment"], current_balance=1000.0, minimum_balance=200.0, requested_amount=300.0)
        plans = PlanSelector._evaluate_full_payment(ctx, [], 300.0)
        assert len(plans) == 1
        p = plans[0]
        assert p.recommended_payment_method == "full_payment"
        assert p.affordability_status == "affordable_now"
        assert p.spending_changes_needed == "none"
        assert p.payment_plan == "2026-01-01:300"
        assert p.number_of_payments == 1
        assert p.total_payable_amount == 300.0

    def test_installments_max_duration_filter(self):
        ctx = self._make_context(
            payment_methods=["installments"],
            max_installment_months=2.0,  # Max 2 months
        )
        # Option with 6 payments x 30 days = 5 * 30 / 30 = 5 months > 2 months
        opt_too_long = PaymentOption(
            payment_option_id="opt_long",
            request_id="req_test",
            payment_method="installments",
            payment_amount=50.0,
            number_of_payments=6,
            first_payment_date="2026-01-01",
            payment_frequency_days=30,
            total_payable_amount=300.0,
        )
        # Option with 2 payments x 30 days = 1 * 30 / 30 = 1 month <= 2 months
        opt_ok = PaymentOption(
            payment_option_id="opt_ok",
            request_id="req_test",
            payment_method="installments",
            payment_amount=150.0,
            number_of_payments=2,
            first_payment_date="2026-01-01",
            payment_frequency_days=30,
            total_payable_amount=300.0,
        )
        ctx.payment_options = [opt_too_long, opt_ok]

        plans = PlanSelector._evaluate_installments(ctx, [])
        assert len(plans) == 1
        assert plans[0].payment_option_id == "opt_ok"
        assert plans[0].affordability_status == "affordable_with_plan"
        assert plans[0].payment_plan == "2026-01-01:150|2026-01-31:150"

    def test_partial_payment_all_5_conditions(self):
        # Condition 1: allows_partial_payment is False -> None
        ctx1 = self._make_context(allows_partial=False)
        assert PlanSelector._evaluate_partial_payment(ctx1, 100.0, "2026-01-15") is None

        # Condition 2: 'partial_payment' not in considered -> None
        ctx2 = self._make_context(payment_methods=["full_payment", "installments"])
        assert PlanSelector._evaluate_partial_payment(ctx2, 100.0, "2026-01-15") is None

        # Condition 3: amount_safe == 0.0 or == requested_amount -> None
        ctx3 = self._make_context()
        assert PlanSelector._evaluate_partial_payment(ctx3, 0.0, "2026-01-15") is None
        assert PlanSelector._evaluate_partial_payment(ctx3, 300.0, "2026-01-15") is None

        # Condition 4: earliest is None -> None
        assert PlanSelector._evaluate_partial_payment(ctx3, 100.0, None) is None

        # Condition 5: earliest > desired_completion_date -> None
        assert PlanSelector._evaluate_partial_payment(ctx3, 100.0, "2026-03-01") is None

        # All 5 satisfied -> valid CandidatePlan
        plan = PlanSelector._evaluate_partial_payment(ctx3, 100.0, "2026-01-15")
        assert plan is not None
        assert plan.recommended_payment_method == "partial_payment"
        assert plan.affordability_status == "affordable_with_plan"
        assert plan.payment_plan == "2026-01-01:100|2026-01-15:200"
        assert plan.spending_changes_needed == "none"
        assert plan.number_of_payments == 2
        assert plan.total_payable_amount == 300.0
        assert plan.completion_date == "2026-01-15"

    def test_wait_conditions(self):
        ctx = self._make_context(payment_methods=["full_payment"])
        # earliest is None -> None
        assert PlanSelector._evaluate_wait(ctx, None) is None

        # earliest <= request_date -> None (safe now, not wait)
        assert PlanSelector._evaluate_wait(ctx, "2026-01-01") is None

        # 'full_payment' not considered -> None
        ctx_no_full = self._make_context(payment_methods=["installments"])
        assert PlanSelector._evaluate_wait(ctx_no_full, "2026-02-01") is None

        # Valid wait
        plan = PlanSelector._evaluate_wait(ctx, "2026-02-01")
        assert plan is not None
        assert plan.recommended_payment_method == "wait"
        assert plan.affordability_status == "affordable_later"
        assert plan.spending_changes_needed == "none"
        assert plan.payment_plan == "2026-02-01:300"
        assert plan.first_payment_date == "2026-02-01"
        assert plan.completion_date == "2026-02-01"
        assert plan.number_of_payments == 1

    def test_not_recommended_fallback(self):
        plan = PlanSelector._make_not_recommended_plan()
        assert plan.recommended_payment_method == "not_recommended"
        assert plan.affordability_status == "not_affordable"
        assert plan.payment_plan == "none"
        assert plan.spending_changes_needed == "none"
        assert plan.total_payable_amount == float("inf")
        assert plan.number_of_payments == 0


class TestSixTierTieBreaker:
    """Test the deterministic 6-tier tie-breaker ranking."""

    def test_tier_1_on_time_preferred(self):
        desired = "2026-02-01"
        p_on_time = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-01-20",  # On-time
            total_payable_amount=500.0,
            number_of_payments=3,
        )
        p_late = CandidatePlan(
            recommended_payment_method="wait",
            affordability_status="affordable_later",
            payment_plan="plan2",
            spending_changes_needed="none",
            first_payment_date="2026-02-10",
            completion_date="2026-02-10",  # Late
            total_payable_amount=400.0,    # Lower cost, but late
            number_of_payments=1,
        )
        winner = PlanSelector._rank_candidates([p_late, p_on_time], desired)
        assert winner == p_on_time

    def test_tier_2_no_spending_changes_preferred(self):
        desired = "2026-02-01"
        p_no_changes = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-01-15",
            total_payable_amount=550.0,
            number_of_payments=3,
        )
        p_with_changes = CandidatePlan(
            recommended_payment_method="full_payment",
            affordability_status="affordable_with_plan",
            payment_plan="plan2",
            spending_changes_needed="stop:event_1",
            first_payment_date="2026-01-01",
            completion_date="2026-01-01",
            total_payable_amount=500.0,  # Cheaper, but requires spending changes
            number_of_payments=1,
        )
        winner = PlanSelector._rank_candidates([p_with_changes, p_no_changes], desired)
        assert winner == p_no_changes

    def test_tier_3_min_total_cash_outlay(self):
        desired = "2026-02-01"
        p_cheaper = CandidatePlan(
            recommended_payment_method="full_payment",
            affordability_status="affordable_now",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-01-01",
            total_payable_amount=500.0,
            number_of_payments=1,
        )
        p_pricier = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan2",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-01-01",
            total_payable_amount=550.0,  # Financing fee
            number_of_payments=1,
        )
        winner = PlanSelector._rank_candidates([p_pricier, p_cheaper], desired)
        assert winner == p_cheaper

    def test_tier_4_earliest_start_date(self):
        desired = "2026-03-01"
        p_earlier = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-05",  # Earlier start
            completion_date="2026-02-15",
            total_payable_amount=500.0,
            number_of_payments=2,
            payment_option_id="opt_b",
        )
        p_later = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan2",
            spending_changes_needed="none",
            first_payment_date="2026-01-10",  # Later start
            completion_date="2026-02-15",
            total_payable_amount=500.0,
            number_of_payments=2,
            payment_option_id="opt_a",
        )
        winner = PlanSelector._rank_candidates([p_later, p_earlier], desired)
        assert winner == p_earlier

    def test_tier_5_fewest_payments(self):
        desired = "2026-03-01"
        p_fewer = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-02-01",
            total_payable_amount=500.0,
            number_of_payments=2,  # Fewer payments
            payment_option_id="opt_b",
        )
        p_more = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan2",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-02-01",
            total_payable_amount=500.0,
            number_of_payments=4,  # More payments
            payment_option_id="opt_a",
        )
        winner = PlanSelector._rank_candidates([p_more, p_fewer], desired)
        assert winner == p_fewer

    def test_tier_6_lowest_option_id(self):
        desired = "2026-03-01"
        p_opt1 = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan1",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-02-01",
            total_payable_amount=500.0,
            number_of_payments=3,
            payment_option_id="payment_option_01",
        )
        p_opt2 = CandidatePlan(
            recommended_payment_method="installments",
            affordability_status="affordable_with_plan",
            payment_plan="plan2",
            spending_changes_needed="none",
            first_payment_date="2026-01-01",
            completion_date="2026-02-01",
            total_payable_amount=500.0,
            number_of_payments=3,
            payment_option_id="payment_option_02",
        )
        winner = PlanSelector._rank_candidates([p_opt2, p_opt1], desired)
        assert winner == p_opt1


class TestFormattingUtilities:
    """Test amount and output number formatting."""

    def test_format_amount(self):
        assert format_amount(25256.0) == "25256"
        assert format_amount(25256) == "25256"
        assert format_amount(620.4) == "620.40"
        assert format_amount(15952906.67) == "15952906.67"

    def test_format_output_number(self):
        assert format_output_number(25256.0) == "25256"
        assert format_output_number(17229139.2) == "17229139.2"
        assert format_output_number(603.3) == "603.3"
        assert format_output_number(0.0) == "0"


class TestPipelineExecution:
    """Test full pipeline integration on sample and evaluation requests."""

    def test_sample_requests_structure_and_types(self, data_loader):
        sample_ids = data_loader.get_sample_request_ids()
        assert len(sample_ids) == 25

        valid_statuses = {"affordable_now", "affordable_with_plan", "affordable_later", "not_affordable"}
        valid_methods = {"full_payment", "installments", "partial_payment", "wait", "not_recommended"}

        for req_id in sample_ids:
            ctx = data_loader.get_context(req_id)
            rec = FinancialReconciler.reconcile(ctx, data_loader.currency_graph)
            res = PlanSelector.select_plan(ctx, rec)

            # Check all required keys present
            assert "request_id" in res
            assert "amount_safe_to_pay" in res
            assert "affordability_status" in res
            assert "recommended_payment_method" in res
            assert "payment_plan" in res
            assert "earliest_date_for_full_payment" in res
            assert "spending_changes_needed" in res
            assert "decision_explanation" in res

            # Check values valid
            assert res["affordability_status"] in valid_statuses
            assert res["recommended_payment_method"] in valid_methods
            assert 0.0 <= res["amount_safe_to_pay"] <= ctx.request.requested_amount + 0.01
            assert len(res["decision_explanation"]) > 0

            # If affordable_now, earliest must equal request_date
            if res["affordability_status"] == "affordable_now":
                assert res["earliest_date_for_full_payment"] == ctx.request.request_date
                assert res["recommended_payment_method"] == "full_payment"
                assert res["spending_changes_needed"] == "none"

            # If not_recommended, payment_plan must be "none"
            if res["recommended_payment_method"] == "not_recommended":
                assert res["payment_plan"] == "none"
                assert res["affordability_status"] == "not_affordable"
