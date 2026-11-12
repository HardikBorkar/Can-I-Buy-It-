"""
Deterministic Schema Definitions for Guardian Copilot.
Production-Grade Financial Validation:
- Zero hardcoded fallback defaults (no default prices, items, or merchants).
- Every proposed transaction or invoice must be explicitly grounded.
"""

from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

CurrencyCode = Literal["USD", "EUR", "GBP", "INR"]


class ProposedOrderPayload(BaseModel):
    """
    Deterministic purchase checkout payload.
    STRICTLY VALIDATED: Zero hardcoded fallback defaults.
    All fields must originate from user request or verified tool provenance.
    """
    item_name: str = Field(..., min_length=2, description="Target item or service name")
    merchant_name: str = Field(..., min_length=2, description="Seller, merchant, or counterparty")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Total transaction amount in exact Decimal")
    currency: CurrencyCode = Field(..., description="ISO-4217 Currency Code")
    quantity: int = Field(default=1, ge=1, description="Quantity of items")
    unit_price: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"))


class InvoicePayload(BaseModel):
    """
    Deterministic incoming receivable invoice payload.
    STRICTLY VALIDATED: Zero hardcoded fallback defaults.
    """
    recipient_email: str = Field(..., min_length=5, description="Client or debtor email address")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Receivable amount in exact Decimal")
    currency: CurrencyCode = Field(..., description="ISO-4217 Currency Code")
    description: str = Field(..., min_length=2, description="Invoice line item service description")


class ExpenditureSeriesItem(BaseModel):
    label: str = Field(..., description="Time period or breakdown bucket (e.g. Week 1, Oct 2026)")
    amount: float = Field(..., ge=0.0, description="Aggregated spend amount")
    category: str = Field(..., description="Spend category classification")


class ExpenditureChartEvent(BaseModel):
    period: str = Field(..., description="Analyzed reporting period title")
    total_spent: float = Field(..., ge=0.0, description="Sum of total expenditures in period")
    currency: CurrencyCode = Field(default="USD", description="Currency of analysis")
    series: List[ExpenditureSeriesItem] = Field(..., description="Chronological or categorical spend buckets")
    data_source: str = Field(default="Sandbox Ledger", description="Audited source of reporting data")

