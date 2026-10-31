"""
Strict Pydantic models representing the financial entities in the Buy or Wait? challenge.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class FinancialProfile(BaseModel):
    user_id: str
    home_currency: str
    current_available_balance: float
    minimum_balance_to_keep: float
    financial_priorities: List[str] = Field(default_factory=list)
    expense_categories_to_protect: List[str] = Field(default_factory=list)
    expense_categories_user_is_willing_to_reduce: List[str] = Field(default_factory=list)
    expense_categories_user_is_willing_to_stop: List[str] = Field(default_factory=list)
    payment_methods_user_will_consider: List[str] = Field(default_factory=list)
    max_installment_months: Optional[int] = None


class FinancialEvent(BaseModel):
    event_id: str
    user_id: str
    event_type: str
    description: str
    category: str
    direction: str  # debit, credit, non_cash
    amount: Optional[float] = None  # None if blank (to be filled via image)
    currency: Optional[str] = None
    event_date: str
    settlement_date: Optional[str] = None
    status: str  # settled, pending, scheduled, cancelled, failed, unrealized
    linked_event_id: Optional[str] = None
    flexibility: str  # fixed, stoppable, reducible, reducible_or_stoppable
    minimum_allowed_amount: Optional[float] = None

    # Normalized fields (in user's home_currency)
    normalized_amount: Optional[float] = None
    exchange_rate_applied: Optional[float] = None
    conversion_path: Optional[List[str]] = None


class PaymentOption(BaseModel):
    payment_option_id: str
    request_id: str
    payment_method: str  # full_payment, installments
    payment_amount: float
    number_of_payments: int
    first_payment_date: str
    payment_frequency_days: Optional[int] = None
    financing_fee: float = 0.0
    total_payable_amount: float


class Message(BaseModel):
    message_id: str
    user_id: str
    request_id: Optional[str] = None
    related_event_id: Optional[str] = None
    sent_at: str
    source_type: str
    message_text: str


class ImageEvidence(BaseModel):
    image_id: str
    user_id: str
    request_id: Optional[str] = None
    related_event_id: Optional[str] = None
    file_path: str


class EvaluationRequest(BaseModel):
    request_id: str
    user_id: str
    request_date: str
    request_type: str
    requested_amount: float
    desired_completion_date: str
    allows_partial_payment: bool
    request_text: str


class UserFinancialContext(BaseModel):
    """
    Unified relational context bundle for a single evaluation request.
    """
    request: EvaluationRequest
    profile: FinancialProfile
    events: List[FinancialEvent] = Field(default_factory=list)
    payment_options: List[PaymentOption] = Field(default_factory=list)
    messages: List[Message] = Field(default_factory=list)
    images: List[ImageEvidence] = Field(default_factory=list)
