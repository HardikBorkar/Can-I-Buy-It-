"""
PayPal Sandbox REST API Client (v2).
Provides authenticated interactions with PayPal Sandbox:
- OAuth 2.0 token caching and automatic lifecycle refresh.
- Balance retrieval (/v1/reporting/balances).
- Transaction search & history ingestion (/v1/reporting/transactions).
- Orders v2 creation with Pay Later support and HATEOAS approval link extraction.
- Invoicing v2 draft generation and dispatch.
- Robust error handling with debug_id extraction and UUID idempotency (PayPal-Request-Id).
"""

import base64
from datetime import datetime, timedelta, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional
import uuid

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("paypal_guardian.client")


class PayPalAPIError(Exception):
    """Custom exception raised when PayPal REST API returns an error response."""

    def __init__(self, message: str, status_code: int = 0, debug_id: str = "", details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.debug_id = debug_id
        self.details = details or []


class PayPalClient:
    """
    Client for interacting with the PayPal Developer Platform.
    Defaults to the Sandbox environment (https://api-m.sandbox.paypal.com).
    """

    SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"
    LIVE_BASE_URL = "https://api-m.paypal.com"

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        mode: str = "sandbox",
        mock_fallback: bool = True,
    ):
        self.client_id = client_id or os.getenv("PAYPAL_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("PAYPAL_CLIENT_SECRET", "")
        self.mode = (mode or os.getenv("PAYPAL_MODE", "sandbox")).lower()
        self.base_url = self.SANDBOX_BASE_URL if self.mode == "sandbox" else self.LIVE_BASE_URL
        self.mock_fallback = mock_fallback

        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    @property
    def has_credentials(self) -> bool:
        """Return True if non-placeholder credentials are provided."""
        return bool(
            self.client_id
            and self.client_secret
            and "your_" not in self.client_id.lower()
            and "your_" not in self.client_secret.lower()
        )

    # =========================================================================
    # 1. AUTHENTICATION & TOKEN LIFECYCLE
    # =========================================================================

    def get_access_token(self, force_refresh: bool = False) -> str:
        """
        Exchange client_id and client_secret for an OAuth 2.0 Bearer access token.
        Caches the token and automatically refreshes 60 seconds before expiration.
        """
        now = datetime.now(timezone.utc)
        if (
            not force_refresh
            and self._access_token
            and self._token_expires_at
            and now < (self._token_expires_at - timedelta(seconds=60))
        ):
            return self._access_token

        if not self.has_credentials:
            if self.mock_fallback:
                logger.warning("No PayPal credentials provided; using simulated sandbox token.")
                self._access_token = "MOCK_SANDBOX_TOKEN"
                self._token_expires_at = now + timedelta(hours=8)
                return self._access_token
            raise PayPalAPIError("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.")

        token_url = f"{self.base_url}/v1/oauth2/token"
        auth_bytes = f"{self.client_id}:{self.client_secret}".encode("utf-8")
        basic_auth = base64.b64encode(auth_bytes).decode("ascii")

        headers = {
            "Authorization": f"Basic {basic_auth}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        }
        data = {"grant_type": "client_credentials"}

        try:
            resp = requests.post(token_url, headers=headers, data=data, timeout=15)
        except requests.RequestException as e:
            raise PayPalAPIError(f"Network error authenticating with PayPal: {e}") from e

        if resp.status_code != 200:
            error_data = resp.json() if resp.content else {}
            err_msg = error_data.get("error_description") or error_data.get("message") or resp.text
            raise PayPalAPIError(
                f"Failed to obtain PayPal OAuth token [{resp.status_code}]: {err_msg}",
                status_code=resp.status_code,
                debug_id=resp.headers.get("PayPal-Debug-Id", ""),
                details=error_data,
            )

        token_data = resp.json()
        self._access_token = token_data["access_token"]
        expires_in = int(token_data.get("expires_in", 32000))
        self._token_expires_at = now + timedelta(seconds=expires_in)
        logger.info("Successfully refreshed PayPal Sandbox access token (expires in %ds).", expires_in)
        return self._access_token

    def _headers(self, custom_request_id: Optional[str] = None) -> Dict[str, str]:
        """Generate standardized headers with Bearer token and idempotency UUID."""
        token = self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "PayPal-Request-Id": custom_request_id or str(uuid.uuid4()),
        }
        return headers

    # =========================================================================
    # 2. REPORTING & ACCOUNT BALANCES
    # =========================================================================

    def get_balances(self, currency_code: str = "USD") -> Dict[str, Any]:
        """
        Fetch primary PayPal Sandbox account balance.
        Endpoint: GET /v1/reporting/balances
        """
        if not self.has_credentials and self.mock_fallback:
            return {
                "currency": currency_code,
                "available_balance": 1850.00,
                "total_balance": 1850.00,
                "held_balance": 0.00,
                "is_mock": True,
            }

        url = f"{self.base_url}/v1/reporting/balances?currency_code={currency_code}"
        resp = requests.get(url, headers=self._headers(), timeout=15)

        if resp.status_code == 200:
            data = resp.json()
            balances = data.get("balances", [])
            for b in balances:
                if b.get("currency") == currency_code:
                    avail = float(b.get("available_balance", {}).get("value", 0.0))
                    total = float(b.get("total_balance", {}).get("value", 0.0))
                    return {
                        "currency": currency_code,
                        "available_balance": avail,
                        "total_balance": total,
                        "held_balance": total - avail,
                        "raw": b,
                        "is_mock": False,
                    }
            return {"currency": currency_code, "available_balance": 0.0, "total_balance": 0.0, "is_mock": False}

        # Fallback to mock if sandbox balance endpoint is restricted on free tier app
        if self.mock_fallback:
            logger.warning("Balances API failed with status %d; using simulated sandbox balance.", resp.status_code)
            return {
                "currency": currency_code,
                "available_balance": 1850.00,
                "total_balance": 1850.00,
                "held_balance": 0.00,
                "is_mock": True,
            }

        raise PayPalAPIError(
            f"Failed to fetch balances [{resp.status_code}]: {resp.text}",
            status_code=resp.status_code,
            debug_id=resp.headers.get("PayPal-Debug-Id", ""),
        )

    def get_transactions(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page_size: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent PayPal transaction ledger records.
        Endpoint: GET /v1/reporting/transactions
        """
        if not self.has_credentials and self.mock_fallback:
            return self._get_mock_transactions()

        now = datetime.now(timezone.utc)
        start = start_date or (now - timedelta(days=60))
        end = end_date or now

        start_str = start.strftime("%Y-%m-%dT00:00:00Z")
        end_str = end.strftime("%Y-%m-%dT23:59:59Z")

        url = f"{self.base_url}/v1/reporting/transactions?start_date={start_str}&end_date={end_str}&fields=all&page_size={page_size}"
        resp = requests.get(url, headers=self._headers(), timeout=20)

        if resp.status_code == 200:
            data = resp.json()
            return data.get("transaction_details", [])

        if self.mock_fallback:
            logger.warning("Transactions API returned %d; returning realistic sandbox stream.", resp.status_code)
            return self._get_mock_transactions()

        raise PayPalAPIError(
            f"Failed to fetch transactions [{resp.status_code}]: {resp.text}",
            status_code=resp.status_code,
            debug_id=resp.headers.get("PayPal-Debug-Id", ""),
        )

    # =========================================================================
    # 3. ORDERS API (v2) - CHECKOUT & PAY LATER
    # =========================================================================

    def create_order(
        self,
        amount: float,
        currency: str = "USD",
        item_name: str = "Purchase",
        description: str = "Order evaluated by PayPal Guardian",
        return_url: str = "https://example.com/checkout/success",
        cancel_url: str = "https://example.com/checkout/cancel",
    ) -> Dict[str, Any]:
        """
        Create a PayPal v2 Checkout Order with Pay Later / Pay in 4 support.
        Endpoint: POST /v2/checkout/orders
        """
        amount_str = f"{amount:.2f}"
        request_id = str(uuid.uuid4())

        payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": f"ref_{request_id[:8]}",
                    "description": description,
                    "amount": {
                        "currency_code": currency,
                        "value": amount_str,
                    },
                    "items": [
                        {
                            "name": item_name[:127],
                            "unit_amount": {
                                "currency_code": currency,
                                "value": amount_str,
                            },
                            "quantity": "1",
                            "category": "PHYSICAL_GOODS",
                        }
                    ],
                }
            ],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
                        "brand_name": "PayPal Guardian AI",
                        "locale": "en-US",
                        "landing_page": "GUEST_CHECKOUT",
                        "user_action": "PAY_NOW",
                        "return_url": return_url,
                        "cancel_url": cancel_url,
                    }
                }
            },
        }

        if not self.has_credentials and self.mock_fallback:
            mock_id = f"MOCK_ORD_{uuid.uuid4().hex[:10].upper()}"
            return {
                "order_id": mock_id,
                "status": "CREATED",
                "approval_url": f"https://www.sandbox.paypal.com/checkoutnow?token={mock_id}",
                "amount": amount,
                "currency": currency,
                "item_name": item_name,
                "is_mock": True,
            }

        url = f"{self.base_url}/v2/checkout/orders"
        resp = requests.post(url, headers=self._headers(custom_request_id=request_id), json=payload, timeout=20)

        if resp.status_code in (200, 201):
            data = resp.json()
            order_id = data.get("id")
            approval_url = None
            for link in data.get("links", []):
                if link.get("rel") in ("payer-action", "approve"):
                    approval_url = link.get("href")
                    break

            return {
                "order_id": order_id,
                "status": data.get("status"),
                "approval_url": approval_url,
                "amount": amount,
                "currency": currency,
                "item_name": item_name,
                "links": data.get("links", []),
                "raw": data,
                "is_mock": False,
            }

        raise PayPalAPIError(
            f"Failed to create order [{resp.status_code}]: {resp.text}",
            status_code=resp.status_code,
            debug_id=resp.headers.get("PayPal-Debug-Id", ""),
            details=resp.json() if resp.content else {},
        )

    # =========================================================================
    # 4. INVOICING API (v2) - BILL CREATION & DISPATCH
    # =========================================================================

    def create_and_send_invoice(
        self,
        recipient_email: str,
        amount: float,
        description: str,
        currency: str = "USD",
        note: str = "Billed via PayPal Guardian Agent",
    ) -> Dict[str, Any]:
        """
        Generate a sequential invoice number, create draft invoice, and send it to recipient.
        Endpoints:
        - POST /v2/invoicing/generate-next-invoice-number
        - POST /v2/invoicing/invoices
        - POST /v2/invoicing/invoices/{id}/send
        """
        if not self.has_credentials and self.mock_fallback:
            mock_inv_id = f"INV2-{uuid.uuid4().hex[:8].upper()}"
            return {
                "invoice_id": mock_inv_id,
                "invoice_number": f"INV-{datetime.now().strftime('%Y%m%d')}-001",
                "status": "SENT",
                "payment_url": f"https://www.sandbox.paypal.com/invoice/p/#{mock_inv_id}",
                "amount": amount,
                "recipient": recipient_email,
                "is_mock": True,
            }

        # 1. Generate next sequential invoice number
        next_num_url = f"{self.base_url}/v2/invoicing/generate-next-invoice-number"
        num_resp = requests.post(next_num_url, headers=self._headers(), timeout=10)
        invoice_number = (
            num_resp.json().get("invoice_number", f"INV-{uuid.uuid4().hex[:6]}")
            if num_resp.status_code == 200
            else f"INV-{uuid.uuid4().hex[:6]}"
        )

        # 2. Draft the invoice
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        invoice_payload = {
            "detail": {
                "invoice_number": invoice_number,
                "invoice_date": today_str,
                "currency_code": currency,
                "note": note,
            },
            "primary_recipients": [
                {
                    "billing_info": {
                        "email_address": recipient_email,
                    }
                }
            ],
            "items": [
                {
                    "name": description[:100],
                    "quantity": "1",
                    "unit_amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}",
                    },
                }
            ],
        }

        inv_url = f"{self.base_url}/v2/invoicing/invoices"
        draft_resp = requests.post(inv_url, headers=self._headers(), json=invoice_payload, timeout=20)

        if draft_resp.status_code not in (200, 201):
            raise PayPalAPIError(
                f"Failed to create draft invoice [{draft_resp.status_code}]: {draft_resp.text}",
                status_code=draft_resp.status_code,
                debug_id=draft_resp.headers.get("PayPal-Debug-Id", ""),
            )

        invoice_data = draft_resp.json()
        invoice_id = invoice_data.get("id")

        # 3. Send the invoice
        send_url = f"{self.base_url}/v2/invoicing/invoices/{invoice_id}/send"
        send_resp = requests.post(send_url, headers=self._headers(), json={"send_to_recipient": True}, timeout=20)

        payment_url = None
        for link in invoice_data.get("links", []):
            if link.get("rel") in ("payer-view", "send"):
                payment_url = link.get("href")

        return {
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "status": "SENT" if send_resp.status_code in (200, 202) else "DRAFT",
            "payment_url": payment_url or f"https://www.sandbox.paypal.com/invoice/p/#{invoice_id}",
            "amount": amount,
            "recipient": recipient_email,
            "is_mock": False,
        }

    # =========================================================================
    # 5. REALISTIC MOCK DATA GENERATOR (FOR OFFLINE / BENCHMARK TESTING)
    # =========================================================================

    def _get_mock_transactions(self) -> List[Dict[str, Any]]:
        """Provides realistic sandbox transaction stream with salary, rent, and subscriptions."""
        today = datetime.now(timezone.utc).date()
        return [
            {
                "transaction_info": {
                    "transaction_id": "TX_SALARY_01",
                    "transaction_event_code": "T0000",
                    "transaction_initiation_date": (today - timedelta(days=15)).isoformat(),
                    "transaction_updated_date": (today - timedelta(days=15)).isoformat(),
                    "transaction_amount": {"currency_code": "USD", "value": "2800.00"},
                    "transaction_status": "S",
                    "transaction_subject": "Bi-Weekly Salary Direct Deposit",
                },
                "payer_info": {"payer_name": {"alternate_full_name": "Employer Payroll Corp"}},
            },
            {
                "transaction_info": {
                    "transaction_id": "TX_RENT_01",
                    "transaction_event_code": "T0006",
                    "transaction_initiation_date": (today - timedelta(days=25)).isoformat(),
                    "transaction_updated_date": (today - timedelta(days=25)).isoformat(),
                    "transaction_amount": {"currency_code": "USD", "value": "-1100.00"},
                    "transaction_status": "S",
                    "transaction_subject": "Monthly Apartment Rent Payment",
                },
                "payer_info": {"payer_name": {"alternate_full_name": "Skyline Properties"}},
            },
            {
                "transaction_info": {
                    "transaction_id": "TX_SUB_01",
                    "transaction_event_code": "T0006",
                    "transaction_initiation_date": (today - timedelta(days=10)).isoformat(),
                    "transaction_updated_date": (today - timedelta(days=10)).isoformat(),
                    "transaction_amount": {"currency_code": "USD", "value": "-19.99"},
                    "transaction_status": "S",
                    "transaction_subject": "Cloud Video Streaming Subscription",
                },
                "payer_info": {"payer_name": {"alternate_full_name": "StreamMax"}},
            },
            {
                "transaction_info": {
                    "transaction_id": "TX_GROC_01",
                    "transaction_event_code": "T0006",
                    "transaction_initiation_date": (today - timedelta(days=3)).isoformat(),
                    "transaction_updated_date": (today - timedelta(days=3)).isoformat(),
                    "transaction_amount": {"currency_code": "USD", "value": "-84.50"},
                    "transaction_status": "S",
                    "transaction_subject": "Organic Market Groceries",
                },
                "payer_info": {"payer_name": {"alternate_full_name": "Fresh Market"}},
            },
        ]

