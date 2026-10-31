import sys
from pathlib import Path

# Add project root and code dir to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CODE_DIR = PROJECT_ROOT / "code"
if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))

import pytest
from data_loader import FinancialDataLoader

DATASET_DIR = PROJECT_ROOT / "dataset"


@pytest.fixture(scope="module")
def loader():
    return FinancialDataLoader(DATASET_DIR)


def test_loader_profiles(loader):
    assert len(loader.profiles) == 275
    # Check sample user profile
    user_01 = loader.profiles["user_01"]
    assert user_01.home_currency == "ZAR"
    assert user_01.current_available_balance == 58481.1
    assert user_01.minimum_balance_to_keep == 18000.0
    assert "education" in user_01.financial_priorities
    assert "rent" in user_01.expense_categories_to_protect
    assert user_01.max_installment_months is None

    # Check user with max_installment_months populated
    user_02 = loader.profiles["user_02"]
    assert user_02.home_currency == "IDR"
    assert user_02.max_installment_months == 7


def test_loader_events_and_currency_normalization(loader):
    assert len(loader.events_by_id) == 25342

    # Check a foreign currency event
    # event_2167: user_25 (home_currency=IDR), amount=1800 USD, settlement=2023-10-15
    evt = loader.events_by_id["event_2167"]
    assert evt.currency == "USD"
    assert evt.amount == 1800.0
    assert evt.normalized_amount is not None
    # 1800 * 15833.33 = 28,499,994.0
    assert evt.normalized_amount == pytest.approx(28499994.0)
    assert evt.conversion_path == ["USD", "IDR"]


def test_loader_blank_amount_events(loader):
    # 16 events have blank amounts in dataset (waiting for VLM in Phase 2)
    blank_events = [e for e in loader.events_by_id.values() if e.amount is None]
    assert len(blank_events) == 16
    for e in blank_events:
        assert e.normalized_amount is None
        # Must have a corresponding image linked
        linked_images = loader.images_by_event.get(e.event_id, [])
        assert len(linked_images) == 1, f"Missing image for blank event {e.event_id}"


def test_loader_images(loader):
    # 16 images total
    all_images = [img for imgs in loader.images_by_user.values() for img in imgs]
    assert len(all_images) == 16
    for img in all_images:
        path = Path(img.file_path)
        assert path.exists(), f"Image file not found: {path}"


def test_loader_payment_options(loader):
    # Check options for request_01
    opts = loader.options_by_request["request_01"]
    assert len(opts) == 4
    # payment_option_01 is full_payment
    assert opts[0].payment_option_id == "payment_option_01"
    assert opts[0].payment_method == "full_payment"
    assert opts[0].total_payable_amount == 25256.0


def test_loader_messages(loader):
    # Check messages
    all_msgs = [m for msgs in loader.messages_by_user.values() for m in msgs]
    assert len(all_msgs) == 215


def test_request_counts_and_context(loader):
    assert len(loader.get_all_request_ids()) == 250
    assert len(loader.get_sample_request_ids()) == 25

    # Test context retrieval for sample request
    ctx_sample = loader.get_context("request_01")
    assert ctx_sample.request.request_id == "request_01"
    assert ctx_sample.profile.user_id == "user_01"
    assert len(ctx_sample.events) > 0
    assert len(ctx_sample.payment_options) == 4

    # Test context retrieval for evaluation request
    ctx_eval = loader.get_context("request_26")
    assert ctx_eval.request.request_id == "request_26"
    assert ctx_eval.profile.user_id == "user_26"
    assert len(ctx_eval.events) > 0
    assert len(ctx_eval.payment_options) > 0
