/**
 * PayPal Invoicing Finite State Machine (FSM)
 * Elevates UX (explicit dispatching & error recovery), DX (strongly typed outcomes),
 * and AX (machine-readable agent reflection).
 */

export type InvoiceFSMStatus =
  | "DRAFT_PREVIEW"
  | "DISPATCHING"
  | "DISPATCHED"
  | "DISPATCH_ERROR";

export type InvoiceDispatchedData = {
  invoiceId: string;
  invoiceNumber?: string;
  status: string;
  paymentUrl?: string;
  isMock?: boolean;
  dispatchedAt: number;
};

export type InvoiceFSMState =
  | {
      status: "DRAFT_PREVIEW";
      invoiceId: string;
      recipientEmail: string;
      total: number;
    }
  | {
      status: "DISPATCHING";
      invoiceId: string;
      recipientEmail: string;
      total: number;
      startedAt: number;
    }
  | {
      status: "DISPATCHED";
      invoiceId: string;
      data: InvoiceDispatchedData;
    }
  | {
      status: "DISPATCH_ERROR";
      invoiceId: string;
      errorMessage: string;
      canRetry: boolean;
    };

export type InvoiceFSMEvent =
  | { type: "START_DISPATCH" }
  | { type: "DISPATCH_SUCCESS"; data: InvoiceDispatchedData }
  | { type: "DISPATCH_FAILURE"; error: string }
  | { type: "RETRY_DISPATCH" }
  | { type: "RESET_TO_DRAFT" };

export function createInitialInvoiceFSM(
  invoiceId: string,
  recipientEmail: string,
  total: number
): InvoiceFSMState {
  return {
    status: "DRAFT_PREVIEW",
    invoiceId,
    recipientEmail,
    total,
  };
}

export function invoiceFSMReducer(
  state: InvoiceFSMState,
  event: InvoiceFSMEvent
): InvoiceFSMState {
  switch (state.status) {
    case "DRAFT_PREVIEW":
      if (event.type === "START_DISPATCH") {
        return {
          status: "DISPATCHING",
          invoiceId: state.invoiceId,
          recipientEmail: state.recipientEmail,
          total: state.total,
          startedAt: Date.now(),
        };
      }
      return state;

    case "DISPATCHING":
      if (event.type === "DISPATCH_SUCCESS") {
        return {
          status: "DISPATCHED",
          invoiceId: state.invoiceId,
          data: event.data,
        };
      }
      if (event.type === "DISPATCH_FAILURE") {
        return {
          status: "DISPATCH_ERROR",
          invoiceId: state.invoiceId,
          errorMessage: event.error,
          canRetry: true,
        };
      }
      return state;

    case "DISPATCH_ERROR":
      if (event.type === "RETRY_DISPATCH") {
        return {
          status: "DISPATCHING",
          invoiceId: state.invoiceId,
          recipientEmail: "",
          total: 0,
          startedAt: Date.now(),
        };
      }
      if (event.type === "RESET_TO_DRAFT") {
        return {
          status: "DRAFT_PREVIEW",
          invoiceId: state.invoiceId,
          recipientEmail: "",
          total: 0,
        };
      }
      return state;

    case "DISPATCHED":
      if (event.type === "RESET_TO_DRAFT") {
        return {
          status: "DRAFT_PREVIEW",
          invoiceId: state.invoiceId,
          recipientEmail: "",
          total: 0,
        };
      }
      return state;

    default:
      return state;
  }
}

/**
 * Machine-readable state projection for autonomous AI agents (AX).
 */
export function getInvoiceFSMAgentView(state: InvoiceFSMState) {
  return {
    current_status: state.status,
    invoice_id: state.invoiceId,
    is_dispatched: state.status === "DISPATCHED",
    is_terminal: state.status === "DISPATCHED",
    can_retry: state.status === "DISPATCH_ERROR",
  };
}

