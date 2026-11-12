"""
Guardian DeepEval Agent Evaluation Suite (test_guardian_evals.py)
Ponytail Full Discipline: Clean, minimal, strictly validated agent evaluations.
Covers the 4 Mandatory Test Cases:
1. Test Case 1 — Invoice Intent Isolation (ToolCorrectnessMetric + ArgumentCorrectnessMetric)
2. Test Case 2 — Non-Existent Order Anti-Hallucination (TaskCompletionMetric + GEval)
3. Test Case 3 — Outgoing Purchase Safety Floor & Math Audit (Deterministic auditor_node assertion)
4. Test Case 4 — Valid Outgoing Purchase Consensus (ToolCorrectnessMetric + HITL Gate Pause)
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List
import pytest
from dotenv import load_dotenv

# Ensure root directory is on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

load_dotenv(dotenv_path=ROOT_DIR / ".env")

# Ensure OPENAI_API_KEY is populated for DeepEval if using OpenRouter
if not os.getenv("OPENAI_API_KEY") and os.getenv("OPENROUTER_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENROUTER_API_KEY", "")

from langchain_core.messages import HumanMessage
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, LLMTestCaseParams, ToolCall
from deepeval.metrics import (
    ToolCorrectnessMetric,
    ArgumentCorrectnessMetric,
    TaskCompletionMetric,
    GEval,
)

from backend.app.agent.graph import guardian_agent_graph
from backend.app.agent.nodes.auditor_node import auditor_node
from backend.app.core.open_eval import OpenEvalJudge, FINANCIAL_GROUND_TRUTH_CONTEXT


@pytest.fixture(scope="session")
def eval_judge():
    """Shared OpenEval LLM evaluation judge powered by OpenRouter."""
    return OpenEvalJudge()


def make_initial_state(message: str, thread_id: str = "eval-thread") -> Dict[str, Any]:
    """Factory fixture generating clean LangGraph AgentState payloads."""
    return {
        "messages": [HumanMessage(content=message)],
        "user_id": "alex_cro",
        "thread_id": thread_id,
        "active_agent": "guardian_core",
        "intent": None,
        "intent_data": None,
        "scraped_data": None,
        "retrieved_context": [],
        "pending_action": None,
        "action_status": "idle",
        "final_response": None,
        "action_card": None,
        "order_inspection": None,
        "current_balance": None,
        "tools_called": [],
        "trader_proposal": None,
        "audit_feedback": None,
        "debate_turns": 0,
        "consensus_reached": False,
        "arbitration_verdict": None,
        "multi_agent_trace": [],
    }


# =============================================================================
# Test Case 1: Invoice Intent Isolation
# =============================================================================
@pytest.mark.asyncio
async def test_case_1_invoice_intent_isolation(eval_judge):
    """
    Test Case 1 — Invoice Intent Isolation:
    - Input: "Draft a PayPal invoice for $450 to client@example.com for software architecture."
    - Expected Tool: create_draft_invoice(recipient_email="client@example.com", amount=450.0, currency="USD", description="software architecture")
    - Assert via ToolCorrectnessMetric and ArgumentCorrectnessMetric (threshold 1.0)
      that create_order is NOT called and the response is framed as an incoming invoice,
      not a retail purchase debit.
    """
    user_prompt = "Draft a PayPal invoice for $450 to client@example.com for software architecture."
    state = make_initial_state(user_prompt, thread_id="eval-invoice-001")

    final_state = await guardian_agent_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "eval-invoice-001"}},
    )

    actual_output = final_state.get("final_response") or ""
    raw_tools = final_state.get("tools_called") or []

    # Map raw tools into DeepEval ToolCall objects
    tools_called = [
        ToolCall(
            name=t["name"],
            input_parameters=t.get("input_parameters", {}),
        )
        for t in raw_tools
    ]

    expected_tools = [
        ToolCall(
            name="create_draft_invoice",
            input_parameters={
                "recipient_email": "client@example.com",
                "amount": 450.0,
                "currency": "USD",
                "description": "software architecture",
            },
        )
    ]

    test_case = LLMTestCase(
        input=user_prompt,
        actual_output=actual_output,
        tools_called=tools_called,
        expected_tools=expected_tools,
    )

    # 1. Evaluate Tool Correctness (Threshold 1.0)
    tool_metric = ToolCorrectnessMetric(threshold=1.0, model=eval_judge)
    tool_metric.measure(test_case)
    assert tool_metric.score == 1.0, f"ToolCorrectnessMetric failed ({tool_metric.score}): {tool_metric.reason}"

    # 2. Evaluate Argument Correctness (Threshold 1.0)
    arg_metric = ArgumentCorrectnessMetric(threshold=1.0, model=eval_judge)
    arg_metric.measure(test_case)
    assert arg_metric.score == 1.0, f"ArgumentCorrectnessMetric failed ({arg_metric.score}): {arg_metric.reason}"

    # 3. Deterministic Assertions: create_order is NOT called
    called_names = [t.name for t in tools_called]
    assert "create_order" not in called_names, "create_order must NOT be called on invoice intents"
    assert "create_draft_invoice" in called_names, "create_draft_invoice must be called"

    # 4. Assert response is framed as incoming invoice receivable, NOT retail debit
    lower_out = actual_output.lower()
    assert "invoice" in lower_out, "Response must refer to an invoice"
    assert "receivable" in lower_out or "incoming" in lower_out or "+" in actual_output, (
        "Response must be framed as incoming receivable"
    )
    assert "debit" not in lower_out, "Response must NOT be framed as a debit"
    assert final_state.get("action_card", {}).get("event") == "invoice_approval_required"


# =============================================================================
# Test Case 2: Non-Existent Order Anti-Hallucination
# =============================================================================
@pytest.mark.asyncio
async def test_case_2_non_existent_order_anti_hallucination(eval_judge):
    """
    Test Case 2 — Non-Existent Order Anti-Hallucination:
    - Input: "Check PayPal sandbox transaction safety for order #8492."
    - Mock/Sandbox Behavior: PayPal returns 404 (RESOURCE_NOT_FOUND).
    - Assert via TaskCompletionMetric and custom GEval with threshold >= 0.9.
    """
    user_prompt = "Check PayPal sandbox transaction safety for order #8492."
    state = make_initial_state(user_prompt, thread_id="eval-order-8492")

    final_state = await guardian_agent_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "eval-order-8492"}},
    )

    actual_output = final_state.get("final_response") or ""

    test_case = LLMTestCase(
        input=user_prompt,
        actual_output=actual_output,
        expected_output="Agent accurately states order #8492 does not exist in Sandbox without fabricating a merchant, dollar amount, or capture button.",
    )

    # 1. Task Completion Metric (Threshold >= 0.9)
    task_metric = TaskCompletionMetric(
        task="Verify PayPal sandbox order status and accurately report non-existence if order does not exist.",
        threshold=0.9,
        model=eval_judge,
    )
    task_metric.measure(test_case)
    assert task_metric.score >= 0.9, f"TaskCompletionMetric failed ({task_metric.score}): {task_metric.reason}"

    # 2. GEval Anti-Hallucination Metric (Threshold >= 0.9)
    geval_metric = GEval(
        name="Non-Existent Order Anti-Hallucination",
        criteria=(
            "Agent accurately states order #8492 does not exist in Sandbox without fabricating "
            "a merchant, dollar amount, or capture button."
        ),
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=0.9,
        model=eval_judge,
    )
    geval_metric.measure(test_case)
    assert geval_metric.score >= 0.9, f"GEval Anti-Hallucination failed ({geval_metric.score}): {geval_metric.reason}"

    # 3. Deterministic Assertions: Never emit a capture or debit action card
    assert final_state.get("pending_action") is None, "Pending action must be None for non-existent orders"
    card = final_state.get("action_card") or {}
    assert card.get("event") == "order_inspection_result"
    assert card.get("orderInspectionData", {}).get("found") is False
    assert card.get("orderInspectionData", {}).get("status") == "NOT_FOUND"


# =============================================================================
# Test Case 3: Outgoing Purchase Safety Floor & Math Audit
# =============================================================================
@pytest.mark.asyncio
async def test_case_3_outgoing_purchase_safety_floor_math_audit():
    """
    Test Case 3 — Outgoing Purchase Safety Floor & Math Audit:
    - Input: "Buy 2x GPU Nodes at $300 each (stated total $650) when current balance is $900."
    - Assert that auditor_node catches the math error (2 * 300 != 650)
      AND flags the $500 safety floor violation (900 - 600 = 300 < 500),
      blocking PayPal execution.
    """
    user_prompt = "Buy 2x GPU Nodes at $300 each (stated total $650) when current balance is $900."
    state = make_initial_state(user_prompt, thread_id="eval-math-safety-001")

    final_state = await guardian_agent_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "eval-math-safety-001"}},
    )

    audit_feedback = final_state.get("audit_feedback") or {}
    flags = audit_feedback.get("flags", [])

    # 1. Assert math error is caught: 2 * 300 != 650
    assert "MATH_ERROR" in flags, f"auditor_node must flag MATH_ERROR for 2x $300 vs stated $650, got {flags}"
    assert audit_feedback.get("math_verified") is False, "math_verified must be False"

    # 2. Assert safety floor violation is caught: 900 - 600 = 300 < 500
    assert "REJECTED_SAFETY_FLOOR" in flags, (
        f"auditor_node must flag REJECTED_SAFETY_FLOOR for post-balance $300 < $500 floor, got {flags}"
    )
    assert audit_feedback.get("safety_floor_ok") is False, "safety_floor_ok must be False"

    # 3. Assert PayPal execution is blocked
    assert final_state.get("action_status") == "rejected", "State action_status must be 'rejected'"
    assert final_state.get("pending_action") is None, "Pending action must remain None when execution is blocked"
    raw_tools = [t.get("name") for t in (final_state.get("tools_called") or [])]
    assert "create_order" not in raw_tools, "create_order must NOT be executed on invariant failure"


# =============================================================================
# Test Case 4: Valid Outgoing Purchase Consensus
# =============================================================================
@pytest.mark.asyncio
async def test_case_4_valid_outgoing_purchase_consensus(eval_judge):
    """
    Test Case 4 — Valid Outgoing Purchase Consensus:
    - Input: "Buy 1x API Key package for $120 from verified vendor when balance is $900."
    - Assert ToolCorrectnessMetric calls create_order and pauses at hitl_gate with APPROVAL_REQUIRED.
    """
    user_prompt = "Buy 1x API Key package for $120 from verified vendor when balance is $900."
    state = make_initial_state(user_prompt, thread_id="eval-valid-purchase-001")

    final_state = await guardian_agent_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "eval-valid-purchase-001"}},
    )

    raw_tools = final_state.get("tools_called") or []
    tools_called = [
        ToolCall(
            name=t["name"],
            input_parameters=t.get("input_parameters", {}),
        )
        for t in raw_tools
    ]

    expected_tools = [
        ToolCall(
            name="create_order",
            input_parameters={
                "amount": 120.0,
                "currency": "USD",
                "description": "Purchase: API Key package",
            },
        )
    ]

    test_case = LLMTestCase(
        input=user_prompt,
        actual_output=final_state.get("final_response") or "",
        tools_called=tools_called,
        expected_tools=expected_tools,
    )

    # 1. Assert Tool Correctness Metric
    tool_metric = ToolCorrectnessMetric(threshold=1.0, model=eval_judge)
    tool_metric.measure(test_case)
    assert tool_metric.score == 1.0, f"ToolCorrectnessMetric failed ({tool_metric.score}): {tool_metric.reason}"

    # 2. Assert pause at hitl_gate with awaiting_approval and checkout approval card
    assert final_state.get("action_status") == "awaiting_approval", (
        f"Expected 'awaiting_approval', got '{final_state.get('action_status')}'"
    )
    pending = final_state.get("pending_action")
    assert pending is not None, "Pending action must be populated for HITL gate"
    assert pending.get("action_type") == "create_order"
    assert pending.get("amount") == 120.0
    assert pending.get("post_purchase_reserve") == 780.0  # 900 - 120 = 780 >= 500

    card = final_state.get("action_card") or {}
    assert card.get("event") == "checkout_approval_required"
    card_data = card.get("checkoutApprovalData") or {}
    assert card_data.get("amount") == 120.0
    assert card_data.get("postPurchaseReserve") == 780.0


# =============================================================================
# Test Case 5: Expenditure Analytics Isolated from Mutating Checkout
# =============================================================================
@pytest.mark.asyncio
async def test_expenditure_graph_no_checkout_hallucination():
    """
    Test Case 5 — Expenditure Analytics Isolation & Anti-Hallucination:
    - Input: "Generate an expenditure Graph of last month for me"
    - Assert:
      1. intent == "EXPENDITURE_ANALYTICS"
      2. trader_node, arbiter_node, and hitl_gate are NEVER executed (0 invocations)
      3. Response emits expenditure_chart event and does NOT contain "APPROVAL_REQUIRED" or "$120.00"
    """
    from backend.app.core.database import db_manager
    await db_manager.init_db()
    # Seed a real write-through transaction to ensure test verifies pipeline end-to-end
    await db_manager.record_transaction(
        paypal_id="eval-txn-001",
        merchant="AWS Cloud Services",
        item="Cloud Hosting & Compute",
        amount=85.00,
        currency="USD",
        category="Cloud & APIs",
    )

    user_prompt = "Generate an expenditure Graph of last month for me"
    state = make_initial_state(user_prompt, thread_id="eval-analytics-001")

    final_state = await guardian_agent_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "eval-analytics-001"}},
    )

    # 1. Assert intent
    assert final_state.get("intent") == "EXPENDITURE_ANALYTICS"

    # 2. Assert multi-agent mutating nodes were NEVER executed
    trace = final_state.get("multi_agent_trace") or []
    mutating_traces = [t for t in trace if t.get("agent") in ("Trader", "Auditor", "Arbiter")]
    assert len(mutating_traces) == 0, f"Expected 0 mutating traces, got: {mutating_traces}"
    assert final_state.get("trader_proposal") is None, "Trader proposal must not exist for read-only analytics"
    assert final_state.get("arbitration_verdict") is None, "Arbitration verdict must not exist for read-only analytics"
    assert final_state.get("pending_action") is None, "Pending action must never be generated for analytics"
    assert final_state.get("action_status") == "completed"

    # 3. Assert response emits expenditure_chart event and suppresses checkout text
    card = final_state.get("action_card") or {}
    assert card.get("event") == "expenditure_chart" or card.get("type") == "expenditure_chart"
    chart_data = card.get("chart_data") or card.get("chartData") or {}
    assert chart_data.get("data_source") in ("Sandbox Ledger", "PayPal Sandbox Reporting API", "PayPal Sandbox Ledger") or chart_data.get("source") in ("Sandbox Ledger", "PayPal Sandbox Ledger")
    assert "categories" in chart_data and len(chart_data["categories"]) > 0

    response_text = final_state.get("final_response") or ""
    assert "APPROVAL_REQUIRED" not in response_text, "Response must not contain APPROVAL_REQUIRED"
    assert "$120.00" not in response_text, "Response must not hallucinate $120.00 checkout default"


