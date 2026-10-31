import sys
from pathlib import Path

# Add project root and code dir to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CODE_DIR = PROJECT_ROOT / "code"
if str(CODE_DIR) not in sys.path:
    sys.path.insert(0, str(CODE_DIR))

import pytest
import pandas as pd
from currency import CurrencyGraph

DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset"
EXCHANGE_RATES_PATH = DATASET_DIR / "exchange_rates.csv"
EVENTS_PATH = DATASET_DIR / "financial_events.csv"
PROFILES_PATH = DATASET_DIR / "financial_profiles.csv"


@pytest.fixture(scope="module")
def currency_graph():
    assert EXCHANGE_RATES_PATH.exists(), f"Missing {EXCHANGE_RATES_PATH}"
    return CurrencyGraph(EXCHANGE_RATES_PATH)


def test_identity_rate(currency_graph):
    rate, path = currency_graph.get_rate_and_path("2024-01-15", "USD", "USD")
    assert rate == 1.0
    assert path == ["USD"]
    assert currency_graph.convert(100.0, "2024-01-15", "INR", "INR") == 100.0


def test_direct_rate(currency_graph):
    # On 2023-10-15: EUR -> ZAR is 20
    rate, path = currency_graph.get_rate_and_path("2023-10-15", "EUR", "ZAR")
    assert rate == pytest.approx(20.0)
    assert path == ["EUR", "ZAR"]
    assert currency_graph.convert(50.0, "2023-10-15", "EUR", "ZAR") == pytest.approx(1000.0)


def test_inverted_rate(currency_graph):
    # On 2023-10-15: ZAR -> EUR should be 1 / 20 = 0.05
    rate, path = currency_graph.get_rate_and_path("2023-10-15", "ZAR", "EUR")
    assert rate == pytest.approx(1.0 / 20.0)
    assert path == ["ZAR", "EUR"]
    assert currency_graph.convert(1000.0, "2023-10-15", "ZAR", "EUR") == pytest.approx(50.0)


def test_usd_bridge_2_hop(currency_graph):
    # On 2024-01-15: USD -> EUR is 0.92, USD -> INR is 83.33
    # INR -> EUR via USD bridge:
    # INR -> USD (1 / 83.33) * USD -> EUR (0.92) = 0.92 / 83.33
    rate, path = currency_graph.get_rate_and_path("2024-01-15", "INR", "EUR")
    expected_rate = (1.0 / 83.33) * 0.92
    assert rate == pytest.approx(expected_rate, rel=1e-5)
    assert path == ["INR", "USD", "EUR"]


def test_missing_path_raises(currency_graph):
    # On non-existent date
    with pytest.raises(KeyError):
        currency_graph.get_rate("1999-01-01", "USD", "EUR")


def test_all_foreign_events_convertible(currency_graph):
    """
    Verify that every foreign currency event in financial_events.csv can be
    successfully converted into the user's home_currency on its settlement_date.
    """
    events = pd.read_csv(EVENTS_PATH)
    profiles = pd.read_csv(PROFILES_PATH)
    merged = events.merge(profiles[["user_id", "home_currency"]], on="user_id", how="left")
    foreign_events = merged[merged["currency"] != merged["home_currency"]]

    assert len(foreign_events) > 0, "Expected some foreign currency events"

    for _, row in foreign_events.iterrows():
        event_id = row["event_id"]
        settlement_date = row["settlement_date"]
        from_curr = row["currency"]
        to_curr = row["home_currency"]

        rate, path = currency_graph.get_rate_and_path(settlement_date, from_curr, to_curr)
        assert rate is not None, f"Failed for {event_id}: {from_curr} -> {to_curr} on {settlement_date}"
        assert rate > 0
        assert path[0] == from_curr
        assert path[-1] == to_curr
