"""
Comprehensive Phase 3 Verification Suite:
Deterministic Financial Reconciliation and Ledger Tagging.
Tests conservative cash flow accounting invariants, spending protection hierarchy,
inter-account transfer neutralization, four-tier conflict resolution, deduplication,
and chronological ordering for user ledgers.
"""

from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "code"))

from currency import CurrencyGraph
from data_loader import FinancialDataLoader
from message_processor import MessageProcessor
from models import EvaluationRequest, FinancialEvent, FinancialProfile, Message, UserFinancialContext
from reconciler import FinancialReconciler, ReconciledEvent


@pytest.fixture(scope="module")
def data_loader():
    """Initializes the production FinancialDataLoader."""
    return FinancialDataLoader("dataset")


# ============================================================================
# 1. DISQUALIFY UNREALIZED INVESTMENTS
# ============================================================================

def test_disqualify_unrealized_investments(data_loader):
    """
    Confirms that all 10 investment_valuation rows across the dataset
    have is_cash_flow = False and direction = 'non_cash'.
    Non-cash unrealized market swings must NEVER be counted as liquid cash.
    """
    valuation_users = [
        "user_21", "user_22", "user_70", "user_105", "user_208",
        "user_231", "user_236", "user_243", "user_264", "user_266"
    ]
    verified_valuations = 0

    all_requests = {**data_loader.requests, **data_loader.sample_requests}

    for u_id in valuation_users:
        req = [r for r in all_requests.values() if r.user_id == u_id][0]
        ctx = data_loader.get_context(req.request_id)
        reconciled = FinancialReconciler.reconcile(ctx)

        for evt in reconciled:
            if "valuation" in evt.description.lower() or evt.category == "investment" and evt.status == "unrealized":
                assert evt.is_cash_flow is False, f"Valuation {evt.event_id} must have is_cash_flow=False"
                assert evt.direction == "non_cash", f"Valuation {evt.event_id} must have direction='non_cash'"
                verified_valuations += 1

    assert verified_valuations == 10, f"Expected 10 disqualified investment valuations, found {verified_valuations}"


# ============================================================================
# 2. DISQUALIFY PENDING INFLOWS
# ============================================================================

def test_disqualify_pending_inflows(data_loader):
    """
    Confirms pending refunds, gig earnings, prize/lottery claims,
    and unapproved bonuses are excluded from cash flow (is_cash_flow = False).
    """
    # 2a. Check all 8 pending merchant refunds in production dataset
    pending_refund_users = [
        "user_20", "user_35", "user_53", "user_77",
        "user_149", "user_191", "user_221", "user_275"
    ]
    all_requests = {**data_loader.requests, **data_loader.sample_requests}
    verified_pending_refunds = 0

    for u_id in pending_refund_users:
        req = [r for r in all_requests.values() if r.user_id == u_id][0]
        ctx = data_loader.get_context(req.request_id)
        reconciled = FinancialReconciler.reconcile(ctx)

        for evt in reconciled:
            if evt.description == "Pending merchant refund":
                assert evt.is_cash_flow is False, f"Pending refund {evt.event_id} must not be liquid cash"
                verified_pending_refunds += 1

    assert verified_pending_refunds == 8

    # 2b. Synthetic verification: Uncredited gig payout, lottery prize, unapproved bonus
    profile = FinancialProfile(
        user_id="user_test_inflows",
        home_currency="USD",
        current_available_balance=5000.0,
        minimum_balance_to_keep=1000.0,
    )
    req = EvaluationRequest(
        request_id="req_test_inflows",
        user_id="user_test_inflows",
        request_date="2026-04-01",
        request_type="purchase",
        requested_amount=500.0,
        desired_completion_date="2026-04-10",
        allows_partial_payment=False,
        request_text="Can I purchase?",
    )

    gig_event = FinancialEvent(
        event_id="evt_gig",
        user_id="user_test_inflows",
        event_type="income",
        description="ShiftPay payout pending",
        category="salary",
        direction="credit",
        amount=1200.0,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-05",
        status="pending",
        flexibility="fixed",
    )
    bonus_event = FinancialEvent(
        event_id="evt_bonus",
        user_id="user_test_inflows",
        event_type="income",
        description="Quarterly performance bonus subject to review",
        category="salary",
        direction="credit",
        amount=3000.0,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-15",
        status="settled",
        flexibility="fixed",
    )
    prize_event = FinancialEvent(
        event_id="evt_prize",
        user_id="user_test_inflows",
        event_type="income",
        description="Selected for a cash prize lottery claim",
        category="windfall",
        direction="credit",
        amount=5000.0,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-20",
        status="pending",
        flexibility="fixed",
    )

    ctx_synth = UserFinancialContext(
        request=req,
        profile=profile,
        events=[gig_event, bonus_event, prize_event],
    )
    reconciled_synth = FinancialReconciler.reconcile(ctx_synth)
    res_map = {e.event_id: e for e in reconciled_synth}

    assert res_map["evt_gig"].is_cash_flow is False
    assert res_map["evt_bonus"].is_cash_flow is False
    assert res_map["evt_prize"].is_cash_flow is False


