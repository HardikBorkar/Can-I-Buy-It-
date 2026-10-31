"""
Comprehensive Phase 2 Verification Suite:
Multimodal Receipt Extraction and Semantic Message Reconciliation.
Tests schema validation, VLM mocking, persistent caching, token tracking,
foreign currency conversion on event_7307, and all 6 operational overrides.
"""

import json
from pathlib import Path
import tempfile
from unittest.mock import MagicMock
import pytest
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "code"))

from currency import CurrencyGraph
from data_loader import FinancialDataLoader
from evidence_extractor import ReceiptExtraction, ReceiptExtractor
from message_processor import (
    ContractEndOverride,
    DateReplacementOverride,
    InflowDisqualificationOverride,
    InterAccountTransferOverride,
    LeaseRenewalOverride,
    MessageProcessor,
    OperationalOverrides,
    SalaryAmendmentOverride,
)
from models import FinancialEvent, Message


@pytest.fixture(scope="module")
def data_loader():
    """Initializes the production FinancialDataLoader."""
    return FinancialDataLoader("dataset")


@pytest.fixture(scope="module")
def extractor():
    """Initializes ReceiptExtractor using dataset cache."""
    return ReceiptExtractor(dataset_dir="dataset")


# ============================================================================
# 1. MULTIMODAL RECEIPT EXTRACTION & VLM MOCKING TESTS
# ============================================================================

def test_receipt_extraction_schema():
    """Verify strict Pydantic model validation and serialization."""
    re = ReceiptExtraction(amount=1250.75, currency="INR")
    assert re.amount == 1250.75
    assert re.currency == "INR"

    # Test JSON round-trip
    dumped = re.model_dump_json()
    loaded = ReceiptExtraction.model_validate_json(dumped)
    assert loaded.amount == 1250.75
    assert loaded.currency == "INR"

    # Assert validation error on invalid types
    with pytest.raises(Exception):
        ReceiptExtraction(amount="invalid", currency="INR")


def test_mock_vlm_call_and_cache_writing(tmp_path):
    """
    Verify that VLM calls can be mocked to test schema parsing and cache writing
    without incurring API charges or making network calls.
    """
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = ReceiptExtraction(amount=99.99, currency="USD")
    mock_response.usage_metadata.prompt_token_count = 150
    mock_response.usage_metadata.candidates_token_count = 25
    mock_client.models.generate_content.return_value = mock_response

    # Create dummy image
    img_path = tmp_path / "dummy_receipt.png"
    img = Image.new("RGB", (100, 100), color="white")
    img.save(img_path)

    cache_file = tmp_path / "cache.json"
    token_file = tmp_path / "token_usage.json"

    ext = ReceiptExtractor(
        dataset_dir="dataset",
        cache_file=cache_file,
        token_usage_file=token_file,
        client=mock_client,
    )

    # 1. First call: invokes mock client and writes cache
    res = ext.extract_from_image("mock_img_01", img_path)
    assert res.amount == 99.99
    assert res.currency == "USD"
    assert mock_client.models.generate_content.call_count == 1

    # Check cache file written to disk
    assert cache_file.exists()
    with open(cache_file, "r") as f:
        cache_data = json.load(f)
    assert cache_data["mock_img_01"]["amount"] == 99.99
    assert cache_data["mock_img_01"]["currency"] == "USD"

    # Check token usage file written to disk
    assert token_file.exists()
    usage = ext.get_token_usage()
    assert usage["model_calls"] == 1
    assert usage["prompt_tokens"] == 150
    assert usage["candidate_tokens"] == 25
    assert usage["total_tokens"] == 175

    # 2. Second call: loads from cache with 0 additional client calls
    res2 = ext.extract_from_image("mock_img_01", img_path)
    assert res2.amount == 99.99
    assert mock_client.models.generate_content.call_count == 1  # unchanged!


def test_all_16_blank_events_obtain_positive_amounts(data_loader, extractor):
    """
    Verify that all 16 events in financial_events.csv with blank amounts
    obtain non-null, positive float amounts via ReceiptExtractor.
    """
    extractions = extractor.enrich_blank_events(data_loader)
    assert len(extractions) == 16, f"Expected 16 extractions, got {len(extractions)}"

    for event_id, ext in extractions.items():
        event = data_loader.events_by_id[event_id]
        assert event.amount is not None, f"Event {event_id} has null amount"
        assert isinstance(event.amount, float), f"Event {event_id} amount is not float"
        assert event.amount > 0, f"Event {event_id} amount must be positive"
        assert event.currency in ("INR", "USD", "IDR", "EUR", "ZAR"), f"Unexpected currency {event.currency}"
        assert event.normalized_amount is not None, f"Event {event_id} missing normalized_amount"
        assert event.normalized_amount > 0, f"Event {event_id} normalized_amount must be positive"


