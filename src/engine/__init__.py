"""Core financial decision and simulation engine."""
from .models import (
    FinancialProfile,
    FinancialEvent,
    PaymentOption,
    EvaluationRequest,
    UserFinancialContext,
)
try:
    from .currency import CurrencyGraph
except ImportError:
    CurrencyGraph = None
from .reconciler import ReconciledEvent
from .simulator import CashFlowSimulator
from .plan_selector import CandidatePlan, PlanSelector

__all__ = [
    "FinancialProfile",
    "FinancialEvent",
    "PaymentOption",
    "EvaluationRequest",
    "UserFinancialContext",
    "CurrencyGraph",
    "ReconciledEvent",
    "CashFlowSimulator",
    "CandidatePlan",
    "PlanSelector",
]
