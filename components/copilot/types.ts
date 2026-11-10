export type SubAgentId =
  | "guardian-core"
  | "autonomous-trader"
  | "merchant-invoicing"
  | "budget-insights"
  | "risk-analyst"
  | "escrow-agent"
  | "scraper-bot"
  | "code-audit";

export type ActionCardType =
  | "order_card"
  | "invoice_preview"
  | "transaction_insight"
  | "order_verification"
  | "contract_summary"
  | "dispute_risk"
  | "webhook_inspect"
  | "balance_snapshot"
  | "affordability"
  | "product_recommendation"
  | "bento_analytics";

export interface OrderCardData {
  orderId: string;
  item: string;
  price: number;
  currency?: string;
  merchant: string;
  status?: string;
  approveUrl?: string;
  payIn4?: boolean;
}

export interface InvoiceItemData {
  name: string;
  quantity: number;
  unit_amount: number;
}

export interface InvoicePreviewData {
  invoiceId: string;
  recipientEmail: string;
  total: number;
  currency?: string;
  dueDate?: string;
  items: InvoiceItemData[];
  paymentUrl?: string;
  status?: string;
}

export interface CategorySpendBreakdown {
  category: string;
  spent: number;
  budget: number;
  percentage: number;
  is_near_limit?: boolean;
}

export interface TransactionInsightData {
  title?: string;
  periodDays?: number;
  totalSpend?: number;
  safeDiscretionaryRemaining?: number;
  breakdown: CategorySpendBreakdown[];
}

export interface OrderVerificationData {
  orderId: string;
  amount: number;
  currency: string;
  merchant: string;
  status: "APPROVED" | "COMPLETED" | "HOLD";
  safetyScore: number;
  riskTier: "MINIMAL" | "MODERATE" | "HIGH";
  disputeProbability: number;
  bufferImpact: number;
  postOrderBalance: number;
  payIn4Recommended: boolean;
  captureUrl?: string;
}

export interface ContractSummaryData {
  contractId: string;
  title: string;
  counterparty: string;
  escrowValue: number;
  currency: string;
  milestonesCount: number;
  verifiedMilestones: number;
  liabilityCap: number;
  disputeResolution: string;
  complianceScore: number;
  keyRisks: string[];
}

export interface DisputeRiskData {
  accountOrBatch: string;
  transactionsSampled: number;
  projectedChargebackRate: number;
  industryBenchmark: number;
  overallRiskLevel: "LOW" | "ELEVATED" | "CRITICAL";
  highRiskFlags: string[];
  recommendedMitigations: string[];
  safeBufferPreserved: boolean;
}

export interface WebhookInspectData {
  eventId: string;
  eventType: string;
  timestamp: string;
  latencyMs: number;
  signatureStatus: "VALID" | "TAMPERED" | "EXPIRED";
  algorithm: string;
  payloadSummary: {
    resourceType: string;
    resourceId: string;
    status: string;
    merchantId: string;
  };
  headers: Record<string, string>;
}

export interface BalanceSnapshotData {
  balance: number;
  buffer: number;
  discretionary: number;
  outflows: number;
  currency: string;
  status: "HEALTHY" | "TIGHT" | "CRITICAL";
}

export interface AffordabilityData {
  item: string;
  amount: number;
  installment: number;
  payInFullSafe: boolean;
  payInFullLowest: number;
  payIn4Safe: boolean;
  payIn4Lowest: number;
}

export interface RecommendedProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  retailer: string;
  availability?: string;
  imageUrl?: string;
  buyUrl?: string;
  affordabilityStatus: "SAFE_FULL" | "SAFE_PAY_IN_4" | "OVERDRAFT";
  lowestDip: number;
  installment: number;
}

export interface ProductRecommendationData {
  query: string;
  budgetCap: number;
  products: RecommendedProduct[];
}

export interface ActionCardPayload {
  type: ActionCardType;
  event?: "APPROVAL_REQUIRED" | "EXECUTED";
  orderCardData?: OrderCardData;
  invoicePreviewData?: InvoicePreviewData;
  transactionInsightData?: TransactionInsightData;
  orderData?: OrderVerificationData;
  contractData?: ContractSummaryData;
  disputeData?: DisputeRiskData;
  webhookData?: WebhookInspectData;
  balanceData?: BalanceSnapshotData;
  affordabilityData?: AffordabilityData;
  productData?: ProductRecommendationData;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  agentId?: SubAgentId;
  text: string;
  reasoning?: string;
  timestamp: string;
  actionCard?: ActionCardPayload;
  latencyMs?: number;
  modelBadge?: string;
}

export interface HistorySession {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
  agentId: SubAgentId;
  preview: string;
  messages: ChatMessage[];
  dateGroup?: "today" | "previous7Days";
}

