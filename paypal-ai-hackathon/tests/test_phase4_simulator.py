"""
Test Suite for Phase 4: 90-Day Rolling Cash Flow Simulator and Spending Rescue Optimizer.
Verifies daily balance projection math, safety invariants, amount_safe_to_pay metrics,
earliest_date_for_full_payment calculation, spending rescue optimization,
sub-penny floating point invariance, and recurring event forward projection.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "code"))

import calendar
import datetime
from decimal import Decimal, ROUND_HALF_UP
import pytest

from data_loader import FinancialDataLoader
from models import EvaluationRequest, FinancialProfile, UserFinancialContext
from reconciler import FinancialReconciler, ReconciledEvent
from simulator import CashFlowSimulator


@pytest.fixture(scope="module")
def data_loader():
    """Shared FinancialDataLoader fixture."""
    return FinancialDataLoader("dataset")


class TestPhase4Simulator:
    """Test suite covering all requirements of Phase 4 simulator engine."""

    def test_daily_balance_projection_math(self):
        """
        Requirement 1: Synthetic ledger with exact Decimal balance tracking,
        credit-before-debit daily ordering, and exact closing balances.
        """
        # Create a synthetic 5-day scenario starting on 2026-01-01
        profile = FinancialProfile(
            user_id="synth_user",
            home_currency="USD",
            current_available_balance=1000.00,
            minimum_balance_to_keep=200.00,
            financial_priorities=[],
            expense_categories_to_protect=[],
            expense_categories_user_is_willing_to_reduce=[],
            expense_categories_user_is_willing_to_stop=[],
            payment_methods_user_will_consider=["full_payment"],
            max_installment_months=None,
        )
        request = EvaluationRequest(
            request_id="synth_req",
            user_id="synth_user",
            request_date="2026-01-01",
            request_type="purchase",
            requested_amount=300.00,
            desired_completion_date="2026-01-10",
            allows_partial_payment=True,
            request_text="Can I buy this?",
        )
        context = UserFinancialContext(
            request=request,
            profile=profile,
            events=[],
            payment_options=[],
            messages=[],
            images=[],
        )

        # Reconciled events with credits and debits on specific days
        events = [
            ReconciledEvent(
                event_id="e1",
                user_id="synth_user",
                description="Groceries",
                category="groceries",
                direction="debit",
                settlement_date="2026-01-02",
                amount_home=150.25,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
            ReconciledEvent(
                event_id="e2",
                user_id="synth_user",
                description="Salary",
                category="salary",
                direction="credit",
                settlement_date="2026-01-03",
                amount_home=500.00,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
            ReconciledEvent(
                event_id="e3",
                user_id="synth_user",
                description="Utilities",
                category="utilities",
                direction="debit",
                settlement_date="2026-01-03",
                amount_home=100.00,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
        ]

        bals = CashFlowSimulator.simulate_daily_balances(
            context=context,
            reconciled_events=events,
            start_date="2026-01-01",
            days=4,
        )

        # Expected balances:
        # 2026-01-01: 1000.00
        # 2026-01-02: 1000.00 - 150.25 = 849.75
        # 2026-01-03: 849.75 + 500.00 - 100.00 = 1249.75 (credit processed first)
        # 2026-01-04: 1249.75
        # 2026-01-05: 1249.75
        assert bals["2026-01-01"] == 1000.00
        assert bals["2026-01-02"] == 849.75
        assert bals["2026-01-03"] == 1249.75
        assert bals["2026-01-04"] == 1249.75
        assert bals["2026-01-05"] == 1249.75
        assert CashFlowSimulator.is_plan_safe(bals, 200.00) is True
        assert CashFlowSimulator.is_plan_safe(bals, 900.00) is False  # 849.75 < 900

    def test_amount_safe_to_pay_ground_truth_samples(self, data_loader):
        """
        Requirement 2: Verify amount_safe_to_pay against ground truth sample requests.
        Ensures invariant: 0.0 <= amount_safe_to_pay <= requested_amount.
        Validates affordable_now requests match requested_amount.
        """
        # Affordable now sample requests where user can safely pay full amount today
        affordable_now_samples = ["request_01", "request_09", "request_12", "request_16"]

        for req_id in affordable_now_samples:
            ctx = data_loader.get_context(req_id)
            rec = FinancialReconciler.reconcile(ctx, data_loader.currency_graph)
            safe_amt = CashFlowSimulator.calculate_amount_safe_to_pay(ctx, rec)

            assert 0.0 <= safe_amt <= ctx.request.requested_amount
            # For affordable_now requests, amount_safe_to_pay must equal requested_amount
            assert safe_amt == pytest.approx(ctx.request.requested_amount, abs=0.01)

        # Also verify boundary invariants for all 25 sample requests
        for req_id in data_loader.get_sample_request_ids():
            ctx = data_loader.get_context(req_id)
            rec = FinancialReconciler.reconcile(ctx, data_loader.currency_graph)
            safe_amt = CashFlowSimulator.calculate_amount_safe_to_pay(ctx, rec)
            assert 0.0 <= safe_amt <= ctx.request.requested_amount

    def test_earliest_date_for_full_payment_ground_truth_samples(self, data_loader):
        """
        Requirement 3: Verify earliest_date_for_full_payment.
        For affordable_now, earliest_date_for_full_payment == request_date.
        For others, if returned, it must be within [request_date, request_date + 90 days].
        """
        affordable_now_samples = ["request_01", "request_09", "request_12", "request_16"]

        for req_id in affordable_now_samples:
            ctx = data_loader.get_context(req_id)
            rec = FinancialReconciler.reconcile(ctx, data_loader.currency_graph)
            earliest = CashFlowSimulator.find_earliest_date_for_full_payment(ctx, rec)
            assert earliest == ctx.request.request_date

        for req_id in data_loader.get_sample_request_ids():
            ctx = data_loader.get_context(req_id)
            rec = FinancialReconciler.reconcile(ctx, data_loader.currency_graph)
            earliest = CashFlowSimulator.find_earliest_date_for_full_payment(ctx, rec)
            if earliest is not None:
                req_d = datetime.date.fromisoformat(ctx.request.request_date)
                earliest_d = datetime.date.fromisoformat(earliest)
                assert earliest_d >= req_d
                assert earliest_d <= req_d + datetime.timedelta(days=90)

    def test_spending_changes_needed_ground_truth_samples(self, data_loader):
        """
        Requirement 4: Verify spending rescue optimizer on sample requests needing changes:
        request_06: verifies stop:event_476 rescues a plan with a deficit.
        request_11: verifies spending change rescues a plan with a deficit.
        request_21: verifies spending changes rescue plan with mutual exclusivity.
        Enforces mutual exclusivity: no event is both stopped and reduced.
        """
        # 1. Test request_06: deficit of 10.0 EUR is rescued by stop:event_476 (+19.00 EUR)
        ctx_06 = data_loader.get_context("request_06")
        rec_06 = FinancialReconciler.reconcile(ctx_06, data_loader.currency_graph)
        bals_06 = CashFlowSimulator.simulate_daily_balances(ctx_06, rec_06)
        surplus_06 = min(bals_06.values()) - ctx_06.profile.minimum_balance_to_keep
        
        # When plan is already safe, returns "none"
        safe_plan_06 = {ctx_06.request.request_date: max(0.0, surplus_06 - 10.0)}
        assert CashFlowSimulator.find_spending_changes_needed(ctx_06, rec_06, safe_plan_06) == "none"

        # When plan has a small deficit, stop:event_476 rescues it
        breached_plan_06 = {ctx_06.request.request_date: surplus_06 + 10.0}
        changes_06 = CashFlowSimulator.find_spending_changes_needed(ctx_06, rec_06, breached_plan_06)
        assert changes_06 == "stop:event_476"

        # 2. Test request_11: deficit is rescued by available stoppable/reducible actions
        ctx_11 = data_loader.get_context("request_11")
        rec_11 = FinancialReconciler.reconcile(ctx_11, data_loader.currency_graph)
        bals_11 = CashFlowSimulator.simulate_daily_balances(ctx_11, rec_11)
        surplus_11 = min(bals_11.values()) - ctx_11.profile.minimum_balance_to_keep
        breached_plan_11 = {ctx_11.request.request_date: surplus_11 + 200000.0}
        changes_11 = CashFlowSimulator.find_spending_changes_needed(ctx_11, rec_11, breached_plan_11)
        assert changes_11 is not None
        assert changes_11 != "none"
        assert any(k in changes_11 for k in ["event_989", "event_949"])

        # 3. Test request_21: deficit is rescued with strict mutual exclusivity
        ctx_21 = data_loader.get_context("request_21")
        rec_21 = FinancialReconciler.reconcile(ctx_21, data_loader.currency_graph)
        bals_21 = CashFlowSimulator.simulate_daily_balances(ctx_21, rec_21)
        surplus_21 = min(bals_21.values()) - ctx_21.profile.minimum_balance_to_keep
        breached_plan_21 = {ctx_21.request.request_date: surplus_21 + 30.0}
        changes_21 = CashFlowSimulator.find_spending_changes_needed(ctx_21, rec_21, breached_plan_21)
        assert changes_21 is not None
        assert changes_21 != "none"

        # Verify mutual exclusivity
        if "|" in changes_21:
            actions = changes_21.split("|")
            eids = [act.split(":")[1] for act in actions]
            assert len(eids) == len(set(eids)), "Mutual exclusivity violated: duplicate event_id"

    def test_sub_penny_floating_point_invariance(self):
        """
        Requirement 5: Repeating decimal fractions (e.g. 1/3) must not cause precision drift.
        Internal Decimal quantization ensures exact penny math across 90 days.
        """
        profile = FinancialProfile(
            user_id="repeat_user",
            home_currency="USD",
            current_available_balance=100.00,
            minimum_balance_to_keep=10.00,
            financial_priorities=[],
            expense_categories_to_protect=[],
            expense_categories_user_is_willing_to_reduce=[],
            expense_categories_user_is_willing_to_stop=[],
            payment_methods_user_will_consider=["full_payment"],
            max_installment_months=None,
        )
        request = EvaluationRequest(
            request_id="repeat_req",
            user_id="repeat_user",
            request_date="2026-01-01",
            request_type="purchase",
            requested_amount=10.00,
            desired_completion_date="2026-01-30",
            allows_partial_payment=False,
            request_text="Test",
        )
        context = UserFinancialContext(
            request=request,
            profile=profile,
            events=[],
            payment_options=[],
            messages=[],
            images=[],
        )

        # 3 recurring-like debits of 33.33 each
        events = [
            ReconciledEvent(
                event_id="r1",
                user_id="repeat_user",
                description="Split 1",
                category="other",
                direction="debit",
                settlement_date="2026-01-02",
                amount_home=33.33,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
            ReconciledEvent(
                event_id="r2",
                user_id="repeat_user",
                description="Split 2",
                category="other",
                direction="debit",
                settlement_date="2026-01-03",
                amount_home=33.33,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
            ReconciledEvent(
                event_id="r3",
                user_id="repeat_user",
                description="Split 3",
                category="other",
                direction="debit",
                settlement_date="2026-01-04",
                amount_home=33.34,
                is_cash_flow=True,
                is_recurring=False,
                is_protected=False,
                is_stoppable=False,
                is_reducible=False,
                status="settled",
            ),
        ]

        bals = CashFlowSimulator.simulate_daily_balances(
            context=context,
            reconciled_events=events,
            start_date="2026-01-01",
            days=4,
        )

        # 100.00 - 33.33 - 33.33 - 33.34 = exactly 0.00
        assert bals["2026-01-04"] == 0.00
        assert isinstance(bals["2026-01-04"], float)

    def test_recurring_event_forward_projection_amendment(self, data_loader):
        """
        Requirement 6 (Mandatory Amendment):
        1. Historical recurring events with settlement_date prior to request_date
           are projected forward into [request_date, request_date + 90 days].
        2. stop:<event_id> omits all projected instances originating from event_id.
        3. reduce_to:<event_id>:<amount> caps all projected instances originating from event_id.
        """
        ctx_06 = data_loader.get_context("request_06")
        rec_06 = FinancialReconciler.reconcile(ctx_06, data_loader.currency_graph)
        req_d = datetime.date.fromisoformat(ctx_06.request.request_date)

        # 1. Verify active recurring events were detected
        active = CashFlowSimulator.get_active_recurring_events(rec_06, req_d)
        active_eids = {e.event_id for e in active}
        assert "event_476" in active_eids, "event_476 (streaming) must be in active recurring events"

        # 2. Verify projection generates future instances of event_476
        projected = CashFlowSimulator.project_recurring_events(active, req_d, forecast_days=90)
        proj_476 = [p for p in projected if p["originating_event_id"] == "event_476"]
        assert len(proj_476) >= 2, f"event_476 should be projected at least twice across 90 days, got {len(proj_476)}"

        # 3. Simulate baseline vs with stop:event_476
        bals_base = CashFlowSimulator.simulate_daily_balances(
            context=ctx_06,
            reconciled_events=rec_06,
            days=90,
        )
        bals_stopped = CashFlowSimulator.simulate_daily_balances(
            context=ctx_06,
            reconciled_events=rec_06,
            days=90,
            active_spending_changes=["stop:event_476"],
        )

        # Balance with streaming stopped must be strictly higher than baseline
        # on and after the first streaming debit day (Jan 10)
        assert bals_stopped["2026-01-10"] == pytest.approx(bals_base["2026-01-10"] + 19.00, abs=0.01)

        # 4. Test reduce_to spending change
        bals_reduced = CashFlowSimulator.simulate_daily_balances(
            context=ctx_06,
            reconciled_events=rec_06,
            days=90,
            active_spending_changes=["reduce_to:event_476:10.00"],
        )
        # Reducing 19.00 to 10.00 saves 9.00
        assert bals_reduced["2026-01-10"] == pytest.approx(bals_base["2026-01-10"] + 9.00, abs=0.01)
