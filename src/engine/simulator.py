"""
90-Day Rolling Cash Flow Simulator and Spending Rescue Optimizer (Phase 4).
Forecasts daily checking account balances using Decimal arithmetic,
enforces 90-day safety invariants against user minimum balance thresholds,
projects recurring income and expenses forward, and computes minimal
combinatorial spending adjustments.
"""

import calendar
import datetime
from decimal import Decimal, ROUND_HALF_UP
import itertools
from typing import Any, Dict, List, Optional, Set, Tuple, Union

try:
    from .models import UserFinancialContext
    from .reconciler import ReconciledEvent
except ImportError:
    from models import UserFinancialContext
    from reconciler import ReconciledEvent


class CashFlowSimulator:
    """
    Deterministic cash flow simulation engine.
    Maintains Decimal internally for running accumulators and returns
    standards-compliant floats on boundary interfaces.
    """

    LOOKBACK_DAYS: int = 45

    @classmethod
    def get_active_recurring_events(
        cls,
        reconciled_events: List[ReconciledEvent],
        request_date: datetime.date,
        lookback_days: Optional[int] = None,
    ) -> List[ReconciledEvent]:
        """
        Identifies active recurring expenses and salary from reconciled events.
        Picks the latest occurrence of each recurring commitment that settled
        within the lookback window prior to request_date.
        """
        if lookback_days is None:
            lookback_days = cls.LOOKBACK_DAYS

        cutoff = request_date - datetime.timedelta(days=lookback_days)
        candidates = [
            e for e in reconciled_events
            if e.is_recurring and e.is_cash_flow and e.settlement_date
            and cutoff <= datetime.date.fromisoformat(e.settlement_date) <= request_date
        ]

        # 1. Salary resolution:
        # Check if there is a confirmed future salary on or after request_date
        future_salaries = [
            e for e in reconciled_events
            if e.category == "salary" and e.is_cash_flow and e.settlement_date
            and datetime.date.fromisoformat(e.settlement_date) >= request_date
        ]
        past_salaries = [
            e for e in reconciled_events
            if e.category == "salary" and e.is_cash_flow and e.settlement_date
            and datetime.date.fromisoformat(e.settlement_date) <= request_date
        ]

        # Filter out terminated/previous employer salaries
        valid_past_sal = [
            e for e in past_salaries
            if "final" not in e.description.lower()
            and "previous" not in e.description.lower()
            and "terminated" not in e.description.lower()
            and "leave" not in e.description.lower()
        ]

        active_salary: Optional[ReconciledEvent] = None
        if future_salaries:
            # Earliest confirmed future regular salary
            reg_future = [e for e in future_salaries if "arrears" not in e.description.lower()]
            active_salary = min(reg_future if reg_future else future_salaries, key=lambda x: x.settlement_date)
        elif valid_past_sal:
            # Prefer regular salary over prorated first salary if both exist
            reg_past = [e for e in valid_past_sal if "prorated" not in e.description.lower() and "first" not in e.description.lower()]
            active_salary = max(reg_past if reg_past else valid_past_sal, key=lambda x: x.settlement_date)

        # 2. Recurring expenses resolution:
        # Deduplicate recurring expenses by commitment key (category, description, direction),
        # picking the latest settled instance as the active representative
        latest_non_sal: Dict[Tuple[str, str, str], ReconciledEvent] = {}
        for e in candidates:
            if e.category == "salary":
                continue
            key = (e.category, e.description, e.direction)
            if key not in latest_non_sal or (e.settlement_date and latest_non_sal[key].settlement_date and e.settlement_date > latest_non_sal[key].settlement_date):
                latest_non_sal[key] = e

        valid: List[ReconciledEvent] = list(latest_non_sal.values())
        if active_salary:
            valid.append(active_salary)

        return valid

    @classmethod
    def project_recurring_events(
        cls,
        active_events: List[ReconciledEvent],
        request_date: datetime.date,
        forecast_days: int = 90,
        existing_future_events: Optional[List[ReconciledEvent]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Projects active recurring expenses and income forward across the forecast window
        [request_date, request_date + forecast_days] according to their monthly schedule.
        Each projected instance references the originating event_id.
        """
        end_date = request_date + datetime.timedelta(days=forecast_days)
        existing_slots: Set[Tuple[datetime.date, str, str]] = set()

        if existing_future_events:
            for fe in existing_future_events:
                if fe.settlement_date and fe.is_cash_flow:
                    f_date = datetime.date.fromisoformat(fe.settlement_date)
                    existing_slots.add((f_date, fe.category, fe.direction))

        projected: List[Dict[str, Any]] = []

        for e in active_events:
            if not e.settlement_date:
                continue
            orig_date = datetime.date.fromisoformat(e.settlement_date)
            orig_dom = orig_date.day

            cur_year = request_date.year
            cur_month = request_date.month

            # Walk through up to 5 months to span 90+ days
            for _ in range(5):
                max_day = calendar.monthrange(cur_year, cur_month)[1]
                proj_day = min(orig_dom, max_day)
                proj_date = datetime.date(cur_year, cur_month, proj_day)

                if request_date <= proj_date <= end_date:
                    if (proj_date, e.category, e.direction) not in existing_slots:
                        projected.append({
                            "date": proj_date,
                            "originating_event_id": e.event_id,
                            "event": e,
                        })

                if cur_month == 12:
                    cur_year += 1
                    cur_month = 1
                else:
                    cur_month += 1

                if datetime.date(cur_year, cur_month, 1) > end_date:
                    break

        return projected

    @classmethod
    def simulate_daily_balances(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
        start_date: Optional[Union[str, datetime.date]] = None,
        days: int = 90,
        additional_debits: Optional[Dict[str, float]] = None,
        active_spending_changes: Optional[List[str]] = None,
    ) -> Dict[str, float]:
        """
        Simulate daily closing checking account balances for [start_date, start_date + days].
        Uses Decimal accumulators quantized to 2 decimal places with ROUND_HALF_UP.

        active_spending_changes:
          - 'stop:<event_id>': omits all future debits originating from event_id
          - 'reduce_to:<event_id>:<amount>': caps future debits originating from event_id
        """
        if start_date is None:
            req_d = datetime.date.fromisoformat(context.request.request_date)
        elif isinstance(start_date, str):
            req_d = datetime.date.fromisoformat(start_date)
        else:
            req_d = start_date

        end_date = req_d + datetime.timedelta(days=days)

        # Parse spending changes
        stop_ids: Set[str] = set()
        reduce_map: Dict[str, Decimal] = {}
        if active_spending_changes:
            for chg in active_spending_changes:
                chg = chg.strip()
                if chg.startswith("stop:"):
                    stop_ids.add(chg[5:].strip())
                elif chg.startswith("reduce_to:"):
                    parts = chg.split(":")
                    if len(parts) == 3:
                        reduce_map[parts[1].strip()] = Decimal(parts[2].strip())

        # Collect actual future events already in dataset
        actual_in_window: List[ReconciledEvent] = []
        for e in reconciled_events:
            if e.is_cash_flow and e.settlement_date:
                e_date = datetime.date.fromisoformat(e.settlement_date)
                if req_d <= e_date <= end_date:
                    actual_in_window.append(e)

        # Identify active recurring commitments and project them forward
        active_rec = cls.get_active_recurring_events(reconciled_events, req_d)
        projected = cls.project_recurring_events(active_rec, req_d, days, actual_in_window)

        # Group daily items: Dict[date, List[Tuple[amount_dec, direction, event_id]]]
        daily_items: Dict[datetime.date, List[Tuple[Decimal, str, str]]] = {}
        cur = req_d
        while cur <= end_date:
            daily_items[cur] = []
            cur += datetime.timedelta(days=1)

        # Add actual future events
        for e in actual_in_window:
            e_date = datetime.date.fromisoformat(e.settlement_date)
            amt_dec = Decimal(str(e.amount_home))
            daily_items[e_date].append((amt_dec, e.direction, e.event_id))

        # Add projected recurring events
        for p in projected:
            p_date = p["date"]
            e = p["event"]
            orig_id = p["originating_event_id"]
            amt_dec = Decimal(str(e.amount_home))
            daily_items[p_date].append((amt_dec, e.direction, orig_id))

        # Run simulation with Decimal balance
        balance = Decimal(str(context.profile.current_available_balance))
        daily_balances: Dict[str, float] = {}

        cur = req_d
        while cur <= end_date:
            items = daily_items[cur]

            # Credits processed first on settlement day
            for amt, direction, eid in items:
                if direction == "credit":
                    balance += amt

            # Debits processed
            for amt, direction, eid in items:
                if direction == "debit":
                    if eid in stop_ids:
                        continue
                    if eid in reduce_map:
                        capped = reduce_map[eid]
                        amt = min(amt, capped)
                    balance -= amt

            # Additional scheduled debits (proposed payment or installments)
            cur_str = cur.isoformat()
            if additional_debits and cur_str in additional_debits:
                add_amt = Decimal(str(additional_debits[cur_str]))
                balance -= add_amt

            quantized = balance.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            daily_balances[cur_str] = float(quantized)

            cur += datetime.timedelta(days=1)

        return daily_balances

    @classmethod
    def is_plan_safe(
        cls,
        daily_balances: Dict[str, float],
        minimum_balance_to_keep: float,
    ) -> bool:
        """
        Returns True iff every daily closing balance >= minimum_balance_to_keep.
        """
        min_keep_dec = Decimal(str(minimum_balance_to_keep))
        for date_str, bal in daily_balances.items():
            if Decimal(str(bal)) < min_keep_dec:
                return False
        return True

    @classmethod
    def calculate_amount_safe_to_pay(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
        days: int = 90,
    ) -> float:
        """
        Computes amount_safe_to_pay on request_date before optional spending changes.
        Strictly enforces: 0.0 <= amount_safe_to_pay <= requested_amount.
        Formula: min(requested_amount, max(0.0, min_surplus))
        """
        daily_bals = cls.simulate_daily_balances(
            context=context,
            reconciled_events=reconciled_events,
            days=days,
        )
        min_keep_dec = Decimal(str(context.profile.minimum_balance_to_keep))
        lowest_bal_dec = min(Decimal(str(bal)) for bal in daily_bals.values())
        min_surplus_dec = lowest_bal_dec - min_keep_dec

        req_amt_dec = Decimal(str(context.request.requested_amount))
        safe_amt_dec = min(req_amt_dec, max(Decimal("0.00"), min_surplus_dec))

        return float(safe_amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    @classmethod
    def find_earliest_date_for_full_payment(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
        days: int = 90,
    ) -> Optional[str]:
        """
        Scans calendar dates d in [request_date, request_date + days] to find the earliest
        date when paying the full requested_amount in a single payment keeps all daily
        balances >= minimum_balance_to_keep throughout the forecast period.
        Returns ISO-8601 date string, or None if no safe date exists within the window.
        """
        req_d = datetime.date.fromisoformat(context.request.request_date)
        req_amt = context.request.requested_amount
        min_keep = context.profile.minimum_balance_to_keep

        # If already safe today on request_date:
        today_safe = cls.calculate_amount_safe_to_pay(context, reconciled_events, days)
        if today_safe >= req_amt:
            return req_d.isoformat()

        end_date = req_d + datetime.timedelta(days=days)
        cur = req_d
        while cur <= end_date:
            cur_str = cur.isoformat()
            test_debit = {cur_str: req_amt}
            bals = cls.simulate_daily_balances(
                context=context,
                reconciled_events=reconciled_events,
                start_date=req_d,
                days=days,
                additional_debits=test_debit,
            )
            if cls.is_plan_safe(bals, min_keep):
                return cur_str
            cur += datetime.timedelta(days=1)

        return None

    @classmethod
    def find_spending_changes_needed(
        cls,
        context: UserFinancialContext,
        reconciled_events: List[ReconciledEvent],
        candidate_plan_debits: Optional[Dict[str, float]] = None,
        days: int = 90,
    ) -> Optional[str]:
        """
        Finds minimal combination of spending changes (up to 3) to rescue a breached plan.
        Searches length 1, 2, then 3 combinations.
        Enforces mutual exclusivity: no event_id can appear in both stop and reduce_to.
        Returns pipe-separated changes string (e.g. 'stop:event_476'), 'none', or None.
        """
        min_keep = context.profile.minimum_balance_to_keep

        # If no debits provided, evaluate full payment on request_date
        if candidate_plan_debits is None:
            candidate_plan_debits = {context.request.request_date: context.request.requested_amount}

        # Check if already safe without spending changes
        base_bals = cls.simulate_daily_balances(
            context=context,
            reconciled_events=reconciled_events,
            days=days,
            additional_debits=candidate_plan_debits,
        )
        if cls.is_plan_safe(base_bals, min_keep):
            return "none"

        # Gather eligible spending change actions from active recurring events
        req_d = datetime.date.fromisoformat(context.request.request_date)
        active_rec = cls.get_active_recurring_events(reconciled_events, req_d)

        candidate_actions: List[Tuple[str, str, float]] = []  # (action_str, event_id, cash_saving)
        for e in active_rec:
            if e.direction != "debit":
                continue
            if e.is_stoppable:
                candidate_actions.append((f"stop:{e.event_id}", e.event_id, e.amount_home))
            if e.is_reducible and e.minimum_allowed_amount is not None:
                saving = max(0.0, e.amount_home - e.minimum_allowed_amount)
                min_amt = e.minimum_allowed_amount
                amt_str = f"{min_amt:.2f}" if (min_amt * 100) % 100 != 0 else (
                    f"{int(min_amt)}" if min_amt == int(min_amt) else f"{min_amt:.2f}"
                )
                candidate_actions.append((f"reduce_to:{e.event_id}:{amt_str}", e.event_id, saving))

        if not candidate_actions:
            return None

        # Search combinations of size 1, 2, 3
        valid_plans: List[Tuple[int, float, List[str]]] = []

        for r in range(1, min(4, len(candidate_actions) + 1)):
            for combo in itertools.combinations(candidate_actions, r):
                eids = [act[1] for act in combo]
                # Mutual exclusivity check: each event_id changed at most once
                if len(eids) != len(set(eids)):
                    continue

                action_strs = [act[0] for act in combo]
                total_reduction = sum(act[2] for act in combo)

                bals = cls.simulate_daily_balances(
                    context=context,
                    reconciled_events=reconciled_events,
                    days=days,
                    additional_debits=candidate_plan_debits,
                    active_spending_changes=action_strs,
                )
                if cls.is_plan_safe(bals, min_keep):
                    valid_plans.append((r, total_reduction, action_strs))

        if not valid_plans:
            return None

        # Sort: fewest changes first, then smallest total cash reduction
        valid_plans.sort(key=lambda x: (x[0], x[1]))
        return "|".join(valid_plans[0][2])
