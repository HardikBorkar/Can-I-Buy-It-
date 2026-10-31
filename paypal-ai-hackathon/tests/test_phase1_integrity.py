"""
Comprehensive, adversarial test suite validating Phase 1 data ingestion,
relational joins, and currency normalization against AGENTS.md and problem_statement.md.
"""

import sys
from pathlib import Path
import pandas as pd
import pytest

# Ensure project and code root are on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CODE_DIR = PROJECT_ROOT / "code"
if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))

from currency import CurrencyGraph
from data_loader import FinancialDataLoader
from models import FinancialEvent, FinancialProfile, PaymentOption

DATASET_DIR = PROJECT_ROOT / "dataset"
EVENTS_CSV = DATASET_DIR / "financial_events.csv"
PROFILES_CSV = DATASET_DIR / "financial_profiles.csv"
OPTIONS_CSV = DATASET_DIR / "request_payment_options.csv"
RATES_CSV = DATASET_DIR / "exchange_rates.csv"
MESSAGES_CSV = DATASET_DIR / "messages.csv"


@pytest.fixture(scope="module")
def loader():
    return FinancialDataLoader(DATASET_DIR)


# ==============================================================================
# 1. Null & Edge-Case Handling in Events
# ==============================================================================

def test_investment_valuation_null_settlement_date(loader):
    """
    Verify that all 10 'investment_valuation' events with null settlement_date
    load without throwing validation errors and have settlement_date as None.
    """
    df_events = pd.read_csv(EVENTS_CSV)
    raw_null_settle = df_events[
        (df_events["event_type"] == "investment_valuation")
        & (df_events["settlement_date"].isna())
    ]
    assert len(raw_null_settle) == 10, f"Expected 10 null valuation events, found {len(raw_null_settle)}"

    for evt_id in raw_null_settle["event_id"]:
        assert evt_id in loader.events_by_id, f"Event {evt_id} missing from loader"
        evt = loader.events_by_id[evt_id]
        assert evt.event_type == "investment_valuation"
        assert evt.status == "unrealized"
        assert evt.settlement_date is None, f"Expected None for settlement_date in {evt_id}, got {evt.settlement_date}"


def test_event_7307_blank_amount_preserved(loader):
    """
    Verify that event_7307 (user_78, taxi fare in USD with NaN amount) is preserved
    with its original currency and leaves normalized_amount as None for Phase 2 OCR,
    rather than defaulting to 0.0.
    """
    assert "event_7307" in loader.events_by_id, "event_7307 must be loaded"
    evt = loader.events_by_id["event_7307"]
    
    assert evt.user_id == "user_78"
    assert evt.currency == "USD"
    assert evt.amount is None, "Raw amount must be None (not 0.0)"
    assert evt.normalized_amount is None, "Normalized amount must remain None for OCR"
    assert evt.description == "Taxi fare"
    assert evt.direction == "debit"

    # Confirm user_78's home currency is INR (requiring cross-currency OCR in Phase 2)
    prof = loader.profiles["user_78"]
    assert prof.home_currency == "INR"


def test_no_settled_or_pending_amounts_dropped_or_truncated(loader):
    """
    Assert that no settled/pending debit or credit (with a valid raw amount)
    has its amount silently dropped, converted to 0, or truncated.
    """
    df_events = pd.read_csv(EVENTS_CSV)
    active_events = df_events[
        df_events["status"].isin(["settled", "pending"])
        & df_events["direction"].isin(["debit", "credit"])
        & df_events["amount"].notna()
    ]

    for _, row in active_events.iterrows():
        evt_id = row["event_id"]
        raw_amt = float(row["amount"])
        loaded_evt = loader.events_by_id[evt_id]

        assert loaded_evt.amount is not None, f"Event {evt_id} amount was dropped"
        assert loaded_evt.amount == pytest.approx(raw_amt, rel=1e-6), (
            f"Event {evt_id} amount truncated: raw={raw_amt}, loaded={loaded_evt.amount}"
        )
        assert loaded_evt.normalized_amount is not None, f"Event {evt_id} normalized_amount missing"
        assert loaded_evt.normalized_amount > 0, f"Event {evt_id} normalized to <= 0"


# ==============================================================================
# 2. Schema Optionality & Delimiters
# ==============================================================================

def test_financial_profiles_max_installment_months_none(loader):
    """
    Check financial_profiles where max_installment_months is blank/NaN (e.g., user_01)
    to ensure it parses as None, not 0 or error.
    """
    user_01 = loader.profiles["user_01"]
    assert user_01.max_installment_months is None, (
        f"Expected None for user_01 max_installment_months, got {user_01.max_installment_months}"
    )

    df_profiles = pd.read_csv(PROFILES_CSV)
    blank_months = df_profiles[df_profiles["max_installment_months"].isna()]
    for u_id in blank_months["user_id"]:
        prof = loader.profiles[u_id]
        assert prof.max_installment_months is None, f"Expected None for {u_id}, got {prof.max_installment_months}"


