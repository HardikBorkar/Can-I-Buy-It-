"""
Deterministic Financial Safety Invariant Rules for Guardian Copilot.
Enforces the sacred minimum safety buffer floor across all spending decisions.
"""

from typing import Any, Dict, Literal


def evaluate_spend_invariant(
    amount: float,
    available_balance: float = 1850.0,
    safety_floor: float = 500.0,
    lowest_projected_dip: float = 590.0,
) -> Dict[str, Any]:
    """
    Evaluates whether a purchase is safe to pay in full, requires PayPal Pay in 4,
    or must be declined to prevent breaching the safety reserve floor.

    Args:
        amount: Purchase dollar amount.
        available_balance: Current live checking balance.
        safety_floor: Minimum reserve floor (default: $500.00).
        lowest_projected_dip: Lowest liquid cash dip during billing cycle post-rent.
    """
    if amount <= 0:
        raise ValueError("Amount must be greater than zero")

    lowest_dip_full = round(lowest_projected_dip - amount, 2)
    safe_in_full = lowest_dip_full >= safety_floor

    installment_1 = round(amount / 4.0, 2)
    lowest_dip_pay_in_4 = round(lowest_projected_dip - installment_1, 2)
    pay_in_4_eligible = 30.0 <= amount <= 1500.0
    pay_in_4_safe = pay_in_4_eligible and (lowest_dip_pay_in_4 >= safety_floor)

    if safe_in_full:
        recommendation: Literal["PAY_IN_FULL", "PAY_IN_4", "DECLINE_UNSAFE"] = "PAY_IN_FULL"
        risk_score = 98
    elif pay_in_4_safe:
        recommendation = "PAY_IN_4"
        risk_score = 92
    else:
        recommendation = "DECLINE_UNSAFE"
        risk_score = 55

    return {
        "amount": amount,
        "available_balance": available_balance,
        "safety_floor": safety_floor,
        "safe_in_full": safe_in_full,
        "lowest_dip_full": lowest_dip_full,
        "pay_in_4_eligible": pay_in_4_eligible,
        "pay_in_4_safe": pay_in_4_safe,
        "lowest_dip_pay_in_4": lowest_dip_pay_in_4,
        "installment_amount": installment_1,
        "recommendation": recommendation,
        "risk_score": risk_score,
        "buffer_intact": safe_in_full or pay_in_4_safe,
    }