# ============================================================================
# 3. CONSERVATIVE PENDING DEBITS INCLUDED
# ============================================================================

def test_conservative_pending_debits_included(data_loader):
    """
    Confirms pending and scheduled debits have is_cash_flow = True
    (conservatively reserving future obligations), while failed or cancelled
    debits have is_cash_flow = False.
    """
    profile = FinancialProfile(
        user_id="user_test_debits",
        home_currency="USD",
        current_available_balance=5000.0,
        minimum_balance_to_keep=1000.0,
    )
    req = EvaluationRequest(
        request_id="req_test_debits",
        user_id="user_test_debits",
        request_date="2026-04-01",
        request_type="purchase",
        requested_amount=200.0,
        desired_completion_date="2026-04-10",
        allows_partial_payment=False,
        request_text="Can I buy this?",
    )

    pending_debit = FinancialEvent(
        event_id="evt_deb_pending",
        user_id="user_test_debits",
        event_type="expense",
        description="Electricity bill",
        category="utilities",
        direction="debit",
        amount=140.0,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-03",
        status="pending",
        flexibility="fixed",
    )
    scheduled_debit = FinancialEvent(
        event_id="evt_deb_scheduled",
        user_id="user_test_debits",
        event_type="expense",
        description="Upcoming car insurance",
        category="insurance",
        direction="debit",
        amount=250.0,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-15",
        status="scheduled",
        flexibility="fixed",
    )
    failed_debit = FinancialEvent(
        event_id="evt_deb_failed",
        user_id="user_test_debits",
        event_type="expense",
        description="Failed gym renewal",
        category="gym",
        direction="debit",
        amount=60.0,
        currency="USD",
        event_date="2026-03-25",
        settlement_date="2026-03-25",
        status="failed",
        flexibility="fixed",
    )
    cancelled_debit = FinancialEvent(
        event_id="evt_deb_cancelled",
        user_id="user_test_debits",
        event_type="subscription",
        description="Cancelled software sub",
        category="cloud_storage",
        direction="debit",
        amount=15.0,
        currency="USD",
        event_date="2026-03-20",
        settlement_date="2026-03-20",
        status="cancelled",
        flexibility="fixed",
    )

    ctx = UserFinancialContext(
        request=req,
        profile=profile,
        events=[pending_debit, scheduled_debit, failed_debit, cancelled_debit],
    )
    reconciled = FinancialReconciler.reconcile(ctx)
    res_map = {e.event_id: e for e in reconciled}

    # Conservatively reserved debits:
    assert res_map["evt_deb_pending"].is_cash_flow is True
    assert res_map["evt_deb_scheduled"].is_cash_flow is True

    # Disqualified debits:
    assert res_map["evt_deb_failed"].is_cash_flow is False
    assert res_map["evt_deb_cancelled"].is_cash_flow is False


# ============================================================================
# 4. PROFILE PROTECTION OVERRIDES EVENT FLEXIBILITY
# ============================================================================

