"""
Semantic Message Reconciliation module.
Parses dataset/messages.csv across English and Indonesian texts,
extracts operational overrides, and applies them to user financial events.
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from pydantic import BaseModel, Field

try:
    from .currency import CurrencyGraph
    from .models import FinancialEvent, FinancialProfile, Message, UserFinancialContext
except ImportError:
    from currency import CurrencyGraph
    from models import FinancialEvent, FinancialProfile, Message, UserFinancialContext


class BaseOverride(BaseModel):
    user_id: str
    message_id: str
    sent_at: str
    ref: Optional[str] = None


class LeaseRenewalOverride(BaseOverride):
    """Lease renewal override increasing monthly rent by a percentage."""
    increase_percent: float = 12.0


class ContractEndOverride(BaseOverride):
    """Employment contract termination override dropping future recurring payroll."""
    pass


class SalaryAmendmentOverride(BaseOverride):
    """Salary adjustment (unpaid leave reduction, temporary pay, base pay, or arrears)."""
    adjustment_type: str  # unpaid_leave, temporary_pay, base_salary, arrears, household_end
    amount: float
    currency: str
    regular_amount: Optional[float] = None
    arrears_amount: Optional[float] = None


class DateReplacementOverride(BaseOverride):
    """Confirmed salary settlement date shift override."""
    revised_date: str


class InflowDisqualificationOverride(BaseOverride):
    """Inflow disqualification (unapproved bonus, pending refund, gig payout, valuation)."""
    disqualification_type: str  # bonus, refund, gig_payout, invoice, prize, valuation
    description: str


class InterAccountTransferOverride(BaseOverride):
    """Internal transfer neutralization override to prevent double-counting."""
    pass


class OperationalOverrides(BaseModel):
    lease_renewals: List[LeaseRenewalOverride] = Field(default_factory=list)
    contract_ends: List[ContractEndOverride] = Field(default_factory=list)
    salary_amendments: List[SalaryAmendmentOverride] = Field(default_factory=list)
    date_replacements: List[DateReplacementOverride] = Field(default_factory=list)
    inflow_disqualifications: List[InflowDisqualificationOverride] = Field(default_factory=list)
    inter_account_transfers: List[InterAccountTransferOverride] = Field(default_factory=list)


class MessageProcessor:
    """
    Parser and reconciliation engine for operational overrides extracted from messages.csv.
    """

    # Multi-lingual Regex Patterns (English & Indonesian)
    LEASE_PAT = re.compile(
        r'(?:increases monthly rent by (\d+(?:\.\d+)?)%|menaikkan biaya sewa(?: bulanan)? sebesar (\d+(?:\.\d+)?)%)',
        re.IGNORECASE,
    )
    CONTRACT_PAT = re.compile(
        r'(?:seasonal contract has ended|employment has ended|kontrak musiman saat ini telah berakhir|hubungan kerja anda telah berakhir)',
        re.IGNORECASE,
    )
    DATE_REPLACE_PAT = re.compile(
        r'(?:confirmed salary is now expected on (\d{4}-\d{2}-\d{2})\.?\s*This replaces|'
        r'gaji yang sudah dikonfirmasi kini diperkirakan masuk pada (\d{4}-\d{2}-\d{2})\.?\s*Tanggal ini menggantikan)',
        re.IGNORECASE,
    )
    UNPAID_LEAVE_PAT = re.compile(
        r'(?:next salary is reduced to ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*The adjustment is due to approved unpaid leave|'
        r'gaji anda berikutnya dipotong menjadi ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*Penyesuaian ini disebabkan oleh cuti tanpa gaji)',
        re.IGNORECASE,
    )
    TEMPORARY_PAY_PAT = re.compile(
        r'(?:temporary monthly pay is ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)|'
        r'gaji (?:bulanan )?sementara anda adalah ([A-Z]{3})\s*([\d,]+(?:\.\d+)?))',
        re.IGNORECASE,
    )
    BASE_SALARY_PAT = re.compile(
        r'(?:confirmed base salary is ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*The commission|'
        r'gaji pokok terkonfirmasi anda adalah ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*Komisi)',
        re.IGNORECASE,
    )
    ARREARS_PAT = re.compile(
        r'(?:regular salary for the next payroll is ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*The same payroll includes a one-time arrears adjustment of ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)|'
        r'gaji rutin anda untuk periode penggajian berikutnya adalah ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\.?\s*Periode penggajian yang sama mencakup penyesuaian rapel satu kali sebesar ([A-Z]{3})\s*([\d,]+(?:\.\d+)?))',
        re.IGNORECASE,
    )
    HOUSEHOLD_END_PAT = re.compile(
        r'(?:One household employment record has ended\. The remaining confirmed monthly salary is ([A-Z]{3})\s*([\d,]+(?:\.\d+)?)|'
        r'Salah satu sumber pendapatan kerja rumah tangga telah berakhir\. Sisa gaji bulanan yang dikonfirmasi adalah ([A-Z]{3})\s*([\d,]+(?:\.\d+)?))',
        re.IGNORECASE,
    )
    TRANSFER_PAT = re.compile(
        r'(?:matching debit and credit came from a transfer between your two accounts|'
        r'debit dan kredit dengan jumlah yang sama berasal dari transfer antara dua rekening)',
        re.IGNORECASE,
    )

    DISQUALIFICATION_KEYWORDS = [
        ('bonus', 'quarterly bonus is still subject'),
        ('bonus', 'bonus kuartalan anda masih menunggu'),
        ('refund', 'foreign-currency refund is still processing'),
        ('refund', 'pengembalian dana.*masih diproses'),
        ('refund', 'refund has been initiated but has not reached'),
        ('refund', 'pengembalian dana telah dimulai tetapi belum masuk'),
        ('refund', 'charge is still being investigated'),
        ('refund', 'tagihan kartu tambahan masih dalam penyelidikan'),
        ('gig_payout', 'quickcrew payout is still pending'),
        ('gig_payout', 'pembayaran berikutnya dari shiftpay masih tertunda'),
        ('invoice', 'other submitted invoices are still awaiting approval'),
        ('invoice', 'faktur lain yang diajukan masih menunggu'),
        ('prize', 'selected for a cash prize'),
        ('prize', 'terpilih untuk menerima hadiah uang tunai'),
        ('prize', 'prize claim has been verified and is still in payment processing'),
        ('prize', 'klaim hadiah anda sudah diverifikasi dan masih dalam proses'),
        ('valuation', 'displayed value of the investment has fallen'),
        ('valuation', 'nilai investasi yang ditampilkan telah turun'),
        ('valuation', 'market value has increased substantially'),
    ]

    REF_PAT = re.compile(r'(?:Ref\s*(?:kasus|payroll|akun|transaksi)?\s*|Case ref\s*|Payroll ref\s*|Txn ref\s*|Account ref\s*|Order ref\s*)([A-Z]{3}-\d{4})', re.IGNORECASE)

    @classmethod
    def _extract_ref(cls, text: str) -> Optional[str]:
        m = cls.REF_PAT.search(text)
        return m.group(1).upper() if m else None

    @classmethod
    def parse_message(cls, message: Message) -> List[BaseOverride]:
        """Parse a single message and return any operational overrides found."""
        overrides: List[BaseOverride] = []
        txt = message.message_text
        ref = cls._extract_ref(txt)
        uid = message.user_id
        mid = message.message_id
        sent = message.sent_at

        # 1. Lease Renewal
        m_lease = cls.LEASE_PAT.search(txt)
        if m_lease:
            pct = float(m_lease.group(1) or m_lease.group(2) or 12.0)
            overrides.append(
                LeaseRenewalOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    increase_percent=pct,
                )
            )

        # 2. Contract End
        if cls.CONTRACT_PAT.search(txt):
            overrides.append(
                ContractEndOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                )
            )

        # 3. Date Replacement
        m_date = cls.DATE_REPLACE_PAT.search(txt)
        if m_date:
            rev_date = m_date.group(1) or m_date.group(2)
            overrides.append(
                DateReplacementOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    revised_date=rev_date,
                )
            )

        # 4. Salary Amendments
        # 4a. Unpaid Leave
        m_leave = cls.UNPAID_LEAVE_PAT.search(txt)
        if m_leave:
            curr = (m_leave.group(1) or m_leave.group(3)).upper()
            amt_s = (m_leave.group(2) or m_leave.group(4)).replace(',', '')
            overrides.append(
                SalaryAmendmentOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    adjustment_type='unpaid_leave',
                    amount=float(amt_s),
                    currency=curr,
                )
            )

        # 4b. Temporary Pay
        m_temp = cls.TEMPORARY_PAY_PAT.search(txt)
        if m_temp:
            curr = (m_temp.group(1) or m_temp.group(3)).upper()
            amt_s = (m_temp.group(2) or m_temp.group(4)).replace(',', '')
            overrides.append(
                SalaryAmendmentOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    adjustment_type='temporary_pay',
                    amount=float(amt_s),
                    currency=curr,
                )
            )

        # 4c. Confirmed Base Salary
        m_base = cls.BASE_SALARY_PAT.search(txt)
        if m_base:
            curr = (m_base.group(1) or m_base.group(3)).upper()
            amt_s = (m_base.group(2) or m_base.group(4)).replace(',', '')
            overrides.append(
                SalaryAmendmentOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    adjustment_type='base_salary',
                    amount=float(amt_s),
                    currency=curr,
                )
            )

        # 4d. Arrears
        m_arr = cls.ARREARS_PAT.search(txt)
        if m_arr:
            curr = (m_arr.group(1) or m_arr.group(3)).upper()
            reg_s = (m_arr.group(2) or m_arr.group(4)).replace(',', '')
            arr_s = (m_arr.group(4) or m_arr.group(6) or '0').replace(',', '')
            reg_amt = float(reg_s)
            arr_amt = float(arr_s)
            overrides.append(
                SalaryAmendmentOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    adjustment_type='arrears',
                    amount=reg_amt + arr_amt,
                    regular_amount=reg_amt,
                    arrears_amount=arr_amt,
                    currency=curr,
                )
            )

        # 4e. Household Employment End
        m_house = cls.HOUSEHOLD_END_PAT.search(txt)
        if m_house:
            curr = (m_house.group(1) or m_house.group(3)).upper()
            amt_s = (m_house.group(2) or m_house.group(4)).replace(',', '')
            overrides.append(
                SalaryAmendmentOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                    adjustment_type='household_end',
                    amount=float(amt_s),
                    currency=curr,
                )
            )

        # 5. Inter-Account Transfer
        if cls.TRANSFER_PAT.search(txt):
            overrides.append(
                InterAccountTransferOverride(
                    user_id=uid,
                    message_id=mid,
                    sent_at=sent,
                    ref=ref,
                )
            )

        # 6. Inflow Disqualification
        for dq_type, kw in cls.DISQUALIFICATION_KEYWORDS:
            if re.search(kw, txt, re.IGNORECASE):
                overrides.append(
                    InflowDisqualificationOverride(
                        user_id=uid,
                        message_id=mid,
                        sent_at=sent,
                        ref=ref,
                        disqualification_type=dq_type,
                        description=kw,
                    )
                )
                break

        return overrides

    @classmethod
    def extract_overrides(cls, messages: List[Message]) -> OperationalOverrides:
        """Extract all typed operational overrides from a collection of messages."""
        result = OperationalOverrides()
        for msg in messages:
            extracted = cls.parse_message(msg)
            for ov in extracted:
                if isinstance(ov, LeaseRenewalOverride):
                    result.lease_renewals.append(ov)
                elif isinstance(ov, ContractEndOverride):
                    result.contract_ends.append(ov)
                elif isinstance(ov, SalaryAmendmentOverride):
                    result.salary_amendments.append(ov)
                elif isinstance(ov, DateReplacementOverride):
                    result.date_replacements.append(ov)
                elif isinstance(ov, InflowDisqualificationOverride):
                    result.inflow_disqualifications.append(ov)
                elif isinstance(ov, InterAccountTransferOverride):
                    result.inter_account_transfers.append(ov)
        return result

    @classmethod
    def is_spendable_inflow(
        cls, event: FinancialEvent, overrides: Optional[OperationalOverrides] = None
    ) -> bool:
        """
        Determines whether a financial event represents spendable cash flow.
        Excludes:
        - Non-cash events (unrealized investments, valuation adjustments)
        - Pending, unrealized, failed, or cancelled transactions
        - Pending merchant refunds, pending gig payouts, unapproved bonuses, and prize claims
        - Internal transfer credits between user accounts
        """
        if event.direction != 'credit':
            return False

        if event.event_type == 'investment_valuation' or event.direction == 'non_cash':
            return False

        if event.status in ('pending', 'unrealized', 'cancelled', 'failed'):
            return False

        # If refund is not settled or description indicates pending reversal
        desc_lower = event.description.lower()
        if 'pending' in desc_lower or 'unapproved' in desc_lower or 'disputed' in desc_lower:
            return False

        # If matching inter-account transfer
        if event.category == 'internal_transfer':
            return False

        # If unapproved bonus or pending refund override is active
        if overrides:
            for dq in overrides.inflow_disqualifications:
                if dq.disqualification_type == 'bonus' and 'bonus' in desc_lower:
                    return False
                if dq.disqualification_type == 'refund' and 'refund' in desc_lower:
                    return False

        return True

    @classmethod
    def get_upcoming_rent(
        cls,
        user_id: str,
        events: List[FinancialEvent],
        overrides: Optional[OperationalOverrides] = None,
    ) -> Optional[float]:
        """
        Calculates the projected monthly rent for a user, applying lease renewal
        increases (e.g. 12%) if an override exists.
        """
        rent_events = [
            e for e in events
            if e.category == 'rent' and e.amount is not None and e.amount > 0
        ]
        if not rent_events:
            return None

        # Determine baseline monthly rent from settled events
        settled_rents = [e for e in rent_events if e.status == 'settled']
        base_rent = settled_rents[-1].amount if settled_rents else rent_events[-1].amount

        has_lease_increase = False
        pct = 12.0
        if overrides:
            for lr in overrides.lease_renewals:
                if lr.user_id == user_id:
                    has_lease_increase = True
                    pct = lr.increase_percent
                    break

        if has_lease_increase:
            return round(base_rent * (1.0 + (pct / 100.0)), 2)
        return round(base_rent, 2)

    @classmethod
    def get_next_confirmed_salary(
        cls,
        user_id: str,
        events: List[FinancialEvent],
        overrides: Optional[OperationalOverrides] = None,
    ) -> Tuple[Optional[str], Optional[float]]:
        """
        Determines the next confirmed salary settlement date and amount,
        incorporating date shifts, salary amendments, arrears, and contract terminations.
        """
        # If contract ended, there are no future salary credits
        if overrides:
            for ce in overrides.contract_ends:
                if ce.user_id == user_id:
                    return None, None

        # Find baseline salary from settled events
        salary_events = [
            e for e in events
            if e.event_type == 'income' and e.category == 'salary' and e.amount is not None
        ]
        if not salary_events:
            return None, None

        settled_salaries = [e for e in salary_events if e.status == 'settled']
        last_salary = settled_salaries[-1] if settled_salaries else salary_events[-1]
        next_date = last_salary.settlement_date
        next_amount = last_salary.amount

        # Check for Date Replacement override
        if overrides:
            for dr in overrides.date_replacements:
                if dr.user_id == user_id:
                    next_date = dr.revised_date
                    break

        # Check for Salary Amendment override
        if overrides:
            for sa in overrides.salary_amendments:
                if sa.user_id == user_id:
                    next_amount = sa.amount
                    break

        return next_date, next_amount

    @classmethod
    def reconcile_events(
        cls,
        events: List[FinancialEvent],
        overrides: OperationalOverrides,
        profile: Optional[FinancialProfile] = None,
        currency_graph: Optional[CurrencyGraph] = None,
    ) -> List[FinancialEvent]:
        """
        Applies all operational overrides to a user's financial events list.
        Preserves historical settled events while modifying scheduled / upcoming events.
        """
        reconciled: List[FinancialEvent] = []
        user_id = profile.user_id if profile else (events[0].user_id if events else None)
        home_currency = profile.home_currency if profile else None

        # 1. Lease Renewal
        lease_increase_factor = None
        for lr in overrides.lease_renewals:
            if user_id is None or lr.user_id == user_id:
                lease_increase_factor = 1.0 + (lr.increase_percent / 100.0)
                break

        # 2. Contract End
        contract_ended = any(
            ce.user_id == user_id if user_id else True for ce in overrides.contract_ends
        )

        # 3. Date Replacement
        date_shifts: Dict[str, str] = {}
        for dr in overrides.date_replacements:
            if user_id is None or dr.user_id == user_id:
                date_shifts[dr.user_id] = dr.revised_date

        # 4. Salary Amendments
        salary_adj: Optional[SalaryAmendmentOverride] = None
        for sa in overrides.salary_amendments:
            if user_id is None or sa.user_id == user_id:
                salary_adj = sa
                break

        for evt in events:
            evt_copy = evt.model_copy()

            # Handle Lease Renewal on scheduled / pending rent events
            if lease_increase_factor is not None and evt_copy.category == 'rent':
                if evt_copy.status in ('scheduled', 'pending'):
                    if evt_copy.amount is not None:
                        evt_copy.amount = round(evt_copy.amount * lease_increase_factor, 2)
                    if evt_copy.normalized_amount is not None:
                        evt_copy.normalized_amount = round(
                            evt_copy.normalized_amount * lease_increase_factor, 4
                        )

            # Handle Contract End: drop / cancel future recurring salary events
            if contract_ended and evt_copy.event_type == 'income' and evt_copy.category == 'salary':
                if evt_copy.status in ('scheduled', 'pending'):
                    evt_copy.status = 'cancelled'

            # Handle Date Replacement: shift confirmed upcoming salary settlement date
            if user_id in date_shifts and evt_copy.event_type == 'income' and evt_copy.category == 'salary':
                if evt_copy.status in ('scheduled', 'pending'):
                    evt_copy.settlement_date = date_shifts[user_id]

            # Handle Salary Amendments: update upcoming salary
            if salary_adj is not None and evt_copy.event_type == 'income' and evt_copy.category == 'salary':
                if evt_copy.status in ('scheduled', 'pending'):
                    evt_copy.amount = salary_adj.amount
                    evt_copy.currency = salary_adj.currency
                    if home_currency and evt_copy.currency == home_currency:
                        evt_copy.normalized_amount = salary_adj.amount
                        evt_copy.exchange_rate_applied = 1.0
                    elif currency_graph and home_currency and evt_copy.settlement_date:
                        r_res = currency_graph.get_rate_and_path(
                            evt_copy.settlement_date, evt_copy.currency, home_currency
                        )
                        if r_res:
                            rate, path = r_res
                            evt_copy.exchange_rate_applied = rate
                            evt_copy.conversion_path = path
                            evt_copy.normalized_amount = round(salary_adj.amount * rate, 4)

            # Handle Inter-Account Transfers: mark matching internal transfers
            if overrides.inter_account_transfers:
                if 'transfer' in evt_copy.description.lower() and evt_copy.category not in ('rent', 'salary'):
                    evt_copy.category = 'internal_transfer'

            reconciled.append(evt_copy)

        return reconciled

    @classmethod
    def reconcile_context(
        cls, context: UserFinancialContext, currency_graph: Optional[CurrencyGraph] = None
    ) -> Tuple[UserFinancialContext, OperationalOverrides]:
        """
        Convenience wrapper to extract overrides and reconcile an entire UserFinancialContext.
        """
        overrides = cls.extract_overrides(context.messages)
        reconciled_events = cls.reconcile_events(
            events=context.events,
            overrides=overrides,
            profile=context.profile,
            currency_graph=currency_graph,
        )
        new_context = context.model_copy(update={'events': reconciled_events})
        return new_context, overrides
