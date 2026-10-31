"""
Financial Data Ingestion and Relational Context Pipeline.
Loads CSV datasets, performs relational joins, and normalizes foreign currencies
into the user's home currency.
"""

from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Union
import pandas as pd

from currency import CurrencyGraph
from models import (
    EvaluationRequest,
    FinancialEvent,
    FinancialProfile,
    ImageEvidence,
    Message,
    PaymentOption,
    UserFinancialContext,
)


def _split_pipe(val: Optional[str]) -> List[str]:
    """Helper to parse pipe-separated strings into a clean list of strings."""
    if pd.isna(val) or not str(val).strip():
        return []
    return [item.strip() for item in str(val).split("|") if item.strip()]


class FinancialDataLoader:
    """
    Ingests all financial dataset CSVs, enforces relational integrity,
    normalizes currencies into the user's home currency via CurrencyGraph,
    and indexes records for instant O(1) context retrieval.
    """

    def __init__(self, dataset_dir: Union[str, Path] = "dataset"):
        self.dataset_dir = Path(dataset_dir)
        if not self.dataset_dir.exists():
            raise FileNotFoundError(f"Dataset directory not found: {self.dataset_dir}")

        # 1. Initialize Currency Graph
        rates_path = self.dataset_dir / "exchange_rates.csv"
        self.currency_graph = CurrencyGraph(rates_path)

        # 2. Storage structures
        self.profiles: Dict[str, FinancialProfile] = {}
        self.events_by_user: Dict[str, List[FinancialEvent]] = defaultdict(list)
        self.events_by_id: Dict[str, FinancialEvent] = {}
        self.options_by_request: Dict[str, List[PaymentOption]] = defaultdict(list)
        
        self.messages_by_user: Dict[str, List[Message]] = defaultdict(list)
        self.messages_by_request: Dict[str, List[Message]] = defaultdict(list)
        self.messages_by_event: Dict[str, List[Message]] = defaultdict(list)

        self.images_by_user: Dict[str, List[ImageEvidence]] = defaultdict(list)
        self.images_by_request: Dict[str, List[ImageEvidence]] = defaultdict(list)
        self.images_by_event: Dict[str, List[ImageEvidence]] = defaultdict(list)

        self.requests: Dict[str, EvaluationRequest] = {}
        self.sample_requests: Dict[str, EvaluationRequest] = {}
        self.request_order: List[str] = []
        self.sample_request_order: List[str] = []

        # 3. Ingest and build indices
        self._load_profiles()
        self._load_events()
        self._load_payment_options()
        self._load_messages()
        self._load_images()
        self._load_requests()

    def _load_profiles(self) -> None:
        """Load and parse financial_profiles.csv."""
        df = pd.read_csv(self.dataset_dir / "financial_profiles.csv")
        for _, row in df.iterrows():
            u_id = str(row["user_id"]).strip()
            max_inst = row.get("max_installment_months")
            max_inst_val = int(max_inst) if pd.notna(max_inst) and str(max_inst).strip() else None

            profile = FinancialProfile(
                user_id=u_id,
                home_currency=str(row["home_currency"]).strip().upper(),
                current_available_balance=float(row["current_available_balance"]),
                minimum_balance_to_keep=float(row["minimum_balance_to_keep"]),
                financial_priorities=_split_pipe(row.get("financial_priorities")),
                expense_categories_to_protect=_split_pipe(row.get("expense_categories_to_protect")),
                expense_categories_user_is_willing_to_reduce=_split_pipe(
                    row.get("expense_categories_user_is_willing_to_reduce")
                ),
                expense_categories_user_is_willing_to_stop=_split_pipe(
                    row.get("expense_categories_user_is_willing_to_stop")
                ),
                payment_methods_user_will_consider=_split_pipe(
                    row.get("payment_methods_user_will_consider")
                ),
                max_installment_months=max_inst_val,
            )
            self.profiles[u_id] = profile

    def _load_events(self) -> None:
        """
        Load financial_events.csv and normalize foreign currency amounts to home_currency.
        """
        df = pd.read_csv(self.dataset_dir / "financial_events.csv")
        for _, row in df.iterrows():
            evt_id = str(row["event_id"]).strip()
            u_id = str(row["user_id"]).strip()
            profile = self.profiles[u_id]
            home_currency = profile.home_currency

            raw_amt = row.get("amount")
            amount_val = float(raw_amt) if pd.notna(raw_amt) else None
            currency_val = str(row["currency"]).strip().upper() if pd.notna(row.get("currency")) else None

            raw_settle = row.get("settlement_date")
            settle_date = (
                str(raw_settle).strip()
                if pd.notna(raw_settle) and str(raw_settle).strip() not in ("", "nan", "None")
                else None
            )

            # Currency normalization
            normalized_amount = None
            rate_applied = None
            path_applied = None

            if amount_val is not None and currency_val is not None:
                if currency_val == home_currency:
                    normalized_amount = amount_val
                    rate_applied = 1.0
                    path_applied = [home_currency]
                elif settle_date is not None:
                    rate_res = self.currency_graph.get_rate_and_path(
                        settle_date, currency_val, home_currency
                    )
                    if rate_res is not None:
                        rate_applied, path_applied = rate_res
                        normalized_amount = round(amount_val * rate_applied, 4)
                    else:
                        raise ValueError(
                            f"Failed to normalize foreign currency {currency_val} to {home_currency} "
                            f"on {settle_date} for event {evt_id}"
                        )

            min_allowed = row.get("minimum_allowed_amount")
            min_allowed_val = float(min_allowed) if pd.notna(min_allowed) else None

            linked = row.get("linked_event_id")
            linked_val = str(linked).strip() if pd.notna(linked) and str(linked).strip() else None

            event = FinancialEvent(
                event_id=evt_id,
                user_id=u_id,
                event_type=str(row["event_type"]).strip(),
                description=str(row["description"]).strip(),
                category=str(row["category"]).strip(),
                direction=str(row["direction"]).strip(),
                amount=amount_val,
                currency=currency_val,
                event_date=str(row["event_date"]).strip(),
                settlement_date=settle_date,
                status=str(row["status"]).strip(),
                linked_event_id=linked_val,
                flexibility=str(row["flexibility"]).strip(),
                minimum_allowed_amount=min_allowed_val,
                normalized_amount=normalized_amount,
                exchange_rate_applied=rate_applied,
                conversion_path=path_applied,
            )
            self.events_by_user[u_id].append(event)
            self.events_by_id[evt_id] = event

        # Sort all user events chronologically by settlement_date
        for u_id in self.events_by_user:
            self.events_by_user[u_id].sort(
                key=lambda e: (
                    e.settlement_date is None,
                    e.settlement_date or "",
                    e.event_date,
                    e.event_id,
                )
            )

    def _load_payment_options(self) -> None:
        """Load request_payment_options.csv."""
        df = pd.read_csv(self.dataset_dir / "request_payment_options.csv")
        for _, row in df.iterrows():
            freq = row.get("payment_frequency_days")
            freq_val = int(freq) if pd.notna(freq) else None

            fee = row.get("financing_fee")
            fee_val = float(fee) if pd.notna(fee) else 0.0

            opt = PaymentOption(
                payment_option_id=str(row["payment_option_id"]).strip(),
                request_id=str(row["request_id"]).strip(),
                payment_method=str(row["payment_method"]).strip(),
                payment_amount=float(row["payment_amount"]),
                number_of_payments=int(row["number_of_payments"]),
                first_payment_date=str(row["first_payment_date"]).strip(),
                payment_frequency_days=freq_val,
                financing_fee=fee_val,
                total_payable_amount=float(row["total_payable_amount"]),
            )
            self.options_by_request[opt.request_id].append(opt)

    def _load_messages(self) -> None:
        """Load messages.csv and index by user_id, request_id, and related_event_id."""
        df = pd.read_csv(self.dataset_dir / "messages.csv")
        for _, row in df.iterrows():
            req_id = str(row["request_id"]).strip() if pd.notna(row.get("request_id")) else None
            evt_id = str(row["related_event_id"]).strip() if pd.notna(row.get("related_event_id")) else None
            u_id = str(row["user_id"]).strip()

            msg = Message(
                message_id=str(row["message_id"]).strip(),
                user_id=u_id,
                request_id=req_id,
                related_event_id=evt_id,
                sent_at=str(row["sent_at"]).strip(),
                source_type=str(row["source_type"]).strip(),
                message_text=str(row["message_text"]).strip(),
            )
            self.messages_by_user[u_id].append(msg)
            if req_id:
                self.messages_by_request[req_id].append(msg)
            if evt_id:
                self.messages_by_event[evt_id].append(msg)

    def _load_images(self) -> None:
        """Load images.csv and link local PNG files."""
        df = pd.read_csv(self.dataset_dir / "images.csv")
        for _, row in df.iterrows():
            img_id = str(row["image_id"]).strip()
            u_id = str(row["user_id"]).strip()
            req_id = str(row["request_id"]).strip() if pd.notna(row.get("request_id")) else None
            evt_id = str(row["related_event_id"]).strip() if pd.notna(row.get("related_event_id")) else None

            # Resolve image file path: dataset/media/images/<image_id>.png
            img_file = self.dataset_dir / "media" / "images" / f"{img_id}.png"

            img = ImageEvidence(
                image_id=img_id,
                user_id=u_id,
                request_id=req_id,
                related_event_id=evt_id,
                file_path=str(img_file),
            )
            self.images_by_user[u_id].append(img)
            if req_id:
                self.images_by_request[req_id].append(img)
            if evt_id:
                self.images_by_event[evt_id].append(img)

    def _load_requests(self) -> None:
        """Load requests.csv and sample_requests.csv."""
        # Load evaluation requests
        df_req = pd.read_csv(self.dataset_dir / "requests.csv")
        for _, row in df_req.iterrows():
            req_id = str(row["request_id"]).strip()
            req = EvaluationRequest(
                request_id=req_id,
                user_id=str(row["user_id"]).strip(),
                request_date=str(row["request_date"]).strip(),
                request_type=str(row["request_type"]).strip(),
                requested_amount=float(row["requested_amount"]),
                desired_completion_date=str(row["desired_completion_date"]).strip(),
                allows_partial_payment=bool(row["allows_partial_payment"]),
                request_text=str(row["request_text"]).strip(),
            )
            self.requests[req_id] = req
            self.request_order.append(req_id)

        # Load sample requests
        df_sample = pd.read_csv(self.dataset_dir / "sample_requests.csv")
        for _, row in df_sample.iterrows():
            req_id = str(row["request_id"]).strip()
            req = EvaluationRequest(
                request_id=req_id,
                user_id=str(row["user_id"]).strip(),
                request_date=str(row["request_date"]).strip(),
                request_type=str(row["request_type"]).strip(),
                requested_amount=float(row["requested_amount"]),
                desired_completion_date=str(row["desired_completion_date"]).strip(),
                allows_partial_payment=bool(row["allows_partial_payment"]),
                request_text=str(row["request_text"]).strip(),
            )
            self.sample_requests[req_id] = req
            self.sample_request_order.append(req_id)

    def get_context(self, request_id: str) -> UserFinancialContext:
        """
        Assemble the unified relational context for a given request_id.
        Searches evaluation requests first, then sample requests.
        """
        if request_id in self.requests:
            req = self.requests[request_id]
        elif request_id in self.sample_requests:
            req = self.sample_requests[request_id]
        else:
            raise KeyError(f"Request ID not found: {request_id}")

        u_id = req.user_id
        profile = self.profiles[u_id]
        events = self.events_by_user[u_id]
        options = self.options_by_request[request_id]
        
        # User messages and images relevant to this user or this request
        messages = self.messages_by_user[u_id]
        images = self.images_by_user[u_id]

        return UserFinancialContext(
            request=req,
            profile=profile,
            events=events,
            payment_options=options,
            messages=messages,
            images=images,
        )

    def get_all_request_ids(self) -> List[str]:
        """Returns the 250 evaluation request IDs in order."""
        return list(self.request_order)

    def get_evaluation_request_ids(self) -> List[str]:
        """Alias for get_all_request_ids, returning 250 evaluation request IDs."""
        return list(self.request_order)

    def get_sample_request_ids(self) -> List[str]:
        """Returns the 25 sample request IDs in order."""
        return list(self.sample_request_order)
