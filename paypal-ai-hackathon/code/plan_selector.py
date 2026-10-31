"""
Payment Plan Selection & 6-Tier Tie-Breaker Engine (Phase 5).
Generates candidate payment plans, applies 90-day safety validation,
ranks eligible plans using a deterministic 6-tier tie-breaker,
and produces concise, factual decision explanations.
"""

import datetime
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Literal, Optional

from models import UserFinancialContext, PaymentOption
from reconciler import ReconciledEvent
from simulator import CashFlowSimulator


# ============================================================================
# 1. CANDIDATE PLAN DATA MODEL
# ============================================================================

@dataclass
class CandidatePlan:
    """Represents a single candidate payment plan for tie-breaker ranking."""
    recommended_payment_method: Literal["full_payment", "installments", "partial_payment", "wait", "not_recommended"]
    affordability_status: Literal["affordable_now", "affordable_with_plan", "affordable_later", "not_affordable"]
    payment_plan: str                # "YYYY-MM-DD:amount|..." or "none"
    spending_changes_needed: str     # "none" or "stop:event_X|reduce_to:event_Y:amt"
    first_payment_date: str          # YYYY-MM-DD
    completion_date: str             # Final payment date YYYY-MM-DD
    total_payable_amount: float      # Total cash outlay including fees
    number_of_payments: int
    payment_option_id: str = ""      # Empty string for non-installments


# ============================================================================
# 2. AMOUNT FORMATTING UTILITIES
# ============================================================================

def format_amount(amt: float) -> str:
    """Format amount for payment_plan field.
    Integers render without decimals; fractional values render with 2 decimal places.
    Examples: 25256 -> '25256', 620.4 -> '620.40', 15952906.67 -> '15952906.67'
    """
    rounded = round(amt, 2)
    if rounded == int(rounded):
        return str(int(rounded))
    return f"{rounded:.2f}"


def format_output_number(n: float) -> str:
    """Format numeric value for output CSV with minimal decimal representation.
    Examples: 25256.0 -> '25256', 17229139.2 -> '17229139.2', 603.3 -> '603.3'
    """
    if n == int(n):
        return str(int(n))
    return str(n)


def _format_amount_display(amt: float, currency: str) -> str:
    """Format amount with currency code and thousands separators for explanations.
    Examples: (25256, 'ZAR') -> 'ZAR 25,256', (620.4, 'EUR') -> 'EUR 620.40'
    """
    if amt == int(amt):
        formatted = f"{int(amt):,}"
    else:
        formatted = f"{amt:,.2f}"
    return f"{currency} {formatted}"


def _format_date_display(date_str: str) -> str:
    """Format ISO date for human-readable display: '15 November 2019'."""
    if not date_str:
        return ""
    d = datetime.date.fromisoformat(date_str)
    return f"{d.day} {d.strftime('%B')} {d.year}"


# ============================================================================
# 3. PLAN SELECTOR ENGINE
# ============================================================================

