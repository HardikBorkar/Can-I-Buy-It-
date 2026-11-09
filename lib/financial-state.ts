/**
 * Shared Financial State & Invariant Rules.
 * Single source of truth for PayPal Guardian balance, recurring commitments,
 * and deterministic safe-to-spend evaluations across Storefront, Copilot, and Dashboard.
 */

export interface Commitment {
  id: string;
  name: string;
  category: "Housing" | "SaaS & Tech" | "Utilities" | "Health" | "Income";
  amount: number;
  cadence: "Monthly" | "Bi-Weekly" | "Weekly";
  nextDueDate: string;
  autopay: boolean;
  impactScore: "High" | "Medium" | "Low";
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: "PAY_IN_FULL" | "PAY_IN_4" | "PAYPAL_CREDIT" | "DIRECT_TRANSFER";
  status: "COMPLETED" | "PENDING" | "REFUNDED" | "CREATED";
  payer: string;
}

export const FINANCIAL_STATE = {
  CURRENT_BALANCE: 1850.0,
  SAFETY_BUFFER_FLOOR: 500.0,
  UPCOMING_COMMITMENTS_30D: 1392.0,
  SAFE_DISCRETIONARY_SPEND: 1350.0,
  // Lowest cash dip during monthly billing cycle (Day 4 after $1,200 rent + nominal living expenses)
  LOWEST_PROJECTED_CYCLE_DIP: 590.0,
  CURRENCY: "USD",
  ACCOUNT_EMAIL: "Verified Sandbox Merchant",
};

export const RECURRING_COMMITMENTS: Commitment[] = [
  {
    id: "com-1",
    name: "Apartment Rent",
    category: "Housing",
    amount: -1200.0,
    cadence: "Monthly",
    nextDueDate: "1st of month",
    autopay: true,
    impactScore: "High",
  },
  {
    id: "com-2",
    name: "AWS / Cloud Infrastructure",
    category: "SaaS & Tech",
    amount: -85.0,
    cadence: "Monthly",
    nextDueDate: "15th of month",
    autopay: true,
    impactScore: "Medium",
  },
  {
    id: "com-3",
    name: "Software Tools (GitHub, ChatGPT)",
    category: "SaaS & Tech",
    amount: -42.0,
    cadence: "Monthly",
    nextDueDate: "18th of month",
    autopay: true,
    impactScore: "Low",
  },
  {
    id: "com-4",
    name: "Gym & Health Club",
    category: "Health",
    amount: -65.0,
    cadence: "Monthly",
    nextDueDate: "22nd of month",
    autopay: true,
    impactScore: "Low",
  },
  {
    id: "com-5",
    name: "Direct Deposit / Salary",
    category: "Income",
    amount: 2200.0,
    cadence: "Bi-Weekly",
    nextDueDate: "10th & 25th",
    autopay: false,
    impactScore: "High",
  },
];

export function getSampleTransactions(today: Date = new Date()): Transaction[] {
  return [
    {
      id: "3N4420081Y251854T",
      date: new Date(today.getTime() - 2 * 3600000).toISOString().split("T")[0],
      description: "Channel3 Adidas Sneaker",
      category: "Shopping",
      amount: -89.5,
      paymentMethod: "PAY_IN_4",
      status: "COMPLETED",
      payer: "Verified Merchant Account",
    },
    {
      id: "0U603912J86200723",
      date: new Date(today.getTime() - 5 * 3600000).toISOString().split("T")[0],
      description: "Sony WH-1000XM5 Headphones",
      category: "Electronics",
      amount: -199.99,
      paymentMethod: "PAY_IN_FULL",
      status: "COMPLETED",
      payer: "Verified Merchant Account",
    },
    {
      id: "INV2-9844-8821-4190",
      date: new Date(today.getTime() - 24 * 3600000).toISOString().split("T")[0],
      description: "PayPal Invoicing: UI Consulting",
      category: "Income",
      amount: 450.0,
      paymentMethod: "DIRECT_TRANSFER",
      status: "COMPLETED",
      payer: "client@venturecap.io",
    },
    {
      id: "ORD-99120-X88",
      date: new Date(today.getTime() - 48 * 3600000).toISOString().split("T")[0],
      description: "GitHub Copilot Enterprise",
      category: "Software",
      amount: -19.0,
      paymentMethod: "PAYPAL_CREDIT",
      status: "COMPLETED",
      payer: "Verified Merchant Account",
    },
    {
      id: "ORD-77412-M22",
      date: new Date(today.getTime() - 72 * 3600000).toISOString().split("T")[0],
      description: "Target Groceries & Supplies",
      category: "Supplies",
      amount: -114.3,
      paymentMethod: "PAY_IN_FULL",
      status: "COMPLETED",
      payer: "Verified Merchant Account",
    },
    {
      id: "INV2-1102-3391-7781",
      date: new Date(today.getTime() - 96 * 3600000).toISOString().split("T")[0],
      description: "PayPal Invoicing: Brand Strategy",
      category: "Income",
      amount: 600.0,
      paymentMethod: "DIRECT_TRANSFER",
      status: "COMPLETED",
      payer: "growth@startup.co",
    },
  ];
}