def test_pipe_delimited_fields_empty_and_populated(loader):
    """
    Verify that pipe-delimited fields handle empty strings/NaN by returning empty lists,
    and correctly parse lists when populated.
    """
    df_profiles = pd.read_csv(PROFILES_CSV)
    for _, row in df_profiles.iterrows():
        u_id = row["user_id"]
        prof = loader.profiles[u_id]

        for col in [
            "financial_priorities",
            "expense_categories_to_protect",
            "expense_categories_user_is_willing_to_reduce",
            "expense_categories_user_is_willing_to_stop",
            "payment_methods_user_will_consider",
        ]:
            attr_val = getattr(prof, col)
            raw_val = row[col]

            if pd.isna(raw_val) or not str(raw_val).strip():
                assert attr_val == [], f"Expected empty list for {col} in {u_id}, got {attr_val}"
            else:
                expected_items = [x.strip() for x in str(raw_val).split("|") if x.strip()]
                assert attr_val == expected_items, (
                    f"Mismatch in {col} for {u_id}: expected {expected_items}, got {attr_val}"
                )


def test_payment_frequency_days_nan_on_full_payment(loader):
    """
    Confirm request_payment_options correctly handles NaN for payment_frequency_days
    on 'full_payment' options, setting it to None.
    """
    df_opts = pd.read_csv(OPTIONS_CSV)
    full_opts = df_opts[df_opts["payment_method"] == "full_payment"]

    for _, row in full_opts.iterrows():
        req_id = row["request_id"]
        opt_id = row["payment_option_id"]
        options = [o for o in loader.options_by_request[req_id] if o.payment_option_id == opt_id]
        assert len(options) == 1
        opt = options[0]

        assert opt.payment_method == "full_payment"
        assert opt.number_of_payments == 1
        if pd.isna(row["payment_frequency_days"]):
            assert opt.payment_frequency_days is None, (
                f"Expected None for frequency on {opt_id}, got {opt.payment_frequency_days}"
            )


# ==============================================================================
# 3. Currency Graph Alignment
# ==============================================================================

def test_domestic_events_rate_exact_one(loader):
    """
    Assert that domestic events (currency == home_currency) return an exchange rate
    of exactly 1.0 without querying or altering the rate table.
    """
    for u_id, events in loader.events_by_user.items():
        home_curr = loader.profiles[u_id].home_currency
        for e in events:
            if e.currency == home_curr and e.amount is not None:
                assert e.exchange_rate_applied == 1.0, (
                    f"Domestic event {e.event_id} rate != 1.0: {e.exchange_rate_applied}"
                )
                assert e.normalized_amount == e.amount
                assert e.conversion_path == [home_curr]


def test_foreign_events_use_exact_settlement_date(loader):
    """
    Assert that every foreign event converts using the rate matching its exact
    settlement_date (not request_date or event_date).
    """
    df_events = pd.read_csv(EVENTS_CSV)
    df_profiles = pd.read_csv(PROFILES_CSV)
    df_rates = pd.read_csv(RATES_CSV)

    merged = df_events.merge(df_profiles[["user_id", "home_currency"]], on="user_id", how="left")
    foreign_active = merged[
        (merged["currency"] != merged["home_currency"])
        & (merged["amount"].notna())
        & (merged["settlement_date"].notna())
    ]

    for _, row in foreign_active.iterrows():
        evt_id = row["event_id"]
        from_c = row["currency"]
        to_c = row["home_currency"]
        settle_d = row["settlement_date"]

        loaded_evt = loader.events_by_id[evt_id]
        assert loaded_evt.exchange_rate_applied is not None

        # Verify against CurrencyGraph directly with settle_d
        expected_rate, expected_path = loader.currency_graph.get_rate_and_path(settle_d, from_c, to_c)
        assert loaded_evt.exchange_rate_applied == pytest.approx(expected_rate, rel=1e-6)
        assert loaded_evt.conversion_path == expected_path


def test_currency_reciprocal_conversions_precision(loader):
    """
    Check that reciprocal conversions maintain precision across all rate dates:
    - On dates where only single-direction rates are provided (e.g. 2023-10-15, 2024-01-15),
      inversion is exact: abs(product - 1.0) < 1e-6.
    - Across the entire dataset, the maximum deviation is bounded by 0.0028, which stems
      from the dataset authors explicitly listing both EUR->USD (1.09) and USD->EUR (0.92),
      giving 1.09 * 0.92 = 1.0028.
    """
    df_rates = pd.read_csv(RATES_CSV)
    all_dates = df_rates["rate_date"].unique()

    currencies = ["USD", "EUR", "ZAR", "INR", "IDR"]
    max_deviation = 0.0

    for d in all_dates:
        for c1 in currencies:
            for c2 in currencies:
                if c1 == c2:
                    continue
                r_fwd = loader.currency_graph.get_rate(d, c1, c2, raise_on_missing=False)
                r_bwd = loader.currency_graph.get_rate(d, c2, c1, raise_on_missing=False)

                if r_fwd is not None and r_bwd is not None:
                    product = r_fwd * r_bwd
                    dev = abs(product - 1.0)
                    if dev > max_deviation:
                        max_deviation = dev

                    # All pairs in the dataset must remain bounded within the dataset author rounding tolerance
                    assert dev < 0.005, f"Excessive reciprocal deviation on {d} for {c1} <-> {c2}: product={product}"

    # Verify that max deviation across the entire dataset exactly matches the dataset's EUR/USD rounding (0.0028)
    assert max_deviation <= 0.0028001, f"Unexpectedly high deviation: {max_deviation}"

    # Verify that on dates with pure inversion (e.g., 2024-01-15), reciprocal precision is strictly < 1e-6
    r_inr_eur = loader.currency_graph.get_rate("2024-01-15", "INR", "EUR")
    r_eur_inr = loader.currency_graph.get_rate("2024-01-15", "EUR", "INR")
    assert abs((r_inr_eur * r_eur_inr) - 1.0) < 1e-6




