"""
Deterministic Financial Reconciliation and Ledger Tagging Engine (Phase 3).
Applies Phase 2 message overrides, enforces conservative cash flow accounting invariants,
spending protection hierarchies, inter-account transfer neutralization, and four-tier
conflict resolution deduplication.
"""

from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Literal, Optional, Set, Tuple, Union
from pydantic import BaseModel, Field

try:
    from .currency import CurrencyGraph
    from .message_processor import (
        ContractEndOverride,
        DateReplacementOverride,
        InflowDisqualificationOverride,
        InterAccountTransferOverride,
        LeaseRenewalOverride,
        MessageProcessor,
        OperationalOverrides,
        SalaryAmendmentOverride,
    )
    from .models import FinancialEvent, FinancialProfile, UserFinancialContext
except ImportError:
    from currency import CurrencyGraph
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
    from models import FinancialEvent, FinancialProfile, UserFinancialContext


# ============================================================================
# 1. DATA MODEL DEFINITION
# ============================================================================

class ReconciledEvent(BaseModel):
    """
    Deterministic unified reconciled financial event schema.
    Strictly enforces accounting invariants, cash flow qualification,
    and spending flexibility eligibility.
    """
    event_id: str
    user_id: str
    description: str
    category: str
    direction: Literal["debit", "credit", "non_cash"]
    settlement_date: Optional[str] = None  # YYYY-MM-DD
    amount_home: float  # Converted into user's home currency
    is_cash_flow: bool  # True if it affects the 90-day liquid checking balance
    is_recurring: bool  # True if part of an ongoing recurring expense/salary
    is_protected: bool  # True if category is in expense_categories_to_protect
    is_stoppable: bool  # True if eligible for 'stop:<event_id>'
    is_reducible: bool  # True if eligible for 'reduce_to:<event_id>:<amount>'
    minimum_allowed_amount: Optional[float] = None  # Minimum floor when reduced
    status: str  # settled, scheduled, pending, cancelled, failed, unrealized


# ============================================================================
# 2. FINANCIAL RECONCILER ENGINE
# ============================================================================