def test_profile_protection_overrides_event_flexibility():
    """
    Confirms Priority 1 (Hard Protection):
    If event.category in profile.expense_categories_to_protect:
      is_protected = True
      is_stoppable = False
      is_reducible = False
    Protection in financial_profiles ALWAYS overrides event-level flexibility.
    """
    profile = FinancialProfile(
        user_id="user_test_prot",
        home_currency="EUR",
        current_available_balance=2500.0,
        minimum_balance_to_keep=500.0,
        expense_categories_to_protect=["streaming", "dining"],
        expense_categories_user_is_willing_to_stop=["streaming"],
        expense_categories_user_is_willing_to_reduce=["dining"],
    )
    req = EvaluationRequest(
        request_id="req_test_prot",
        user_id="user_test_prot",
        request_date="2026-05-01",
        request_type="purchase",
        requested_amount=300.0,
        desired_completion_date="2026-05-10",
        allows_partial_payment=False,
        request_text="Purchase request",
    )

    streaming_event = FinancialEvent(
        event_id="evt_stream",
        user_id="user_test_prot",
        event_type="subscription",
        description="Premium 4K streaming plan",
        category="streaming",
        direction="debit",
        amount=29.99,
        currency="EUR",
        event_date="2026-05-01",
        settlement_date="2026-05-01",
        status="settled",
        flexibility="stoppable",
    )

    dining_event = FinancialEvent(
        event_id="evt_dining",
        user_id="user_test_prot",
        event_type="expense",
        description="Weekly dinner",
        category="dining",
        direction="debit",
        amount=150.0,
        currency="EUR",
        event_date="2026-05-01",
        settlement_date="2026-05-01",
        status="settled",
        flexibility="reducible",
        minimum_allowed_amount=75.0,
    )

    ctx = UserFinancialContext(
        request=req,
        profile=profile,
        events=[streaming_event, dining_event],
    )
    reconciled = FinancialReconciler.reconcile(ctx)
    res_map = {e.event_id: e for e in reconciled}

    # Protected streaming: stoppable must be overridden to False
    evt_s = res_map["evt_stream"]
    assert evt_s.is_protected is True
    assert evt_s.is_stoppable is False
    assert evt_s.is_reducible is False

    # Protected dining: reducible must be overridden to False
    evt_d = res_map["evt_dining"]
    assert evt_d.is_protected is True
    assert evt_d.is_stoppable is False
    assert evt_d.is_reducible is False


# ============================================================================
# 5. STOPPABLE AND REDUCIBLE TAGGING
# ============================================================================

