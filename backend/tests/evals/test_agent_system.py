"""
Automated Evaluation Suite: Multi-Agent Consensus Swarm, Invariant Protection & Tool Selection
Stack: DeepEval (Agent Metrics & GEval) + Ponytail / Pytest Test Harness
Architecture: Next.js ↔ FastAPI ↔ LangGraph Multi-Agent Swarm ↔ PayPal REST v2 Sandbox
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

# Load environment variables
load_dotenv(dotenv_path=ROOT_DIR / ".env")

# Ensure OPENAI_API_KEY is available for DeepEval internal classes
if not os.getenv("OPENAI_API_KEY") and os.getenv("OPENROUTER_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENROUTER_API_KEY", "")

from langchain_core.messages import HumanMessage
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, LLMTestCaseParams, ToolCall
from deepeval.metrics import GEval, ToolCorrectnessMetric

from backend.app.agent.graph import guardian_agent_graph
from backend.app.agent.nodes.trader_node import trader_node
from backend.app.agent.nodes.auditor_node import auditor_node
from backend.app.agent.nodes.arbiter_node import arbiter_node, arbiter_decision
from backend.app.agent.tools.paypal_tools import (
    authorize_escrow,
    release_escrow,
    split_group_payment,
    create_and_send_invoice,
    SafetyFloorBreachError,
)
from backend.app.core.open_eval import OpenEvalJudge, FINANCIAL_GROUND_TRUTH_CONTEXT


# =============================================================================
# PONYTAIL PYTEST FIXTURES (Clean, minimal, high-leverage test harness)
# =============================================================================

@pytest.fixture(scope="session")
def eval_judge():
    """Provides the OpenRouter / OpenEval evaluation judge for GEval metrics."""
    return OpenEvalJudge()


@pytest.fixture
def make_initial_state():
    """Factory fixture generating clean, deterministic LangGraph AgentState payloads."""
    def _create(message: str, thread_id: str = "eval-thread-001") -> Dict[str, Any]:
        return {
            "messages": [HumanMessage(content=message)],
            "user_id": "alex_cro",
            "thread_id": thread_id,
            "active_agent": "guardian_core",
            "scraped_data": None,
            "retrieved_context": [],
            "pending_action": None,
            "action_status": "idle",
            "final_response": None,
            "trader_proposal": None,
            "audit_feedback": None,
            "debate_turns": 0,
            "consensus_reached": False,
            "arbitration_verdict": None,
            "multi_agent_trace": [],
        }
    return _create


# =============================================================================
# 1. MATHEMATICAL & FINANCIAL INVARIANT TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_mathematical_invariant_mismatched_subtotals():
    """
    Test 1A: Mismatched Subtotals Invariant
    Assert that an invoice or order with mismatched subtotals is flagged with MATH_ERROR
    by auditor_node and never reaches hitl_gate.
    """
    # Trader creates a proposal with arithmetic discrepancy
    mismatched_proposal = {
        "intent": "send_invoice",
        "item_name": "Consulting Architecture Services",
        "items": [
            {"name": "Consulting Hours", "price": 100.0, "qty": 2, "total": 200.0},
            {"name": "Hosting Setup", "price": 50.0, "qty": 1, "total": 50.0},
        ],
        "subtotal": 250.0,
        "tax": 0.0,
        "total": 350.0,  # Intentional discrepancy: 200 + 50 = 250 != 350
        "currency": "USD",
        "merchant": "Enterprise Consulting",
        "merchant_email": "client@venturecap.io",
        "turn": 0,
    }

    state = {
        "messages": [HumanMessage(content="Send invoice for consulting")],
        "user_id": "alex_cro",
        "thread_id": "test-math-err-thread",
        "active_agent": "invoicing",
        "scraped_data": None,
        "retrieved_context": [],
        "trader_proposal": mismatched_proposal,
        "audit_feedback": None,
        "debate_turns": 0,
        "consensus_reached": False,
        "pending_action": None,
        "action_status": "idle",
        "multi_agent_trace": [],
    }

    # Step 1: Run auditor_node
    audit_result = await auditor_node(state)
    feedback = audit_result["audit_feedback"]

    assert not feedback["passed"], "Auditor should fail the mismatched proposal"
    assert "MATH_ERROR" in feedback["flags"], "Auditor must flag 'MATH_ERROR'"
    assert feedback["math_verified"] is False, "math_verified must be False"

    # Step 2: Route through arbiter_node with debate turns exhausted
    state["audit_feedback"] = feedback
    state["debate_turns"] = 2  # Max debate turns reached

    arbiter_result = await arbiter_node(state)
    state.update(arbiter_result)

    # Step 3: Verify execution NEVER reaches hitl_gate
    next_node = arbiter_decision(state)
    assert next_node == "__end__", f"Expected '__end__' routing, got '{next_node}'"
    assert state.get("pending_action") is None, "Pending action must remain None on math error"
    assert state.get("action_status") == "rejected", "Action status must be 'rejected'"
    assert "MATH_ERROR" in (state.get("final_response") or ""), "Final response must cite MATH_ERROR"


@pytest.mark.asyncio
async def test_financial_invariant_safety_floor_rejection():
    """
    Test 1B: $500.00 Sacred Safety Floor Invariant
    Assert that any transaction violating the $500 cash-flow safety floor
    triggers REJECTED_SAFETY_FLOOR and is blocked before HITL approval.
    """
    # $1,600 purchase drops lowest projected balance ($590) to -$1,010 (severely violates $500 floor)
    excessive_proposal = {
        "intent": "create_order",
        "item_name": "Luxury Designer Watch",
        "items": [{"name": "Luxury Watch", "price": 1600.0, "qty": 1, "total": 1600.0}],
        "subtotal": 1600.0,
        "tax": 0.0,
        "total": 1600.0,
        "currency": "USD",
        "merchant": "Luxury Boutique",
        "pay_in_4": False,
        "turn": 0,
    }

    state = {
        "messages": [HumanMessage(content="I want to buy a $1,600 watch")],
        "user_id": "alex_cro",
        "thread_id": "test-safety-floor-thread",
        "active_agent": "guardian_core",
        "scraped_data": None,
        "retrieved_context": [],
        "trader_proposal": excessive_proposal,
        "audit_feedback": None,
        "debate_turns": 2,
        "consensus_reached": False,
        "pending_action": None,
        "action_status": "idle",
        "multi_agent_trace": [],
    }

    # Step 1: Run auditor_node
    audit_result = await auditor_node(state)
    feedback = audit_result["audit_feedback"]

    assert not feedback["passed"], "Auditor should fail excessive spending"
    assert "REJECTED_SAFETY_FLOOR" in feedback["flags"], "Auditor must flag 'REJECTED_SAFETY_FLOOR'"
    assert feedback["safety_floor_ok"] is False

    # Step 2: Route through arbiter_node
    state["audit_feedback"] = feedback
    arbiter_result = await arbiter_node(state)
    state.update(arbiter_result)

    next_node = arbiter_decision(state)
    assert next_node == "__end__", f"Expected '__end__' routing, got '{next_node}'"
    assert state.get("pending_action") is None
    assert state.get("action_status") == "rejected"
    assert "REJECTED_SAFETY_FLOOR" in (state.get("final_response") or "")

    # Step 3: Verify concrete tools enforce safety floor
    with pytest.raises(SafetyFloorBreachError) as exc_info:
        await split_group_payment(
            total_amount=3000.0,
            participants=[{"name": "Alex", "email": "alex@cro.io", "amount": 1800.0}],
        )
    assert "REJECTED_SAFETY_FLOOR" in str(exc_info.value)


# =============================================================================
# 2. MULTI-AGENT CONSENSUS EVAL (DEEPEVAL LLM TESTCASE + GEVAL)
# =============================================================================

@pytest.mark.asyncio
async def test_multi_agent_consensus_collaboration(eval_judge, make_initial_state):
    """
    Test 2: Multi-Agent Consensus Collaboration Eval (DeepEval LLM TestCase)
    - Asserts that both Trader and Auditor agent outputs exist in the trace.
    - Evaluates GEval with criteria='Multi-agent collaboration where an auditor
      independently audits and challenges the trader's pricing before settlement'.
    - Metric threshold: GEval >= 0.8.
    """
    user_prompt = "I want to purchase a Sony Camera for $850 USD from an online retail store."
    state = make_initial_state(user_prompt, thread_id="eval-consensus-001")

    # Execute the LangGraph multi-agent swarm
    final_state = await guardian_agent_graph.ainvoke(state, config={"configurable": {"thread_id": "eval-consensus-001"}})

    trace = final_state.get("multi_agent_trace", [])
    agent_roles_in_trace = [step.get("agent") for step in trace]

    # Deterministic Trace Verification
    assert "Trader" in agent_roles_in_trace, "Trader agent must be present in execution trace"
    assert "Auditor" in agent_roles_in_trace, "Auditor agent must be present in execution trace"
    assert "Arbiter" in agent_roles_in_trace, "Arbiter agent must be present in execution trace"

    # Assemble trace output for DeepEval GEval
    trace_summary = "\n".join([
        f"[{step.get('agent')} (Turn {step.get('turn', 0)})]: {step.get('message')}"
        for step in trace
    ])
    actual_output = f"{trace_summary}\n\nFinal Verdict:\n{final_state.get('final_response', '')}"

    test_case = LLMTestCase(
        input=user_prompt,
        actual_output=actual_output,
        expected_output="Multi-agent swarm negotiates and validates pricing, audits invariants, and reaches consensus.",
        retrieval_context=FINANCIAL_GROUND_TRUTH_CONTEXT,
    )

    consensus_metric = GEval(
        name="Multi-Agent Consensus Collaboration",
        criteria=(
            "Multi-agent collaboration where an auditor independently audits and challenges the "
            "trader's pricing before settlement. The trace must clearly demonstrate distinct agents "
            "(Trader proposing, Auditor evaluating risk and invariants, Arbiter determining consensus)."
        ),
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=0.8,
        model=eval_judge,
    )

    assert_test(test_case, [consensus_metric])


# =============================================================================
# 3. TOOL CORRECTNESS METRIC (DEEPEVAL ToolCorrectnessMetric)
# =============================================================================

@pytest.mark.asyncio
async def test_tool_selection_correctness(eval_judge, make_initial_state):
    """
    Test 3: Tool Correctness Metric
    Use DeepEval's ToolCorrectnessMetric to ensure the multi-agent swarm selects:
    - split_group_payment for split requests
    - authorize_escrow for contractor milestones
    - create_order for catalog purchases
    """
    test_scenarios = [
        {
            "query": "Split a $150 dinner bill equally among 3 teammates",
            "expected_tool": "split_group_payment",
            "thread_id": "eval-tool-split",
        },
        {
            "query": "Hold $400 in milestone escrow for software contractor upon deliverables completion",
            "expected_tool": "authorize_escrow",
            "thread_id": "eval-tool-escrow",
        },
        {
            "query": "I want to buy Sony camera for $850 from catalog",
            "expected_tool": "create_order",
            "thread_id": "eval-tool-catalog",
        },
    ]

    metric = ToolCorrectnessMetric(
        model=eval_judge,
        should_exact_match=True,
    )

    for scenario in test_scenarios:
        state = make_initial_state(scenario["query"], thread_id=scenario["thread_id"])
        final_state = await guardian_agent_graph.ainvoke(state, config={"configurable": {"thread_id": scenario["thread_id"]}})

        pending = final_state.get("pending_action") or {}
        selected_tool_type = pending.get("action_type") or final_state.get("trader_proposal", {}).get("intent")

        test_case = LLMTestCase(
            input=scenario["query"],
            actual_output=final_state.get("final_response") or "Action prepared",
            tools_called=[ToolCall(name=selected_tool_type)],
            expected_tools=[ToolCall(name=scenario["expected_tool"])],
        )

        assert_test(test_case, [metric])
        assert selected_tool_type == scenario["expected_tool"], (
            f"Expected tool '{scenario['expected_tool']}', but agent selected '{selected_tool_type}'."
        )