export interface SpendEvaluationResult {
  amount: number;
  currency: string;
  item_name?: string;
  current_balance: number;
  safety_buffer: number;
  upcoming_commitments: number;
  projected_remaining_balance: number;
  safe_in_full: boolean;
  recommended_action: "APPROVE_FULL" | "RECOMMEND_PAY_IN_4" | "UNSAFE_DELAY";
  pay_in_4: {
    available: boolean;
    installments: number;
    biweekly_payment: number;
    safe: boolean;
    first_payment_today: number;
  };
  explanation: string;
}

export function evaluateSpendAgainstInvariants(
  amount: number,
  itemName: string = "Product Purchase",
  currency: string = "USD"
): SpendEvaluationResult {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const currentBalance = FINANCIAL_STATE.CURRENT_BALANCE;
  const safetyBuffer = FINANCIAL_STATE.SAFETY_BUFFER_FLOOR;
  const upcomingCommitments = FINANCIAL_STATE.UPCOMING_COMMITMENTS_30D;
  const lowestDip = FINANCIAL_STATE.LOWEST_PROJECTED_CYCLE_DIP;

  const installmentAmount = Math.round((safeAmount / 4) * 100) / 100;
  const postFullDip = Math.round((lowestDip - safeAmount) * 100) / 100;
  const postInstallmentDip = Math.round((lowestDip - installmentAmount) * 100) / 100;

  const safeToSpendFull = postFullDip >= safetyBuffer;
  const safeWithPayIn4 = postInstallmentDip >= safetyBuffer;
  const payIn4Available = safeAmount >= 30 && safeAmount <= 1500;

  let recommendedAction: "APPROVE_FULL" | "RECOMMEND_PAY_IN_4" | "UNSAFE_DELAY" = "UNSAFE_DELAY";
  let explanation = "";

  if (safeToSpendFull) {
    recommendedAction = "APPROVE_FULL";
    explanation = `Safe to purchase today! After this $${safeAmount.toFixed(
      2
    )} purchase and upcoming recurring bills ($${upcomingCommitments.toFixed(
      2
    )}), your cash cushion remains safely at $${postFullDip.toFixed(
      2
    )}, above your $${safetyBuffer.toFixed(2)} minimum reserve floor.`;
  } else if (payIn4Available && safeWithPayIn4) {
    recommendedAction = "RECOMMEND_PAY_IN_4";
    explanation = `⚠️ Paying $${safeAmount.toFixed(
      2
    )} in full breaches your $${safetyBuffer.toFixed(
      2
    )} safety buffer before your next paycheck when rent hits. However, **PayPal Pay in 4** ($${installmentAmount.toFixed(
      2
    )} today) keeps your buffer safely at $${postInstallmentDip.toFixed(2)}!`;
  } else {
    recommendedAction = "UNSAFE_DELAY";
    explanation = `🛑 Unsafe to purchase right now. This purchase causes your account balance to fall below your $${safetyBuffer.toFixed(
      2
    )} safety reserve during your upcoming billing cycle.`;
  }

  return {
    amount: safeAmount,
    currency,
    item_name: itemName,
    current_balance: currentBalance,
    safety_buffer: safetyBuffer,
    upcoming_commitments: upcomingCommitments,
    projected_remaining_balance: Math.round((currentBalance - safeAmount) * 100) / 100,
    safe_in_full: safeToSpendFull,
    recommended_action: recommendedAction,
    pay_in_4: {
      available: payIn4Available,
      installments: 4,
      biweekly_payment: installmentAmount,
      safe: safeWithPayIn4,
      first_payment_today: installmentAmount,
    },
    explanation,
  };
}

