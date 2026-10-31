"""
Manual Currency Conversion Verification Script.
Run this script to manually inspect rates, paths, and real event conversions against dataset/exchange_rates.csv.
"""

import sys
from pathlib import Path

# Add project root and code directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "code"))

import pandas as pd
from currency import CurrencyGraph

DATASET_DIR = PROJECT_ROOT / "dataset"
EXCHANGE_RATES_CSV = DATASET_DIR / "exchange_rates.csv"
EVENTS_CSV = DATASET_DIR / "financial_events.csv"
PROFILES_CSV = DATASET_DIR / "financial_profiles.csv"


def run_manual_test():
    print("=" * 70)
    print("MANUAL CURRENCY CONVERSION VERIFICATION TEST")
    print("=" * 70)

    cg = CurrencyGraph(EXCHANGE_RATES_CSV)
    rates_raw = pd.read_csv(EXCHANGE_RATES_CSV)

    # -------------------------------------------------------------
    # Test 1: Direct Rate Lookup
    # -------------------------------------------------------------
    print("\n[TEST 1] DIRECT RATE LOOKUP")
    date_1 = "2024-01-15"
    from_1, to_1 = "USD", "INR"
    amount_1 = 100.0
    rate_1, path_1 = cg.get_rate_and_path(date_1, from_1, to_1)
    converted_1 = cg.convert(amount_1, date_1, from_1, to_1)

    csv_row_1 = rates_raw[
        (rates_raw["rate_date"] == date_1)
        & (rates_raw["from_currency"] == from_1)
        & (rates_raw["to_currency"] == to_1)
    ]
    raw_rate_1 = csv_row_1["rate"].values[0] if not csv_row_1.empty else None

    print(f"  Input: {amount_1} {from_1} -> {to_1} on {date_1}")
    print(f"  Calculated Rate:  {rate_1}")
    print(f"  Path Traversed:   {' -> '.join(path_1)}")
    print(f"  Converted Amount: {converted_1:,.2f} {to_1}")
    print(f"  Dataset CSV Rate: {raw_rate_1}")
    print(f"  Match?: {'YES' if abs(rate_1 - raw_rate_1) < 1e-6 else 'NO'}")

    # -------------------------------------------------------------
    # Test 2: Inverted Rate (Reverse of CSV row)
    # -------------------------------------------------------------
    print("\n[TEST 2] INVERTED RATE (Reverse Pair in CSV)")
    date_2 = "2023-10-15"
    from_2, to_2 = "ZAR", "EUR"
    amount_2 = 1000.0
    rate_2, path_2 = cg.get_rate_and_path(date_2, from_2, to_2)
    converted_2 = cg.convert(amount_2, date_2, from_2, to_2)

    # Check inverse row in CSV: EUR -> ZAR
    csv_row_2 = rates_raw[
        (rates_raw["rate_date"] == date_2)
        & (rates_raw["from_currency"] == to_2)
        & (rates_raw["to_currency"] == from_2)
    ]
    raw_rate_2 = csv_row_2["rate"].values[0] if not csv_row_2.empty else None
    expected_inverted_rate = 1.0 / raw_rate_2 if raw_rate_2 else None

    print(f"  Input: {amount_2} {from_2} -> {to_2} on {date_2}")
    print(f"  Calculated Rate:  {rate_2:.6f}")
    print(f"  Path Traversed:   {' -> '.join(path_2)}")
    print(f"  Converted Amount: {converted_2:,.2f} {to_2}")
    print(f"  Dataset CSV row:  {to_2} -> {from_2} is {raw_rate_2} (No direct {from_2}->{to_2} in CSV)")
    print(f"  Expected (1 / {raw_rate_2}): {expected_inverted_rate:.6f}")
    print(f"  Match?: {'YES' if abs(rate_2 - expected_inverted_rate) < 1e-6 else 'NO'}")

    # -------------------------------------------------------------
    # Test 3: 2-Hop Chaining via USD Bridge
    # -------------------------------------------------------------
    print("\n[TEST 3] 2-HOP CHAINING (Via USD Bridge)")
    date_3 = "2024-01-15"
    from_3, to_3 = "INR", "EUR"
    amount_3 = 8333.0
    rate_3, path_3 = cg.get_rate_and_path(date_3, from_3, to_3)
    converted_3 = cg.convert(amount_3, date_3, from_3, to_3)

    # Step 1: INR -> USD = 1 / (USD -> INR: 83.33)
    # Step 2: USD -> EUR = 0.92
    r_usd_inr = rates_raw[(rates_raw["rate_date"] == date_3) & (rates_raw["from_currency"] == "USD") & (rates_raw["to_currency"] == "INR")]["rate"].values[0]
    r_usd_eur = rates_raw[(rates_raw["rate_date"] == date_3) & (rates_raw["from_currency"] == "USD") & (rates_raw["to_currency"] == "EUR")]["rate"].values[0]
    expected_chained_rate = (1.0 / r_usd_inr) * r_usd_eur

    print(f"  Input: {amount_3} {from_3} -> {to_3} on {date_3}")
    print(f"  Calculated Rate:  {rate_3:.8f}")
    print(f"  Path Traversed:   {' -> '.join(path_3)} (Hops: {len(path_3)-1})")
    print(f"  Converted Amount: {converted_3:,.2f} {to_3}")
    print(f"  Math: (1 / USD->INR: {r_usd_inr}) * (USD->EUR: {r_usd_eur}) = {expected_chained_rate:.8f}")
    print(f"  Match?: {'YES' if abs(rate_3 - expected_chained_rate) < 1e-6 else 'NO'}")

    # -------------------------------------------------------------
    # Test 4: Real Dataset Financial Event Conversion
    # -------------------------------------------------------------
    print("\n[TEST 4] REAL DATASET EVENT CONVERSION")
    events = pd.read_csv(EVENTS_CSV)
    profiles = pd.read_csv(PROFILES_CSV)
    merged = events.merge(profiles[["user_id", "home_currency"]], on="user_id", how="left")
    sample_event = merged[merged["currency"] != merged["home_currency"]].iloc[0]

    evt_id = sample_event["event_id"]
    u_id = sample_event["user_id"]
    evt_amt = float(sample_event["amount"])
    evt_curr = sample_event["currency"]
    home_curr = sample_event["home_currency"]
    settle_date = sample_event["settlement_date"]

    evt_rate, evt_path = cg.get_rate_and_path(settle_date, evt_curr, home_curr)
    evt_converted = cg.convert(evt_amt, settle_date, evt_curr, home_curr)

    print(f"  Event: {evt_id} | User: {u_id}")
    print(f"  Original Amount:  {evt_amt:,.2f} {evt_curr}")
    print(f"  User Home Curr:   {home_curr}")
    print(f"  Settlement Date:  {settle_date}")
    print(f"  Rate:             {evt_rate}")
    print(f"  Path:             {' -> '.join(evt_path)}")
    print(f"  Converted Amount: {evt_converted:,.2f} {home_curr}")

    # -------------------------------------------------------------
    # Test 5: Reciprocal Invariant (Round-Trip Rate Check)
    # -------------------------------------------------------------
    print("\n[TEST 5] RECIPROCAL INVARIANT CHECK (A -> B -> A)")
    forward_rate = cg.get_rate(date_3, from_3, to_3)
    backward_rate = cg.get_rate(date_3, to_3, from_3)
    round_trip = forward_rate * backward_rate

    print(f"  Forward  ({from_3} -> {to_3}):  {forward_rate:.8f}")
    print(f"  Backward ({to_3} -> {from_3}):  {backward_rate:.8f}")
    print(f"  Product (Forward * Backward): {round_trip:.8f} (Expected: 1.00000000)")
    print(f"  Invariant Holds?: {'YES' if abs(round_trip - 1.0) < 1e-5 else 'NO'}")

    print("\n" + "=" * 70)
    print("ALL MANUAL TESTS COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    run_manual_test()
