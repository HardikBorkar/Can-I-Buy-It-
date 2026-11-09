/**
 * PayPal Checkout Finite State Machine (FSM)
 * Eliminates race conditions, duplicate submissions, and ambiguous loading states.
 */

export type CheckoutFSMStatus =
  | "IDLE"
  | "INITIALIZING_ORDER"
  | "APPROVAL_REDIRECTING"
  | "ORDER_AUTHORIZED"
  | "ORDER_ERROR";

export type CheckoutFSMState =
  | { status: "IDLE" }
  | {
      status: "INITIALIZING_ORDER";
      itemName: string;
      amount: number;
      usePayIn4: boolean;
      startedAt: number;
    }
  | {
      status: "APPROVAL_REDIRECTING";
      orderId: string;
      approveUrl?: string;
      redirectAt: number;
    }
  | {
      status: "ORDER_AUTHORIZED";
      orderId: string;
      amount: number;
      usePayIn4: boolean;
      installmentAmount?: number;
      approveUrl?: string;
    }
  | {
      status: "ORDER_ERROR";
      errorMessage: string;
      canRetry: boolean;
    };

export type CheckoutFSMEvent =
  | { type: "START_CHECKOUT"; itemName: string; amount: number; usePayIn4: boolean }
  | {
      type: "CHECKOUT_SUCCESS";
      orderId: string;
      amount: number;
      usePayIn4: boolean;
      installmentAmount?: number;
      approveUrl?: string;
    }
  | { type: "CHECKOUT_FAILURE"; error: string }
  | { type: "RESET" };

export function createInitialCheckoutFSM(): CheckoutFSMState {
  return { status: "IDLE" };
}

export function checkoutFSMReducer(
  state: CheckoutFSMState,
  event: CheckoutFSMEvent
): CheckoutFSMState {
  switch (state.status) {
    case "IDLE":
    case "ORDER_ERROR":
    case "ORDER_AUTHORIZED":
      if (event.type === "START_CHECKOUT") {
        return {
          status: "INITIALIZING_ORDER",
          itemName: event.itemName,
          amount: event.amount,
          usePayIn4: event.usePayIn4,
          startedAt: Date.now(),
        };
      }
      if (event.type === "RESET") {
        return { status: "IDLE" };
      }
      return state;

    case "INITIALIZING_ORDER":
      if (event.type === "CHECKOUT_SUCCESS") {
        if (event.approveUrl) {
          return {
            status: "APPROVAL_REDIRECTING",
            orderId: event.orderId,
            approveUrl: event.approveUrl,
            redirectAt: Date.now(),
          };
        }
        return {
          status: "ORDER_AUTHORIZED",
          orderId: event.orderId,
          amount: event.amount,
          usePayIn4: event.usePayIn4,
          installmentAmount: event.installmentAmount,
        };
      }
      if (event.type === "CHECKOUT_FAILURE") {
        return {
          status: "ORDER_ERROR",
          errorMessage: event.error,
          canRetry: true,
        };
      }
      return state;

    case "APPROVAL_REDIRECTING":
      if (event.type === "RESET") {
        return { status: "IDLE" };
      }
      return state;

    default:
      return state;
  }
}