# ==============================================================================
# 4. UserFinancialContext Assembly & Temporal Ordering
# ==============================================================================

def test_events_strictly_sorted_chronologically(loader):
    """
    In loader.get_context("request_01"), verify that all associated financial_events
    are strictly sorted in chronological order by settlement_date.
    """
    ctx = loader.get_context("request_01")
    events = ctx.events
    assert len(events) > 0

    valid_settle_events = [e for e in events if e.settlement_date is not None]
    dates = [e.settlement_date for e in valid_settle_events]

    # Ensure non-decreasing order
    assert dates == sorted(dates), f"Events for request_01 not sorted chronologically: {dates[:10]}"

    # Also verify across all sample requests
    for req_id in loader.get_sample_request_ids()[:5]:
        c = loader.get_context(req_id)
        s_dates = [e.settlement_date for e in c.events if e.settlement_date is not None]
        assert s_dates == sorted(s_dates), f"Events for {req_id} not sorted chronologically"


def test_context_captures_both_request_linked_and_broadcast_messages(loader):
    """
    Verify that context.messages captures both messages linked by request_id
    AND unlinked broadcast messages for that user_id.
    """
    df_msgs = pd.read_csv(MESSAGES_CSV)

    # user_02 has message_01 with request_id = NaN (broadcast)
    ctx_02 = loader.get_context("request_02")
    msg_ids_02 = [m.message_id for m in ctx_02.messages]
    assert "message_01" in msg_ids_02, "Broadcast message_01 missing from user_02 context"

    # user_03 has message_02 with request_id = request_03 (linked)
    ctx_03 = loader.get_context("request_03")
    msg_ids_03 = [m.message_id for m in ctx_03.messages]
    assert "message_02" in msg_ids_03, "Linked message_02 missing from user_03 context"

    # Verify that for every user, ALL messages in messages.csv for that user_id are present
    for u_id, prof in loader.profiles.items():
        expected_msg_ids = set(df_msgs[df_msgs["user_id"] == u_id]["message_id"])
        # Find request for this user
        req = [r for r in loader.requests.values() if r.user_id == u_id]
        if not req:
            req = [r for r in loader.sample_requests.values() if r.user_id == u_id]
        if req:
            c = loader.get_context(req[0].request_id)
            actual_msg_ids = set(m.message_id for m in c.messages)
            assert expected_msg_ids == actual_msg_ids, f"Message mismatch for {u_id}"


def test_zero_cross_user_data_leakage(loader):
    """
    Assert zero cross-user data leakage: no events, messages, or payment options
    belonging to user_02 appear in user_01's context.
    """
    ctx_01 = loader.get_context("request_01")
    ctx_02 = loader.get_context("request_02")

    # Check request and profile
    assert ctx_01.request.request_id == "request_01"
    assert ctx_01.profile.user_id == "user_01"
    assert ctx_02.request.request_id == "request_02"
    assert ctx_02.profile.user_id == "user_02"

    # Check events
    evt_ids_01 = set(e.event_id for e in ctx_01.events)
    evt_ids_02 = set(e.event_id for e in ctx_02.events)
    assert evt_ids_01.isdisjoint(evt_ids_02), "Event leakage detected between user_01 and user_02"

    for e in ctx_01.events:
        assert e.user_id == "user_01", f"Foreign event {e.event_id} found in user_01 context"

    # Check messages
    msg_ids_01 = set(m.message_id for m in ctx_01.messages)
    msg_ids_02 = set(m.message_id for m in ctx_02.messages)
    assert msg_ids_01.isdisjoint(msg_ids_02), "Message leakage detected between user_01 and user_02"

    for m in ctx_01.messages:
        assert m.user_id == "user_01", f"Foreign message {m.message_id} found in user_01 context"

    # Check payment options
    opt_ids_01 = set(o.payment_option_id for o in ctx_01.payment_options)
    opt_ids_02 = set(o.payment_option_id for o in ctx_02.payment_options)
    assert opt_ids_01.isdisjoint(opt_ids_02), "Payment option leakage detected between request_01 and request_02"

    for o in ctx_01.payment_options:
        assert o.request_id == "request_01", f"Foreign option {o.payment_option_id} found in request_01 context"