class PlanSelector:
    """
    Payment plan selection engine.
    Evaluates all eligible candidate plans, applies 90-day safety checks,
    ranks via 6-tier deterministic tie-breaker, and generates decision explanations.
    """

    @classmethod
    def select_plan(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
    ) -> Dict:
        """
        Main entry point. Returns a dict with all output columns for a single request.

        Pipeline:
        1. Compute amount_safe_to_pay (before optional spending changes)
        2. Compute earliest_date_for_full_payment (without spending changes)
        3. Generate all eligible candidate plans
        4. Rank candidates using 6-tier tie-breaker
        5. Build output row with decision explanation
        """
        profile = context.profile
        request = context.request

        # 1. Compute amount_safe_to_pay (before spending changes)
        amount_safe = CashFlowSimulator.calculate_amount_safe_to_pay(
            context, reconciled_events
        )

        # 2. Compute earliest_date_for_full_payment (without spending changes)
        earliest = CashFlowSimulator.find_earliest_date_for_full_payment(
            context, reconciled_events
        )

        # 3. Generate all eligible candidate plans
        candidates: List[CandidatePlan] = []

        # A. Full payment candidates (with and without spending changes)
        candidates.extend(
            cls._evaluate_full_payment(context, reconciled_events, amount_safe)
        )

        # B. Installment candidates
        candidates.extend(
            cls._evaluate_installments(context, reconciled_events)
        )

        # C. Partial payment candidate
        pp = cls._evaluate_partial_payment(context, amount_safe, earliest)
        if pp is not None:
            candidates.append(pp)

        # D. Wait candidate
        wait = cls._evaluate_wait(context, earliest)
        if wait is not None:
            candidates.append(wait)

        # 4. Select winner or fallback to not_recommended
        if not candidates:
            winner = cls._make_not_recommended_plan()
        else:
            winner = cls._rank_candidates(candidates, request.desired_completion_date)
            if winner.completion_date > request.desired_completion_date:
                winner = cls._make_not_recommended_plan()

        # 5. Build output row
        return cls._build_output(
            winner, amount_safe, earliest, context, reconciled_events
        )

    @classmethod
    def _make_not_recommended_plan(cls) -> CandidatePlan:
        """Create fallback candidate when no safe on-time plan exists."""
        return CandidatePlan(
            recommended_payment_method="not_recommended",
            affordability_status="not_affordable",
            payment_plan="none",
            spending_changes_needed="none",
            first_payment_date="9999-12-31",
            completion_date="9999-12-31",
            total_payable_amount=float("inf"),
            number_of_payments=0,
            payment_option_id="",
        )

    # ------------------------------------------------------------------
    # A. FULL PAYMENT EVALUATOR
    # ------------------------------------------------------------------

    @classmethod
    def _evaluate_full_payment(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
        amount_safe: float,
    ) -> List[CandidatePlan]:
        """
        Evaluate full payment on request_date:
        - Scenario 1: Without spending changes → affordable_now
        - Scenario 2: With spending changes → affordable_with_plan (NOT affordable_now)
        """
        candidates: List[CandidatePlan] = []
        profile = context.profile
        request = context.request

        if "full_payment" not in profile.payment_methods_user_will_consider:
            return candidates

        req_date = request.request_date
        req_amt = request.requested_amount
        min_keep = profile.minimum_balance_to_keep
        plan_debits = {req_date: req_amt}

        # Scenario 1: No spending changes
        bals = CashFlowSimulator.simulate_daily_balances(
            context=context,
            reconciled_events=reconciled_events,
            additional_debits=plan_debits,
        )
        if CashFlowSimulator.is_plan_safe(bals, min_keep):
            candidates.append(CandidatePlan(
                recommended_payment_method="full_payment",
                affordability_status="affordable_now",
                payment_plan=f"{req_date}:{format_amount(req_amt)}",
                spending_changes_needed="none",
                first_payment_date=req_date,
                completion_date=req_date,
                total_payable_amount=req_amt,
                number_of_payments=1,
            ))
        else:
            # Scenario 2: With spending changes
            changes = CashFlowSimulator.find_spending_changes_needed(
                context, reconciled_events, plan_debits
            )
            if changes is not None and changes != "none":
                candidates.append(CandidatePlan(
                    recommended_payment_method="full_payment",
                    affordability_status="affordable_with_plan",
                    payment_plan=f"{req_date}:{format_amount(req_amt)}",
                    spending_changes_needed=changes,
                    first_payment_date=req_date,
                    completion_date=req_date,
                    total_payable_amount=req_amt,
                    number_of_payments=1,
                ))

        return candidates

    # ------------------------------------------------------------------
    # B. INSTALLMENT EVALUATOR
    # ------------------------------------------------------------------

    @classmethod
    def _evaluate_installments(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
    ) -> List[CandidatePlan]:
        """
        Evaluate installment candidates from request_payment_options.csv.
        For each viable option, tries without spending changes first,
        then with spending changes if needed.
        """
        candidates: List[CandidatePlan] = []
        profile = context.profile
        request = context.request

        if "installments" not in profile.payment_methods_user_will_consider:
            return candidates

        desired_completion = datetime.date.fromisoformat(request.desired_completion_date)
        min_keep = profile.minimum_balance_to_keep

        for option in context.payment_options:
            if option.payment_method != "installments":
                continue

            # Duration filter: max_installment_months constraint
            if (
                profile.max_installment_months is not None
                and option.payment_frequency_days is not None
            ):
                duration_months = (
                    (option.number_of_payments - 1) * option.payment_frequency_days / 30.0
                )
                if duration_months > profile.max_installment_months:
                    continue

            # Build payment schedule
            first_date = datetime.date.fromisoformat(option.first_payment_date)
            freq_days = option.payment_frequency_days or 30

            dates: List[datetime.date] = []
            schedule: Dict[str, float] = {}
            for k in range(option.number_of_payments):
                pay_date = first_date + datetime.timedelta(days=k * freq_days)
                dates.append(pay_date)
                date_str = pay_date.isoformat()
                schedule[date_str] = schedule.get(date_str, 0) + option.payment_amount

            last_payment_date = dates[-1]

            # Must complete all payments on or before desired_completion_date
            if last_payment_date > desired_completion:
                continue

            # Build plan string
            plan_parts = [
                f"{d.isoformat()}:{format_amount(option.payment_amount)}"
                for d in dates
            ]
            plan_str = "|".join(plan_parts)

            # Scenario 1: Without spending changes
            bals = CashFlowSimulator.simulate_daily_balances(
                context=context,
                reconciled_events=reconciled_events,
                additional_debits=schedule,
            )
            if CashFlowSimulator.is_plan_safe(bals, min_keep):
                candidates.append(CandidatePlan(
                    recommended_payment_method="installments",
                    affordability_status="affordable_with_plan",
                    payment_plan=plan_str,
                    spending_changes_needed="none",
                    first_payment_date=first_date.isoformat(),
                    completion_date=last_payment_date.isoformat(),
                    total_payable_amount=option.total_payable_amount,
                    number_of_payments=option.number_of_payments,
                    payment_option_id=option.payment_option_id,
                ))
            else:
                # Scenario 2: With spending changes
                changes = CashFlowSimulator.find_spending_changes_needed(
                    context, reconciled_events, schedule
                )
                if changes is not None and changes != "none":
                    candidates.append(CandidatePlan(
                        recommended_payment_method="installments",
                        affordability_status="affordable_with_plan",
                        payment_plan=plan_str,
                        spending_changes_needed=changes,
                        first_payment_date=first_date.isoformat(),
                        completion_date=last_payment_date.isoformat(),
                        total_payable_amount=option.total_payable_amount,
                        number_of_payments=option.number_of_payments,
                        payment_option_id=option.payment_option_id,
                    ))

        return candidates

    # ------------------------------------------------------------------
    # C. PARTIAL PAYMENT EVALUATOR
    # ------------------------------------------------------------------

    @classmethod
    def _evaluate_partial_payment(
        cls,
        context: UserFinancialContext,
        amount_safe: float,
        earliest: Optional[str],
    ) -> Optional[CandidatePlan]:
        """
        Evaluate partial payment candidate.
        Eligible ONLY IF ALL 5 conditions hold:
        1. request.allows_partial_payment is True
        2. 'partial_payment' in profile.payment_methods_user_will_consider
        3. 0.0 < amount_safe_to_pay < requested_amount
        4. earliest_date_for_full_payment is not None
        5. earliest_date_for_full_payment <= desired_completion_date

        Spending changes are NOT evaluated for partial_payment.
        affordability_status is always 'affordable_with_plan'.
        """
        profile = context.profile
        request = context.request

        # Check all 5 conditions
        if not request.allows_partial_payment:
            return None
        if "partial_payment" not in profile.payment_methods_user_will_consider:
            return None
        if not (0.0 < amount_safe < request.requested_amount):
            return None
        if earliest is None:
            return None
        if earliest > request.desired_completion_date:
            return None

        req_date = request.request_date
        req_amt = request.requested_amount
        remaining = round(req_amt - amount_safe, 2)

        plan_str = (
            f"{req_date}:{format_amount(amount_safe)}"
            f"|{earliest}:{format_amount(remaining)}"
        )

        return CandidatePlan(
            recommended_payment_method="partial_payment",
            affordability_status="affordable_with_plan",
            payment_plan=plan_str,
            spending_changes_needed="none",
            first_payment_date=req_date,
            completion_date=earliest,
            total_payable_amount=req_amt,
            number_of_payments=2,
        )

    # ------------------------------------------------------------------
    # D. WAIT EVALUATOR
    # ------------------------------------------------------------------

    @classmethod
    def _evaluate_wait(
        cls,
        context: UserFinancialContext,
        earliest: Optional[str],
    ) -> Optional[CandidatePlan]:
        """
        Evaluate wait candidate.
        Eligible ONLY IF:
        1. earliest_date_for_full_payment is not None
        2. earliest_date_for_full_payment > request_date  (becomes safe LATER)
        3. 'full_payment' in profile.payment_methods_user_will_consider

        affordability_status is always 'affordable_later'.
        """
        profile = context.profile
        request = context.request

        if earliest is None:
            return None
        if earliest <= request.request_date:
            return None
        if "full_payment" not in profile.payment_methods_user_will_consider:
            return None

        req_amt = request.requested_amount

        return CandidatePlan(
            recommended_payment_method="wait",
            affordability_status="affordable_later",
            payment_plan=f"{earliest}:{format_amount(req_amt)}",
            spending_changes_needed="none",
            first_payment_date=earliest,
            completion_date=earliest,
            total_payable_amount=req_amt,
            number_of_payments=1,
        )

    # ------------------------------------------------------------------
    # 6-TIER TIE-BREAKER RANKING
    # ------------------------------------------------------------------

    @classmethod
    def _rank_candidates(
        cls,
        candidates: List[CandidatePlan],
        desired_completion_date: str,
    ) -> CandidatePlan:
        """
        When multiple eligible plans pass the 90-day safety check,
        select the winner using a Python tuple sort key:

        key = (
            0 if completion <= desired else 1,   # Tier 1: On-time completion
            0 if no spending changes else 1,     # Tier 2: No spending changes
            round(total_payable_amount, 2),      # Tier 3: Min total cash outlay
            first_payment_date,                  # Tier 4: Earliest first payment
            number_of_payments,                  # Tier 5: Fewest payments
            payment_option_id or ""              # Tier 6: Lowest option ID
        )
        """
        def sort_key(p: CandidatePlan):
            return (
                0 if p.completion_date <= desired_completion_date else 1,
                0 if p.spending_changes_needed == "none" else 1,
                round(p.total_payable_amount, 2),
                p.first_payment_date,
                p.number_of_payments,
                p.payment_option_id or "",
            )

        return sorted(candidates, key=sort_key)[0]

    # ------------------------------------------------------------------
    # OUTPUT BUILDER
    # ------------------------------------------------------------------

    @classmethod
    def _build_output(
        cls,
        winner: CandidatePlan,
        amount_safe: float,
        earliest: Optional[str],
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
    ) -> Dict:
        """Build the complete output row dictionary."""
        explanation = cls._generate_explanation(
            winner, amount_safe, earliest, context, reconciled_events
        )

        return {
            "request_id": context.request.request_id,
            "amount_safe_to_pay": amount_safe,
            "affordability_status": winner.affordability_status,
            "recommended_payment_method": winner.recommended_payment_method,
            "payment_plan": winner.payment_plan,
            "earliest_date_for_full_payment": earliest if earliest else "",
            "spending_changes_needed": winner.spending_changes_needed,
            "decision_explanation": explanation,
        }

    # ------------------------------------------------------------------
    # DECISION EXPLANATION GENERATOR
    # ------------------------------------------------------------------

    @classmethod
    def _generate_explanation(
        cls,
        winner: CandidatePlan,
        amount_safe: float,
        earliest: Optional[str],
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
    ) -> str:
        """
        Produce concise, factual explanation referencing:
        amount, dates, minimum balance buffer preserved, spending changes if required.
        """
        profile = context.profile
        request = context.request
        currency = profile.home_currency
        req_amt = request.requested_amount
        min_keep = profile.minimum_balance_to_keep
        desired = request.desired_completion_date

        req_amt_display = _format_amount_display(req_amt, currency)
        min_keep_display = _format_amount_display(min_keep, currency)

        method = winner.recommended_payment_method

        # ----- not_recommended -----
        if method == "not_recommended":
            if amount_safe > 0 and earliest is None:
                safe_display = _format_amount_display(amount_safe, currency)
                return (
                    f"Do not proceed with the {req_amt_display} request. "
                    f"Although {safe_display} is available today, the full amount "
                    f"cannot be completed safely within 90 days."
                )
            date_display = _format_date_display(desired)
            return (
                f"Do not make this payment by {date_display}. "
                f"None of the available options keeps the "
                f"{min_keep_display} minimum protected."
            )

        # ----- full_payment -----
        if method == "full_payment":
            if winner.affordability_status == "affordable_now":
                return (
                    f"Pay {req_amt_display} today. This keeps the "
                    f"{min_keep_display} minimum available over the next 90 days."
                )
            # affordable_with_plan (spending changes required)
            changes_desc = cls._describe_spending_changes(
                winner.spending_changes_needed, reconciled_events, currency
            )
            return (
                f"{changes_desc}, then pay {req_amt_display} today. "
                f"This leaves at least {min_keep_display} available."
            )

        # ----- installments -----
        if method == "installments":
            parts = winner.payment_plan.split("|")
            pay_amt_str = parts[0].split(":")[1]
            pay_amt = float(pay_amt_str)
            pay_amt_display = _format_amount_display(pay_amt, currency)
            first_date_display = _format_date_display(winner.first_payment_date)
            n = winner.number_of_payments

            if winner.spending_changes_needed != "none":
                changes_desc = cls._describe_spending_changes(
                    winner.spending_changes_needed, reconciled_events, currency
                )
                return (
                    f"{changes_desc}, then use {n} installments of "
                    f"{pay_amt_display}, starting {first_date_display}. "
                    f"This leaves at least {min_keep_display} available."
                )
            return (
                f"Use {n} installments of {pay_amt_display}, "
                f"starting {first_date_display}. This leaves at least "
                f"{min_keep_display} available."
            )

        # ----- partial_payment -----
        if method == "partial_payment":
            parts = winner.payment_plan.split("|")
            first_amt = float(parts[0].split(":")[1])
            second_date_str = parts[1].split(":")[0]
            second_amt = float(parts[1].split(":")[1])
            first_display = _format_amount_display(first_amt, currency)
            second_display = _format_amount_display(second_amt, currency)
            date_display = _format_date_display(second_date_str)
            return (
                f"Pay {first_display} today and the remaining "
                f"{second_display} on {date_display}. This completes the "
                f"full request and keeps the {min_keep_display} minimum protected."
            )

        # ----- wait -----
        if method == "wait":
            date_display = _format_date_display(earliest)
            return (
                f"Pay {req_amt_display} in full on {date_display}. "
                f"Paying earlier would take the balance below the "
                f"{min_keep_display} minimum."
            )

        return ""

    @classmethod
    def _describe_spending_changes(
        cls,
        changes: str,
        reconciled_events: List[ReconciledEvent],
        currency: str,
    ) -> str:
        """Describe spending changes in human-readable text for explanations."""
        events_by_id = {e.event_id: e for e in reconciled_events}
        parts = changes.split("|")
        descriptions: List[str] = []

        for part in parts:
            part = part.strip()
            if part.startswith("stop:"):
                eid = part[5:]
                evt = events_by_id.get(eid)
                desc = evt.description.lower() if evt else eid
                descriptions.append(f"Stop the {desc}")
            elif part.startswith("reduce_to:"):
                segments = part.split(":")
                eid = segments[1]
                new_amt = float(segments[2])
                evt = events_by_id.get(eid)
                desc = evt.description.lower() if evt else eid
                amt_display = _format_amount_display(new_amt, currency)
                descriptions.append(f"Reduce the {desc} to {amt_display}")

        return " and ".join(descriptions) if descriptions else ""