def test_event_7307_currency_conversion_rate_83_33(data_loader, extractor):
    """
    Verify that event_7307 (user_78, taxi fare in USD with home currency INR)
    extracts $33.50 USD and gets converted into INR at rate 83.33 on settlement date 2025-10-01.
    """
    extractor.enrich_blank_events(data_loader)
    evt_7307 = data_loader.events_by_id["event_7307"]

    assert evt_7307.user_id == "user_78"
    assert evt_7307.currency == "USD"
    assert evt_7307.settlement_date == "2025-10-01"
    assert evt_7307.amount == 33.50
    assert evt_7307.exchange_rate_applied == 83.33
    # 33.50 * 83.33 = 2791.555
    assert evt_7307.normalized_amount == pytest.approx(2791.555, rel=1e-4)


# ============================================================================
# 2. SEMANTIC MESSAGE RECONCILIATION & OPERATIONAL OVERRIDES
# ============================================================================

def test_stayledger_lease_renewal_applied_to_user_16(data_loader):
    """
    Verify that StayLedger 12% rent increase is applied to user_16's upcoming rent.
    User 16 settled rent: 57,100 INR -> Upcoming rent: 57,100 * 1.12 = 63,952 INR.
    """
    ctx_16 = data_loader.get_context("request_16")
    reconciled_ctx, overrides = MessageProcessor.reconcile_context(ctx_16, data_loader.currency_graph)

    # Assert override was parsed correctly
    assert len(overrides.lease_renewals) >= 1
    lr = overrides.lease_renewals[0]
    assert lr.user_id == "user_16"
    assert lr.increase_percent == 12.0
    assert lr.ref == "SER-0012"

    # Assert upcoming rent calculation incorporates 12% increase
    upcoming_rent = MessageProcessor.get_upcoming_rent("user_16", ctx_16.events, overrides)
    assert upcoming_rent == 63952.0


def test_all_lease_renewal_overrides_parsed(data_loader):
    """Verify all lease renewal messages across English and Indonesian are detected."""
    sample_refs = ["SER-0012", "SER-0055", "SER-0061", "SER-0105", "SER-0147", "SER-0175"]
    all_messages = [msg for msgs in data_loader.messages_by_user.values() for msg in msgs]
    overrides = MessageProcessor.extract_overrides(all_messages)

    detected_refs = {lr.ref for lr in overrides.lease_renewals if lr.ref}
    for ref in sample_refs:
        assert ref in detected_refs, f"Expected lease renewal ref {ref} not detected"


def test_contract_end_drops_future_recurring_payroll(data_loader):
    """
    Verify contract termination overrides drop all future recurring payroll events.
    Checks EMP-0009, EMP-0021, EMP-0045, EMP-0057, EMP-0084, EMP-0103, EMP-0129,
    EMP-0160, EMP-0166, EMP-0186, EMP-0189, EMP-0192, EMP-0206.
    """
    contract_refs = [
        "EMP-0009", "EMP-0021", "EMP-0045", "EMP-0057", "EMP-0084",
        "EMP-0103", "EMP-0129", "EMP-0160", "EMP-0166", "EMP-0186",
        "EMP-0189", "EMP-0192", "EMP-0206"
    ]
    all_messages = [msg for msgs in data_loader.messages_by_user.values() for msg in msgs]
    overrides = MessageProcessor.extract_overrides(all_messages)
    detected_refs = {ce.ref for ce in overrides.contract_ends if ce.ref}

    for ref in contract_refs:
        assert ref in detected_refs, f"Expected contract end ref {ref} not detected"

    # Test user_12 (EMP-0009): future salary should be cancelled/none
    user_12_events = data_loader.events_by_user["user_12"]
    user_12_overrides = MessageProcessor.extract_overrides(data_loader.messages_by_user["user_12"])
    next_date, next_amt = MessageProcessor.get_next_confirmed_salary("user_12", user_12_events, user_12_overrides)
    assert next_date is None
    assert next_amt is None


def test_date_replacement_emp0005(data_loader):
    """
    Verify that EMP-0005 shifts confirmed payroll date to 2024-09-23 for user_07.
    """
    ctx_07 = data_loader.get_context("request_07")
    reconciled_ctx, overrides = MessageProcessor.reconcile_context(ctx_07, data_loader.currency_graph)

    assert len(overrides.date_replacements) >= 1
    dr = overrides.date_replacements[0]
    assert dr.user_id == "user_07"
    assert dr.revised_date == "2024-09-23"
    assert dr.ref == "EMP-0005"

    next_date, next_amt = MessageProcessor.get_next_confirmed_salary("user_07", ctx_07.events, overrides)
    assert next_date == "2024-09-23"
    assert next_amt == 149000.0


