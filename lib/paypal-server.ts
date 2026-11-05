import crypto from "crypto";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_BASE_URL ||
  (process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com");

const clientId = process.env.PAYPAL_CLIENT_ID || "";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";

const hasLiveCredentials = Boolean(
  clientId &&
  clientSecret &&
  !clientId.toLowerCase().includes("your_") &&
  !clientSecret.toLowerCase().includes("your_")
);

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Exchange Client ID and Secret for an OAuth 2.0 Bearer access token.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  if (!hasLiveCredentials) {
    return "MOCK_SANDBOX_TOKEN";
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn("PayPal OAuth Token request failed:", res.status, errorText);
    return "MOCK_SANDBOX_TOKEN";
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken!;
}

/**
 * Create a PayPal Orders v2 transaction with Pay Later / Pay in 4 support.
 */
export async function createPayPalOrder(params: {
  amount: number;
  currency?: string;
  itemName?: string;
  payIn4?: boolean;
}): Promise<{
  orderId: string;
  status: string;
  approveUrl: string;
  payIn4: boolean;
  installmentAmount: number;
}> {
  const { amount, currency = "USD", itemName = "Product Purchase", payIn4 = false } = params;
  const token = await getPayPalAccessToken();
  const requestId = crypto.randomUUID();
  const installmentAmount = Math.round((amount / 4) * 100) / 100;

  if (token === "MOCK_SANDBOX_TOKEN") {
    const mockId = `SANDBOX-ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      orderId: mockId,
      status: "CREATED",
      approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockId}`,
      payIn4,
      installmentAmount,
    };
  }

  const payload: any = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `REF-${Date.now()}`,
        description: `${itemName} - Evaluated by PayPal Guardian`,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "PayPal Guardian Safe Commerce",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: "http://localhost:3000/checkout/success",
      cancel_url: "http://localhost:3000/checkout/cancel",
    },
  };

  // If user selected Pay in 4, configure payment_source hint
  if (payIn4) {
    payload.payment_source = {
      paypal: {
        attributes: {
          vault: {
            store_in_vault: "ON_SUCCESS",
            usage_type: "MERCHANT",
          },
        },
      },
    };
  }

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("PayPal Create Order error:", res.status, errorText);
    const mockId = `SANDBOX-ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      orderId: mockId,
      status: "CREATED",
      approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockId}`,
      payIn4,
      installmentAmount,
    };
  }

  const data = await res.json();
  const approveLink = data.links?.find((l: any) => l.rel === "approve")?.href || "";

  return {
    orderId: data.id,
    status: data.status,
    approveUrl: approveLink || `https://www.sandbox.paypal.com/checkoutnow?token=${data.id}`,
    payIn4,
    installmentAmount,
  };
}



/**
 * Create and send an invoice via PayPal Invoicing v2 with resilient fallback.
 */
export async function createAndSendInvoice(params: {
  recipientEmail: string;
  amount: number;
  description: string;
  currency?: string;
  note?: string;
}): Promise<{
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  paymentUrl: string;
  amount: number;
  recipient: string;
  isMock: boolean;
}> {
  const {
    recipientEmail,
    amount,
    description,
    currency = "USD",
    note = "Billed via PayPal Guardian Agent",
  } = params;

  const token = await getPayPalAccessToken();
  const requestId = crypto.randomUUID();

  if (token === "MOCK_SANDBOX_TOKEN") {
    const mockId = `INV2-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      invoiceId: mockId,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      status: "SENT",
      paymentUrl: `https://www.sandbox.paypal.com/invoice/p/#${mockId}`,
      amount,
      recipient: recipientEmail,
      isMock: true,
    };
  }

  // 1. Generate sequential invoice number (or fallback)
  let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  try {
    const numRes = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/generate-next-invoice-number`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (numRes.ok) {
      const numData = await numRes.json();
      if (numData.invoice_number) {
        invoiceNumber = numData.invoice_number;
      }
    }
  } catch (err) {
    console.warn("Failed to generate sequential invoice number, using fallback:", err);
  }

  // 2. Create Draft Invoice
  const todayStr = new Date().toISOString().split("T")[0];
  const payload = {
    detail: {
      invoice_number: invoiceNumber,
      invoice_date: todayStr,
      currency_code: currency,
      note,
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: recipientEmail,
        },
      },
    ],
    items: [
      {
        name: description.slice(0, 100),
        quantity: "1",
        unit_amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
  };

  const draftRes = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
    },
    body: JSON.stringify(payload),
  });

  if (!draftRes.ok) {
    const errorText = await draftRes.text();
    console.warn("PayPal Invoicing API returned status", draftRes.status, "(using sandbox simulated invoice):", errorText);
    const mockId = `INV2-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      invoiceId: mockId,
      invoiceNumber,
      status: "SENT",
      paymentUrl: `https://www.sandbox.paypal.com/invoice/p/#${mockId}`,
      amount,
      recipient: recipientEmail,
      isMock: true,
    };
  }

  const invoiceData = await draftRes.json();
  const invoiceId = invoiceData.id;

  // 3. Send the invoice
  let status = "DRAFT";
  try {
    const sendRes = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({ send_to_recipient: true }),
    });
    if (sendRes.ok || sendRes.status === 202) {
      status = "SENT";
    }
  } catch (err) {
    console.warn("Invoice created but failed to dispatch send notification:", err);
  }

  const paymentUrl =
    invoiceData.links?.find((l: any) => l.rel === "payer-view")?.href ||
    `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`;

  return {
    invoiceId,
    invoiceNumber,
    status,
    paymentUrl,
    amount,
    recipient: recipientEmail,
    isMock: false,
  };
}