class FinancialReconciler:
    """
    Engine executing deterministic reconciliation and tagging of user financial ledgers.
    """

    RECURRING_CATEGORIES = {
        "rent",
        "utilities",
        "groceries",
        "transport",
        "dining",
        "shopping",
        "entertainment",
        "insurance",
        "healthcare",
        "education",
        "housing",
        "family_support",
        "cloud_storage",
        "streaming",
        "music_subscription",
        "delivery_membership",
        "gym",
        "debt_repayment",
    }

    ONE_TIME_CATEGORIES = {
        "windfall",
        "investment",
        "work_expense",
    }

    DISQUALIFIED_INFLOW_TERMS = [
        "bonus",
        "refund",
        "reversal",
        "quickcrew",
        "shiftpay",
        "gig",
        "prize",
        "lottery",
        "invoice",
        "disputed",
        "investigation",
    ]

    TRANSFER_REF_PAT = re.compile(r'\b(BAN-\d{4})\b', re.IGNORECASE)

    def __init__(
        self,
        currency_graph: Optional[CurrencyGraph] = None,
        dataset_dir: Union[str, Path] = "dataset",
    ):
        self.dataset_dir = Path(dataset_dir)
        if currency_graph is not None:
            self.currency_graph = currency_graph
        else:
            rates_path = self.dataset_dir / "exchange_rates.csv"
            if rates_path.exists():
                self.currency_graph = CurrencyGraph(rates_path)
            else:
                self.currency_graph = None

        self._image_cache: Dict[str, Dict[str, Any]] = {}
        self._load_image_cache()

    def _load_image_cache(self) -> None:
        """Loads cached OCR image extractions if present."""
        cache_path = self.dataset_dir / "cache" / "image_extractions.json"
        if cache_path.exists():
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    self._image_cache = json.load(f)
            except Exception:
                self._image_cache = {}

    @classmethod
    def reconcile(
        cls,
        context: UserFinancialContext,
        currency_graph: Optional[CurrencyGraph] = None,
    ) -> List[ReconciledEvent]:
        """
        Reconcile and tag the entire financial ledger for a user context.
        Supports invocation directly as a classmethod or instance method.
        """
        reconciler = cls(currency_graph=currency_graph)
        return reconciler._reconcile_internal(context)

    def _reconcile_internal(self, context: UserFinancialContext) -> List[ReconciledEvent]:
        profile = context.profile
        messages = context.messages
        events = context.events
        images = context.images

        # 1. Extract Phase 2 message overrides
        overrides = MessageProcessor.extract_overrides(messages)

        # 2. Extract transfer references (e.g. BAN-0013, BAN-0023)
        transfer_refs: Set[str] = set()
        for tr in overrides.inter_account_transfers:
            if tr.ref:
                transfer_refs.add(tr.ref.upper())
        for msg in messages:
            for m in self.TRANSFER_REF_PAT.findall(msg.message_text):
                transfer_refs.add(m.upper())

        # Map images by related_event_id
        img_by_event = {
            img.related_event_id: img.image_id
            for img in images
            if img.related_event_id
        }

        # Check for user-level overrides
        lease_increase_factor = None
        for lr in overrides.lease_renewals:
            if lr.user_id == profile.user_id:
                lease_increase_factor = Decimal(str(1.0 + (lr.increase_percent / 100.0)))
                break

        contract_ended = any(ce.user_id == profile.user_id for ce in overrides.contract_ends)

        revised_pay_date = None
        for dr in overrides.date_replacements:
            if dr.user_id == profile.user_id:
                revised_pay_date = dr.revised_date
                break

        salary_adj: Optional[SalaryAmendmentOverride] = None
        for sa in overrides.salary_amendments:
            if sa.user_id == profile.user_id:
                salary_adj = sa
                break

        # Process each raw financial event into intermediate candidates
        candidates: List[Dict[str, Any]] = []

        for evt in events:
            # A. Normalization of Amount to Home Currency using Decimal
            raw_amt = evt.amount
            curr = evt.currency or profile.home_currency

            # Fill blank amount from image cache if available
            if raw_amt is None:
                img_id = img_by_event.get(evt.event_id)
                if img_id and img_id in self._image_cache:
                    cached_entry = self._image_cache[img_id]
                    raw_amt = float(cached_entry["amount"])
                    curr = str(cached_entry["currency"]).upper()

            if raw_amt is None:
                amt_dec = Decimal("0.00")
            elif evt.normalized_amount is not None:
                amt_dec = Decimal(str(evt.normalized_amount))
            elif curr == profile.home_currency:
                amt_dec = Decimal(str(raw_amt))
            elif self.currency_graph and evt.settlement_date:
                try:
                    rate_res = self.currency_graph.get_rate(evt.settlement_date, curr, profile.home_currency)
                    if rate_res is not None:
                        amt_dec = Decimal(str(raw_amt)) * Decimal(str(rate_res))
                    else:
                        amt_dec = Decimal(str(raw_amt))
                except Exception:
                    amt_dec = Decimal(str(raw_amt))
            else:
                amt_dec = Decimal(str(raw_amt))

            amount_home = float(amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            status = evt.status
            settlement_date = evt.settlement_date
            direction = evt.direction
            description = evt.description
            category = evt.category
            has_explicit_override = False

            # B. Apply Phase 2 Overrides
            # B1. Lease Renewal: 12% rent increase on scheduled/pending rent debits
            if lease_increase_factor is not None and category == "rent":
                if status in ("scheduled", "pending"):
                    amt_dec = amt_dec * lease_increase_factor
                    amount_home = float(amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                    has_explicit_override = True

            # B2. Contract End: cancel future recurring salary
            if contract_ended and category == "salary" and status in ("scheduled", "pending"):
                status = "cancelled"
                has_explicit_override = True

            # B3. Payday Date Replacement: shift confirmed payroll date
            if revised_pay_date and category == "salary" and status in ("scheduled", "pending"):
                settlement_date = revised_pay_date
                has_explicit_override = True

            # B4. Salary Amendments: split arrears or apply salary revision
            if salary_adj and category == "salary" and status in ("scheduled", "pending"):
                has_explicit_override = True
                if salary_adj.adjustment_type == "arrears" and salary_adj.regular_amount and salary_adj.arrears_amount:
                    # Split into regular recurring salary + one-time arrears
                    reg_amt_dec = Decimal(str(salary_adj.regular_amount))
                    arr_amt_dec = Decimal(str(salary_adj.arrears_amount))

                    # Normalize if foreign
                    if salary_adj.currency != profile.home_currency and self.currency_graph and settlement_date:
                        rate_res = self.currency_graph.get_rate(settlement_date, salary_adj.currency, profile.home_currency)
                        if rate_res is not None:
                            reg_amt_dec = reg_amt_dec * Decimal(str(rate_res))
                            arr_amt_dec = arr_amt_dec * Decimal(str(rate_res))

                    # 1. Base regular salary event
                    candidates.append({
                        "event_id": evt.event_id,
                        "user_id": profile.user_id,
                        "description": "Payroll credit",
                        "category": "salary",
                        "direction": "credit",
                        "settlement_date": settlement_date,
                        "amount_home": float(reg_amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                        "status": status,
                        "flexibility": evt.flexibility,
                        "minimum_allowed_amount": evt.minimum_allowed_amount,
                        "is_recurring_override": True,
                        "has_explicit_override": True,
                        "raw_event": evt,
                    })

                    # 2. One-time arrears event
                    candidates.append({
                        "event_id": f"{evt.event_id}_arrears",
                        "user_id": profile.user_id,
                        "description": "Promotion arrears payment",
                        "category": "salary",
                        "direction": "credit",
                        "settlement_date": settlement_date,
                        "amount_home": float(arr_amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                        "status": status,
                        "flexibility": "fixed",
                        "minimum_allowed_amount": None,
                        "is_recurring_override": False,
                        "has_explicit_override": True,
                        "raw_event": evt,
                    })
                    continue
                else:
                    # Unpaid leave, temporary pay, base salary
                    adj_amt_dec = Decimal(str(salary_adj.amount))
                    if salary_adj.currency != profile.home_currency and self.currency_graph and settlement_date:
                        rate_res = self.currency_graph.get_rate(settlement_date, salary_adj.currency, profile.home_currency)
                        if rate_res is not None:
                            adj_amt_dec = adj_amt_dec * Decimal(str(rate_res))
                    amount_home = float(adj_amt_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

            candidates.append({
                "event_id": evt.event_id,
                "user_id": profile.user_id,
                "description": description,
                "category": category,
                "direction": direction,
                "settlement_date": settlement_date,
                "amount_home": amount_home,
                "status": status,
                "flexibility": evt.flexibility,
                "minimum_allowed_amount": evt.minimum_allowed_amount,
                "is_recurring_override": None,
                "has_explicit_override": has_explicit_override,
                "raw_event": evt,
            })

        # 3. Inter-Account Transfer Neutralization Check
        # Match transfers by explicit ref, internal transfer category, or matching debit/credit
        for cand in candidates:
            desc_upper = cand["description"].upper()
            is_internal_ref = any(ref in desc_upper for ref in transfer_refs)
            is_internal_text = (
                cand["category"] == "internal_transfer"
                or "TRANSFER BETWEEN YOUR TWO ACCOUNTS" in desc_upper
                or "INTERNAL TRANSFER" in desc_upper
            )
            if is_internal_ref or is_internal_text:
                cand["is_internal_transfer"] = True
            else:
                cand["is_internal_transfer"] = False

        # Check for paired debit/credit transfers matching identical user, amount, date
        transfer_debits = [
            c for c in candidates
            if c["direction"] == "debit" and ("transfer" in c["description"].lower() or c["is_internal_transfer"])
        ]
        transfer_credits = [
            c for c in candidates
            if c["direction"] == "credit" and ("transfer" in c["description"].lower() or c["is_internal_transfer"])
        ]
        for td in transfer_debits:
            for tc in transfer_credits:
                if td["settlement_date"] == tc["settlement_date"] and abs(td["amount_home"] - tc["amount_home"]) < 0.01:
                    td["is_internal_transfer"] = True
                    tc["is_internal_transfer"] = True

        # 4. Build ReconciledEvent objects and evaluate rules
        reconciled_raw: List[ReconciledEvent] = []

        for cand in candidates:
            c_desc = cand["description"]
            c_desc_lower = c_desc.lower()
            c_cat = cand["category"]
            c_dir = cand["direction"]
            c_status = cand["status"]
            c_amt_home = cand["amount_home"]
            c_s_date = cand["settlement_date"]
            evt_type = getattr(cand["raw_event"], "event_type", "expense")

            # Determine Direction
            if evt_type == "investment_valuation" or c_status == "unrealized" or c_dir == "non_cash":
                direction_final: Literal["debit", "credit", "non_cash"] = "non_cash"
            elif c_dir == "credit":
                direction_final = "credit"
            else:
                direction_final = "debit"

            # Determine Recurrence
            if cand["is_recurring_override"] is not None:
                is_recurring = cand["is_recurring_override"]
            elif hasattr(cand["raw_event"], "is_recurring") and getattr(cand["raw_event"], "is_recurring") is not None:
                is_recurring = bool(getattr(cand["raw_event"], "is_recurring"))
            elif c_cat == "salary":
                if (
                    "arrears" in c_desc_lower
                    or "rapel" in c_desc_lower
                    or "one-time" in c_desc_lower
                    or "bonus" in c_desc_lower
                    or "reimbursement" in c_desc_lower
                    or "windfall" in c_desc_lower
                ):
                    is_recurring = False
                else:
                    is_recurring = True
            elif c_cat in self.ONE_TIME_CATEGORIES or evt_type in (
                "investment_purchase",
                "investment_valuation",
                "investment_sale",
                "refund",
            ):
                is_recurring = False
            elif evt_type in ("subscription", "debt_payment") or c_cat in self.RECURRING_CATEGORIES:
                is_recurring = True
            elif cand["flexibility"] in ("stoppable", "reducible", "reducible_or_stoppable"):
                is_recurring = True
            else:
                is_recurring = False

            # Determine Spending Protection & Flexibility Hierarchy
            is_protected = c_cat in profile.expense_categories_to_protect

            if is_protected:
                is_stoppable = False
                is_reducible = False
            else:
                # Priority 2: Stoppable
                is_stoppable = (
                    c_cat in profile.expense_categories_user_is_willing_to_stop
                    and cand["flexibility"] in ("stoppable", "reducible_or_stoppable")
                    and is_recurring
                )

                # Priority 3: Reducible
                min_amt = cand["minimum_allowed_amount"]
                is_reducible = (
                    c_cat in profile.expense_categories_user_is_willing_to_reduce
                    and cand["flexibility"] in ("reducible", "reducible_or_stoppable")
                    and min_amt is not None
                    and min_amt < c_amt_home
                    and is_recurring
                )

            # Determine Conservative Cash Flow Eligibility
            if direction_final == "non_cash":
                is_cash_flow = False
            elif cand["is_internal_transfer"]:
                is_cash_flow = False
            elif direction_final == "credit":
                # Inflow Conservative Rules
                if c_status in ("pending", "unrealized", "cancelled", "failed"):
                    is_cash_flow = False
                elif any(term in c_desc_lower for term in self.DISQUALIFIED_INFLOW_TERMS):
                    is_cash_flow = False
                elif c_cat == "windfall" or evt_type == "refund":
                    # Pending / unapproved / uncertain refunds or prizes
                    if c_status != "settled" or "pending" in c_desc_lower or "unapproved" in c_desc_lower:
                        is_cash_flow = False
                    else:
                        is_cash_flow = True
                elif c_cat == "salary":
                    # Confirmed recurring salary strictly on settlement date
                    is_cash_flow = c_status in ("settled", "scheduled") and c_s_date is not None
                elif c_status == "settled":
                    is_cash_flow = True
                else:
                    is_cash_flow = False
            else:
                # Outflow Conservative Rules
                if c_status in ("cancelled", "failed"):
                    is_cash_flow = False
                elif c_status in ("settled", "pending", "scheduled"):
                    is_cash_flow = True
                else:
                    is_cash_flow = False

            rec_event = ReconciledEvent(
                event_id=cand["event_id"],
                user_id=cand["user_id"],
                description=c_desc,
                category=c_cat,
                direction=direction_final,
                settlement_date=c_s_date,
                amount_home=c_amt_home,
                is_cash_flow=is_cash_flow,
                is_recurring=is_recurring,
                is_protected=is_protected,
                is_stoppable=is_stoppable,
                is_reducible=is_reducible,
                minimum_allowed_amount=cand["minimum_allowed_amount"],
                status=c_status,
            )
            reconciled_raw.append(rec_event)

        # 5. Four-Tier Conflict Resolution and Deduplication
        deduplicated = self._deduplicate_events(reconciled_raw)

        # 6. Chronological Sorting
        # Active cash flow events strictly ordered by settlement_date
        return self._sort_ledger(deduplicated)

    @classmethod
    def _deduplicate_events(cls, events: List[ReconciledEvent]) -> List[ReconciledEvent]:
        """
        Exact De-Duplication matching (user_id, amount_home, settlement_date, description).
        Uses Four-Tier Conflict Resolution Order:
        1. Explicit cancellation, settlement, or amendment from Phase 2 overrides.
        2. Newer record from the same source.
        3. Settled event over estimate or forecast.
        4. Financially safer interpretation (reserve questionable debits, disqualify questionable credits).
        """
        groups: Dict[Tuple[str, float, Optional[str], str], List[ReconciledEvent]] = {}
        for evt in events:
            key = (evt.user_id, evt.amount_home, evt.settlement_date, evt.description)
            if key not in groups:
                groups[key] = []
            groups[key].append(evt)

        deduped: List[ReconciledEvent] = []
        for key, candidate_list in groups.items():
            if len(candidate_list) == 1:
                deduped.append(candidate_list[0])
                continue

            # Multi-record conflict resolution
            best_event = max(candidate_list, key=cls._conflict_resolution_score)
            deduped.append(best_event)

        return deduped

    @classmethod
    def _conflict_resolution_score(cls, event: ReconciledEvent) -> Tuple[int, int, int, int]:
        """
        Calculates a deterministic 4-tuple comparison score:
        (Tier 1 Override, Tier 2 Sequence/Recency, Tier 3 Status, Tier 4 Financial Safety)
        """
        # Tier 1: Phase 2 Overrides
        t1 = 1 if (
            event.status == "cancelled"
            or "arrears" in event.description.lower()
            or event.event_id.endswith("_arrears")
        ) else 0

        # Tier 2: Recency / Event ID index
        num_match = re.search(r'\d+', event.event_id)
        t2 = int(num_match.group()) if num_match else 0

        # Tier 3: Settled over estimate or forecast
        status_ranks = {
            "settled": 4,
            "scheduled": 3,
            "pending": 2,
            "unrealized": 1,
            "failed": 0,
            "cancelled": 0,
        }
        t3 = status_ranks.get(event.status, 0)

        # Tier 4: Financially safer interpretation
        # For debits: prefer active cash flow (reserves cash)
        # For credits: prefer non-cash flow (disqualifies uncertain inflow)
        if event.direction == "debit":
            t4 = 1 if event.is_cash_flow else 0
        else:
            t4 = 1 if not event.is_cash_flow else 0

        return (t1, t2, t3, t4)

    @classmethod
    def _sort_ledger(cls, events: List[ReconciledEvent]) -> List[ReconciledEvent]:
        """
        Sorts ledger so active cash flow events are strictly in chronological order by settlement_date.
        Non-cash and unrealized events with null settlement dates are placed predictably at the end.
        """
        def sort_key(evt: ReconciledEvent) -> Tuple[int, str, str]:
            # 0 for valid settlement_date, 1 for None
            date_str = evt.settlement_date or "9999-12-31"
            has_date = 0 if evt.settlement_date is not None else 1
            return (has_date, date_str, evt.event_id)

        return sorted(events, key=sort_key)