def test_salary_amendments_and_arrears_split(data_loader):
    """
    Verify salary amendments:
    1. Unpaid leave temporary reductions (e.g. user_114, EMP-0087: INR 148,200).
    2. Arrears separation: base pay vs one-time arrears (e.g. user_118, EMP-0090: EUR 759 regular + 341.55 arrears).
    """
    all_messages = [msg for msgs in data_loader.messages_by_user.values() for msg in msgs]
    overrides = MessageProcessor.extract_overrides(all_messages)

    # 1. Check unpaid leave reduction for user_114
    sa_114 = [sa for sa in overrides.salary_amendments if sa.user_id == "user_114"]
    assert len(sa_114) >= 1
    assert sa_114[0].amount == 148200.0
    assert sa_114[0].adjustment_type == "unpaid_leave"

    # 2. Check arrears split for user_118
    sa_118 = [sa for sa in overrides.salary_amendments if sa.user_id == "user_118"]
    assert len(sa_118) >= 1
    assert sa_118[0].regular_amount == 759.0
    assert sa_118[0].arrears_amount == 341.55
    assert sa_118[0].amount == 1100.55


def test_inflow_disqualification():
    """
    Verify that unapproved bonuses, pending merchant refunds, pending gig payouts,
    and unrealized investment valuations are disqualified from spendable cash.
    """
    # 1. Unrealized investment valuation event -> Disqualified
    evt_unrealized = FinancialEvent(
        event_id="evt_test_inv",
        user_id="user_test",
        event_type="investment_valuation",
        description="Market portfolio valuation",
        category="investments",
        direction="credit",
        amount=50000.0,
        currency="INR",
        event_date="2026-01-01",
        settlement_date=None,
        status="unrealized",
        flexibility="fixed",
    )
    assert not MessageProcessor.is_spendable_inflow(evt_unrealized)

    # 2. Non-cash event -> Disqualified
    evt_non_cash = evt_unrealized.model_copy(update={"direction": "non_cash"})
    assert not MessageProcessor.is_spendable_inflow(evt_non_cash)

    # 3. Pending merchant refund -> Disqualified
    evt_refund_pending = FinancialEvent(
        event_id="evt_test_ref",
        user_id="user_test",
        event_type="refund",
        description="Pending foreign refund",
        category="shopping",
        direction="credit",
        amount=150.0,
        currency="USD",
        event_date="2026-01-01",
        settlement_date="2026-01-05",
        status="pending",
        flexibility="fixed",
    )
    assert not MessageProcessor.is_spendable_inflow(evt_refund_pending)

    # 4. Unapproved bonus -> Disqualified via override
    evt_bonus = FinancialEvent(
        event_id="evt_test_bonus",
        user_id="user_test",
        event_type="income",
        description="Annual performance bonus",
        category="bonus",
        direction="credit",
        amount=25000.0,
        currency="INR",
        event_date="2026-01-01",
        settlement_date="2026-01-15",
        status="settled",
        flexibility="fixed",
    )
    bonus_ov = OperationalOverrides(
        inflow_disqualifications=[
            InflowDisqualificationOverride(
                user_id="user_test",
                message_id="msg_bonus",
                sent_at="2026-01-01",
                disqualification_type="bonus",
                description="Bonus subject to review",
            )
        ]
    )
    assert not MessageProcessor.is_spendable_inflow(evt_bonus, bonus_ov)

    # 5. Settled regular salary -> SPENDABLE (True)
    evt_salary = FinancialEvent(
        event_id="evt_test_sal",
        user_id="user_test",
        event_type="income",
        description="Payroll credit",
        category="salary",
        direction="credit",
        amount=85000.0,
        currency="INR",
        event_date="2026-01-15",
        settlement_date="2026-01-15",
        status="settled",
        flexibility="fixed",
    )
    assert MessageProcessor.is_spendable_inflow(evt_salary)


def test_inter_account_transfer_neutralization(data_loader):
    """
    Verify inter-account transfer detection and neutralization (e.g. BAN-0013, BAN-0023).
    """
    all_messages = [msg for msgs in data_loader.messages_by_user.values() for msg in msgs]
    overrides = MessageProcessor.extract_overrides(all_messages)
    transfer_users = {tr.user_id for tr in overrides.inter_account_transfers}

    assert "user_18" in transfer_users
    assert "user_33" in transfer_users
    assert "user_57" in transfer_users
    assert "user_171" in transfer_users
    assert "user_261" in transfer_users
    assert "user_273" in transfer_users

    # An internal transfer event marked category='internal_transfer' has zero spendable inflow
    internal_transfer_credit = FinancialEvent(
        event_id="evt_transfer_cred",
        user_id="user_18",
        event_type="income",
        description="Internal transfer from savings",
        category="internal_transfer",
        direction="credit",
        amount=5000.0,
        currency="INR",
        event_date="2026-03-01",
        settlement_date="2026-03-01",
        status="settled",
        flexibility="fixed",
    )
    assert not MessageProcessor.is_spendable_inflow(internal_transfer_credit)
