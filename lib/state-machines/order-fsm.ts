/**
 * PayPal Order & Settlement Finite State Machine (FSM)
 * Elevates UX (deterministic transitions & recovery), DX (discriminated unions),
 * and AX (machine-readable agent inspection).
 */

export type OrderFSMStatus =
  | "PENDING_APPROVAL"
  | "CHECKOUT_OPENED"
  | "CAPTURING"
  | "SETTLED"
  | "CAPTURE_ERROR"
  | "REJECTED";

export type OrderFSMState =
  | {
      status: "PENDING_APPROVAL";
      orderId: string;
      approveUrl?: string;
    }
  | {
      status: "CHECKOUT_OPENED";
      orderId: string;
      approveUrl?: string;
      openedAt: number;
    }
  | {
      status: "CAPTURING";
      orderId: string;
      startedAt: number;
    }
  | {
      status: "SETTLED";
      orderId: string;
      captureId?: string;
      settledAt: number;
    }
  | {
      status: "CAPTURE_ERROR";
      orderId: string;
      errorMessage: string;
      canRetry: boolean;
    }
  | {
      status: "REJECTED";
      orderId: string;
      rejectedAt: number;
      reason: string;
    };

export type OrderFSMEvent =
  | { type: "AUTHORIZE_AND_OPEN"; approveUrl?: string }
  | { type: "START_CAPTURE" }
  | { type: "CAPTURE_SUCCESS"; captureId?: string }
  | { type: "CAPTURE_FAILURE"; error: string }
  | { type: "RETRY_CAPTURE" }
  | { type: "REJECT"; reason?: string }
  | { type: "RESET" };

export function createInitialOrderFSM(
  orderId: string,
  initialStatus: "pending" | "authorized" = "pending",
  approveUrl?: string
): OrderFSMState {
  if (initialStatus === "authorized") {
    return {
      status: "CHECKOUT_OPENED",
      orderId,
      approveUrl,
      openedAt: Date.now(),
    };
  }
  return {
    status: "PENDING_APPROVAL",
    orderId,
    approveUrl,
  };
}

export function orderFSMReducer(
  state: OrderFSMState,
  event: OrderFSMEvent
): OrderFSMState {
  switch (state.status) {
    case "PENDING_APPROVAL":
      if (event.type === "AUTHORIZE_AND_OPEN") {
        return {
          status: "CHECKOUT_OPENED",
          orderId: state.orderId,
          approveUrl: event.approveUrl || state.approveUrl,
          openedAt: Date.now(),
        };
      }
      if (event.type === "REJECT") {
        return {
          status: "REJECTED",
          orderId: state.orderId,
          rejectedAt: Date.now(),
          reason: event.reason || "Payment cancelled by user. Safety buffer floor preserved.",
        };
      }
      return state;

    case "CHECKOUT_OPENED":
      if (event.type === "START_CAPTURE") {
        return {
          status: "CAPTURING",
          orderId: state.orderId,
          startedAt: Date.now(),
        };
      }
      if (event.type === "REJECT") {
        return {
          status: "REJECTED",
          orderId: state.orderId,
          rejectedAt: Date.now(),
          reason: event.reason || "Cancelled after checkout review.",
        };
      }
      return state;

    case "CAPTURING":
      if (event.type === "CAPTURE_SUCCESS") {
        return {
          status: "SETTLED",
          orderId: state.orderId,
          captureId: event.captureId,
          settledAt: Date.now(),
        };
      }
      if (event.type === "CAPTURE_FAILURE") {
        return {
          status: "CAPTURE_ERROR",
          orderId: state.orderId,
          errorMessage: event.error,
          canRetry: true,
        };
      }
      return state;

    case "CAPTURE_ERROR":
      if (event.type === "RETRY_CAPTURE") {
        return {
          status: "CAPTURING",
          orderId: state.orderId,
          startedAt: Date.now(),
        };
      }
      if (event.type === "REJECT") {
        return {
          status: "REJECTED",
          orderId: state.orderId,
          rejectedAt: Date.now(),
          reason: event.reason || "Abandoned after capture failure.",
        };
      }
      return state;

    case "SETTLED":
    case "REJECTED":
      if (event.type === "RESET") {
        return {
          status: "PENDING_APPROVAL",
          orderId: state.orderId,
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
export function getOrderFSMAgentView(state: OrderFSMState) {
  const allowedEvents: OrderFSMEvent["type"][] = (() => {
    switch (state.status) {
      case "PENDING_APPROVAL":
        return ["AUTHORIZE_AND_OPEN", "REJECT"];
      case "CHECKOUT_OPENED":
        return ["START_CAPTURE", "REJECT"];
      case "CAPTURING":
        return ["CAPTURE_SUCCESS", "CAPTURE_FAILURE"];
      case "CAPTURE_ERROR":
        return ["RETRY_CAPTURE", "REJECT"];
      case "SETTLED":
      case "REJECTED":
        return ["RESET"];
    }
  })();

  return {
    current_status: state.status,
    order_id: state.orderId,
    requires_human_approval: state.status === "PENDING_APPROVAL",
    is_terminal: state.status === "SETTLED" || state.status === "REJECTED",
    allowed_events: allowedEvents,
  };
}

