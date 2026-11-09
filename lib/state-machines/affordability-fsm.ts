/**
 * Financial Affordability & Routing Finite State Machine (FSM)
 * Unifies the financial decision logic across Next.js API routes, Copilot chat,
 * Storefront PDP, and Python agent planners.
 */

import { FINANCIAL_STATE, RECURRING_COMMITMENTS } from "@/lib/financial-state";

export type AffordabilityTier =
  | "TIER_SAFE_IN_FULL"
  | "TIER_PAY_IN_4_RECOMMENDED"
  | "TIER_OVERDRAFT_BLOCKED";

export interface AffordabilityFSMState {
  tier: AffordabilityTier;
  recommendedAction: "BUY_IN_FULL" | "ROUTE_TO_PAY_IN_4" | "DECLINE_PURCHASE";
  currentBalance: number;
  safetyFloor: number;
  mandatoryRent: number;
  itemPrice: number;
  lowestDipFull: number;
  lowestDipPayIn4: number;
  payIn4Installment: number;
  riskScore: number;
  explanation: string;
}

/**
 * Deterministic transition function mapping spend inputs to an explicit Affordability State.
 */
export function evaluateAffordabilityFSM(
  amount: number,
  balance: number = FINANCIAL_STATE.CURRENT_BALANCE,
  safetyFloor: number = FINANCIAL_STATE.SAFETY_BUFFER_FLOOR
): AffordabilityFSMState {
  const rentObligation = 1200.0; // Primary upcoming mandatory outflow due on 1st
  const safeSpendCapacityFull = Math.max(0, balance - rentObligation - safetyFloor); // $150.00
  const installment = amount / 4;
  const lowestDipFull = balance - rentObligation - amount;
  const lowestDipPayIn4 = balance - rentObligation - installment;

  const safeInFull = amount <= safeSpendCapacityFull && lowestDipFull >= safetyFloor;
  const payIn4Eligible = amount >= 30.0 && amount <= 1500.0;
  const payIn4Safe = payIn4Eligible && lowestDipPayIn4 >= safetyFloor;

  if (safeInFull) {
    return {
      tier: "TIER_SAFE_IN_FULL",
      recommendedAction: "BUY_IN_FULL",
      currentBalance: balance,
      safetyFloor,
      mandatoryRent: rentObligation,
      itemPrice: amount,
      lowestDipFull,
      lowestDipPayIn4,
      payIn4Installment: installment,
      riskScore: 98,
      explanation: `Safe to pay in full. Spending $${amount.toFixed(2)} leaves a projected post-rent buffer of $${lowestDipFull.toFixed(2)}, safely preserving your $${safetyFloor.toFixed(2)} floor.`,
    };
  }

  if (payIn4Safe) {
    return {
      tier: "TIER_PAY_IN_4_RECOMMENDED",
      recommendedAction: "ROUTE_TO_PAY_IN_4",
      currentBalance: balance,
      safetyFloor,
      mandatoryRent: rentObligation,
      itemPrice: amount,
      lowestDipFull,
      lowestDipPayIn4,
      payIn4Installment: installment,
      riskScore: 78,
      explanation: `Paying $${amount.toFixed(2)} in full leaves only $${lowestDipFull.toFixed(2)} after rent (< $${safetyFloor.toFixed(2)} floor). PayPal Pay in 4 only requires $${installment.toFixed(2)} today, keeping your projected balance at $${lowestDipPayIn4.toFixed(2)} (> $${safetyFloor.toFixed(2)} floor).`,
    };
  }

  return {
    tier: "TIER_OVERDRAFT_BLOCKED",
    recommendedAction: "DECLINE_PURCHASE",
    currentBalance: balance,
    safetyFloor,
    mandatoryRent: rentObligation,
    itemPrice: amount,
    lowestDipFull,
    lowestDipPayIn4,
    payIn4Installment: installment,
    riskScore: 24,
    explanation: `Overdraft risk: Even with PayPal Pay in 4, spending leaves your cushion at $${lowestDipPayIn4.toFixed(2)}, which violates your $${safetyFloor.toFixed(2)} minimum safety buffer. Purchase should be deferred.`,
  };
}

/**
 * Machine-readable state projection for autonomous AI agents (AX).
 */
export function getAffordabilityFSMAgentView(fsm: AffordabilityFSMState) {
  return {
    affordability_tier: fsm.tier,
    recommended_action: fsm.recommendedAction,
    is_safe: fsm.tier !== "TIER_OVERDRAFT_BLOCKED",
    pay_in_4_recommended: fsm.tier === "TIER_PAY_IN_4_RECOMMENDED",
    risk_score: fsm.riskScore,
    floor_protected: fsm.tier !== "TIER_OVERDRAFT_BLOCKED",
  };
}