def test_stoppable_and_reducible_tagging():
    """
    Confirms Priority 2 (Stoppable) and Priority 3 (Reducible) tagging
    strictly enforce category willingness, event flexibility, recurrence,
    and minimum allowed amount bounds.
    """
    profile = FinancialProfile(
        user_id="user_test_tag",
        home_currency="INR",
        current_available_balance=100000.0,
        minimum_balance_to_keep=20000.0,
        expense_categories_to_protect=["rent"],
        expense_categories_user_is_willing_to_stop=["cloud_storage", "music_subscription"],
        expense_categories_user_is_willing_to_reduce=["dining", "shopping"],
    )
    req = EvaluationRequest(
        request_id="req_test_tag",
        user_id="user_test_tag",
        request_date="2026-06-01",
        request_type="purchase",
        requested_amount=10000.0,
        desired_completion_date="2026-06-15",
        allows_partial_payment=False,
        request_text="Can I purchase?",
    )

    # 1. Cloud storage: stoppable, in willing_to_stop -> is_stoppable=True
    evt_cloud = FinancialEvent(
        event_id="evt_cloud",
        user_id="user_test_tag",
        event_type="subscription",
        description="Drive 2TB Cloud Storage",
        category="cloud_storage",
        direction="debit",
        amount=650.0,
        currency="INR",
        event_date="2026-06-01",
        settlement_date="2026-06-05",
        status="scheduled",
        flexibility="stoppable",
    )

    # 2. Gym: stoppable, but NOT in willing_to_stop -> is_stoppable=False
    evt_gym = FinancialEvent(
        event_id="evt_gym",
        user_id="user_test_tag",
        event_type="subscription",
        description="Monthly gym pass",
        category="gym",
        direction="debit",
        amount=2500.0,
        currency="INR",
        event_date="2026-06-01",
        settlement_date="2026-06-05",
        status="scheduled",
        flexibility="stoppable",
    )

    # 3. Dining: reducible, in willing_to_reduce, min < current -> is_reducible=True
    evt_dining = FinancialEvent(
        event_id="evt_dining_red",
        user_id="user_test_tag",
        event_type="expense",
        description="Weekend restaurant",
        category="dining",
        direction="debit",
        amount=4000.0,
        currency="INR",
        event_date="2026-06-01",
        settlement_date="2026-06-08",
        status="scheduled",
        flexibility="reducible",
        minimum_allowed_amount=2000.0,
    )

    # 4. Shopping: reducible, in willing_to_reduce, but min == current -> is_reducible=False
    evt_shop = FinancialEvent(
        event_id="evt_shop_red",
        user_id="user_test_tag",
        event_type="expense",
        description="Clothes shopping",
        category="shopping",
        direction="debit",
        amount=3000.0,
        currency="INR",
        event_date="2026-06-01",
        settlement_date="2026-06-10",
        status="scheduled",
        flexibility="reducible",
        minimum_allowed_amount=3000.0,
    )

    # 5. One-time work expense: reducible flexibility but NOT recurring -> is_reducible=False
    evt_work = FinancialEvent(
        event_id="evt_work_exp",
        user_id="user_test_tag",
        event_type="expense",
        description="Reimbursable client gift",
        category="work_expense",
        direction="debit",
        amount=1500.0,
        currency="INR",
        event_date="2026-06-01",
        settlement_date="2026-06-12",
        status="settled",
        flexibility="reducible",
        minimum_allowed_amount=500.0,
    )

    ctx = UserFinancialContext(
        request=req,
        profile=profile,
        events=[evt_cloud, evt_gym, evt_dining, evt_shop, evt_work],
    )
    reconciled = FinancialReconciler.reconcile(ctx)
    res_map = {e.event_id: e for e in reconciled}

    assert res_map["evt_cloud"].is_stoppable is True
    assert res_map["evt_cloud"].is_reducible is False

    assert res_map["evt_gym"].is_stoppable is False
    assert res_map["evt_gym"].is_reducible is False

    assert res_map["evt_dining_red"].is_reducible is True
    assert res_map["evt_dining_red"].is_stoppable is False

    assert res_map["evt_shop_red"].is_reducible is False
    assert res_map["evt_work_exp"].is_reducible is False


# ============================================================================
# 6. INTER-ACCOUNT TRANSFER NEUTRALIZED
# ============================================================================

def test_inter_account_transfer_neutralized(data_loader):
    """
    Confirms transfer entries (e.g. BAN-0013, BAN-0023, BAN-0041, BAN-0135, BAN-0202, BAN-0213)
    produce net zero cash impact (is_cash_flow = False) and zero balance distortion.
    """
    ctx = data_loader.get_context("request_18")

    # Add matching transfer debit and credit referencing BAN-0013
    transfer_amount = 5000.0
    transfer_debit = FinancialEvent(
        event_id="evt_ban13_deb",
        user_id="user_18",
        event_type="expense",
        description="Transfer to secondary checking Txn ref BAN-0013",
        category="internal_transfer",
        direction="debit",
        amount=transfer_amount,
        currency="EUR",
        event_date="2026-03-01",
        settlement_date="2026-03-01",
        status="settled",
        flexibility="fixed",
    )
    transfer_credit = FinancialEvent(
        event_id="evt_ban13_cred",
        user_id="user_18",
        event_type="income",
        description="Transfer from primary checking Txn ref BAN-0013",
        category="internal_transfer",
        direction="credit",
        amount=transfer_amount,
        currency="EUR",
        event_date="2026-03-01",
        settlement_date="2026-03-01",
        status="settled",
        flexibility="fixed",
    )

    ctx_aug = ctx.model_copy(update={"events": ctx.events + [transfer_debit, transfer_credit]})
    reconciled = FinancialReconciler.reconcile(ctx_aug)
    res_map = {e.event_id: e for e in reconciled}

    deb_rec = res_map["evt_ban13_deb"]
    cred_rec = res_map["evt_ban13_cred"]

    # Both internal transfer legs must be excluded from liquid cash flow
    assert deb_rec.is_cash_flow is False
    assert cred_rec.is_cash_flow is False

    # Net balance distortion must be exactly 0.0
    cash_flow_delta = (
        (cred_rec.amount_home if cred_rec.is_cash_flow else 0.0) -
        (deb_rec.amount_home if deb_rec.is_cash_flow else 0.0)
    )
    assert cash_flow_delta == 0.0


# ============================================================================
# 7. EXACT DUPLICATE REMOVAL
# ============================================================================

def test_duplicate_removal():
    """
    Confirms repeated records matching (user_id, amount_home, settlement_date, description)
    are deduplicated using the Four-Tier Conflict Resolution Order.
    """
    profile = FinancialProfile(
        user_id="user_test_dup",
        home_currency="USD",
        current_available_balance=5000.0,
        minimum_balance_to_keep=1000.0,
    )
    req = EvaluationRequest(
        request_id="req_test_dup",
        user_id="user_test_dup",
        request_date="2026-04-01",
        request_type="purchase",
        requested_amount=100.0,
        desired_completion_date="2026-04-05",
        allows_partial_payment=False,
        request_text="Testing duplicates",
    )

    # Two records with identical (user_id, amount, settlement_date, description):
    # event_10: pending estimate
    # event_20: settled record
    # Tier 3 (settled over estimate) selects event_20
    evt_pending = FinancialEvent(
        event_id="event_10",
        user_id="user_test_dup",
        event_type="expense",
        description="Supermarket groceries",
        category="groceries",
        direction="debit",
        amount=125.50,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-01",
        status="pending",
        flexibility="fixed",
    )
    evt_settled = FinancialEvent(
        event_id="event_20",
        user_id="user_test_dup",
        event_type="expense",
        description="Supermarket groceries",
        category="groceries",
        direction="debit",
        amount=125.50,
        currency="USD",
        event_date="2026-04-01",
        settlement_date="2026-04-01",
        status="settled",
        flexibility="fixed",
    )

    ctx = UserFinancialContext(
        request=req,
        profile=profile,
        events=[evt_pending, evt_settled],
    )
    reconciled = FinancialReconciler.reconcile(ctx)

    assert len(reconciled) == 1
    assert reconciled[0].event_id == "event_20"
    assert reconciled[0].status == "settled"


# ============================================================================
# 8. SAMPLE LEDGER RECONCILIATION & CHRONOLOGICAL ORDERING
# ============================================================================

def test_sample_ledger_reconciliation(data_loader):
    """
    Reconciles user_01 through user_05 ledgers and asserts chronological
    ordering of active cash flow events.
    """
    sample_request_ids = ["request_01", "request_02", "request_03", "request_04", "request_05"]

    for req_id in sample_request_ids:
        ctx = data_loader.get_context(req_id)
        reconciled = FinancialReconciler.reconcile(ctx)

        # Check all returned items are valid ReconciledEvents
        for evt in reconciled:
            assert isinstance(evt, ReconciledEvent)
            assert evt.amount_home >= 0.0
            assert evt.direction in ("debit", "credit", "non_cash")

        # Check strict chronological ordering on active cash flow events
        active_cash_flow = [e for e in reconciled if e.is_cash_flow]
        assert len(active_cash_flow) > 0

        for i in range(len(active_cash_flow) - 1):
            date_curr = active_cash_flow[i].settlement_date
            date_next = active_cash_flow[i + 1].settlement_date
            assert date_curr is not None and date_next is not None
            assert date_curr <= date_next, (
                f"Ledger {req_id} out of order at index {i}: {date_curr} > {date_next}"
            )
