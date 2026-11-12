import csv
import io
import logging
import os
import uuid
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.database import db_manager

logger = logging.getLogger("guardian.api.auth")

router = APIRouter(prefix="/api/auth", tags=["PayPal Authentication & Account Linking"])


class OAuthExchangeRequest(BaseModel):
    code: str = Field(..., description="Authorization code received from PayPal OAuth redirect")
    redirect_uri: str = Field(default="http://localhost:3000/auth/callback", description="Registered OAuth redirect URI")


class SwitchAccountRequest(BaseModel):
    user_id: str = Field(..., description="User ID of the persona to switch to")


class CustomAccountRequest(BaseModel):
    email: str = Field(..., description="PayPal Sandbox Account Email")
    name: str = Field(default="Sandbox User", description="Display name")
    balance: float = Field(default=3500.0, description="Initial PayPal Balance in USD")
    account_type: str = Field(default="PERSONAL", description="PERSONAL or BUSINESS")


class BulkCsvImportRequest(BaseModel):
    csv_content: str = Field(..., description="Raw CSV string in PayPal Bulk Sandbox Accounts format")


@router.get("/paypal/url")
async def get_paypal_oauth_url(
    redirect_uri: Optional[str] = Query(default="http://localhost:3000/auth/callback"),
):
    """
    Generates the official PayPal OAuth 2.0 Hosted Consent URL for 'Log in with PayPal'.
    Scopes requested:
    - openid: OpenID Connect identity
    - email: User's primary PayPal email
    - profile: Account holder profile information
    - https://uri.paypal.com/services/invoicing: Send and manage PayPal invoices
    - https://uri.paypal.com/services/reporting/search/read: Access real-time reporting search
    """
    scopes = [
        "openid",
        "email",
        "profile",
        "https://uri.paypal.com/services/invoicing",
        "https://uri.paypal.com/services/reporting/search/read",
    ]
    encoded_scopes = "%20".join(scopes)
    web_base_url = "https://www.sandbox.paypal.com" if "sandbox" in settings.PAYPAL_BASE_URL.lower() else "https://www.paypal.com"
    auth_url = (
        f"{web_base_url}/signin/authorize"
        f"?client_id={settings.PAYPAL_CLIENT_ID}"
        f"&response_type=code"
        f"&scope={encoded_scopes}"
        f"&redirect_uri={redirect_uri}"
    )
    return {
        "auth_url": auth_url,
        "client_id": settings.PAYPAL_CLIENT_ID,
        "mode": "sandbox",
    }


@router.post("/paypal/exchange")
async def exchange_paypal_oauth_code(req: OAuthExchangeRequest):
    """
    Exchanges PayPal authorization_code for user access_token, fetches user identity,
    and registers/links their account in the SQLite user_accounts ledger.
    """
    token_url = f"{settings.PAYPAL_BASE_URL}/v1/oauth2/token"
    user_info_url = f"{settings.PAYPAL_BASE_URL}/v1/identity/oauth2/userinfo?schema=paypalv1.1"

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Exchange code for access_token
        try:
            token_resp = await client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": req.code,
                    "redirect_uri": req.redirect_uri,
                },
                auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
                headers={"Accept": "application/json", "Accept-Language": "en_US"},
            )
        except Exception as exc:
            logger.error("OAuth token exchange failed to connect: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to PayPal OAuth token endpoint: {exc}",
            )

        if token_resp.status_code != 200:
            logger.warning("PayPal OAuth token exchange rejected (%d): %s", token_resp.status_code, token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PayPal token exchange rejected: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 32400)
        import time
        token_expires_at = time.time() + expires_in

        # 2. Fetch User Identity Info
        email = f"user-{uuid.uuid4().hex[:6]}@personal.example.com"
        name = "PayPal User"
        payer_id = f"PAYER-{uuid.uuid4().hex[:8].upper()}"

        try:
            user_resp = await client.get(
                user_info_url,
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            )
            if user_resp.status_code == 200:
                user_json = user_resp.json()
                email = user_json.get("email") or user_json.get("emails", [{}])[0].get("value") or email
                name = user_json.get("name") or name
                payer_id = user_json.get("payer_id") or payer_id
        except Exception as id_err:
            logger.warning("Could not fetch identity userinfo: %s", id_err)

        user_id = email.split("@")[0].replace(".", "_")

        # 3. Save into SQLite
        account = await db_manager.save_user_account(
            user_id=user_id,
            paypal_payer_id=payer_id,
            email=email,
            name=name,
            account_type="PERSONAL",
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            balance=3500.0,
            currency="USD",
        )

        return {
            "status": "connected",
            "account": account,
        }


@router.get("/accounts")
async def list_available_accounts():
    """Returns all connected and provisioned sandbox accounts."""
    await db_manager.init_db()
    accounts = await db_manager.list_user_accounts()
    return {"accounts": accounts}


@router.get("/user/{user_id}")
async def get_account_profile(user_id: str):
    """Retrieves profile and balance for an active user."""
    account = await db_manager.get_user_account(user_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account '{user_id}' not found.",
        )
    return account


@router.post("/switch-account")
async def switch_active_account(req: SwitchAccountRequest):
    """Switches active session account."""
    account = await db_manager.get_user_account(req.user_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account '{req.user_id}' not found.",
        )
    return {"status": "switched", "active_account": account}


@router.post("/custom-sandbox")
async def connect_custom_sandbox_account(req: CustomAccountRequest):
    """Instantly registers and connects a custom Sandbox account (e.g. from sandbox-bulk-accounts.csv)."""
    user_id = req.email.split("@")[0].replace(".", "_")
    account = await db_manager.save_user_account(
        user_id=user_id,
        paypal_payer_id=f"PAYER-{uuid.uuid4().hex[:6].upper()}",
        email=req.email,
        name=req.name,
        account_type=req.account_type,
        balance=req.balance,
        currency="USD",
    )
    return {"status": "connected", "account": account}


@router.get("/transactions")
async def get_recorded_transactions_endpoint(days: int = 30):
    """Returns recorded write-through sandbox transactions from SQLite."""
    await db_manager.init_db()
    transactions = await db_manager.get_recorded_transactions(days=days)
    return {"transactions": transactions}


@router.get("/download-bulk-csv")
async def download_bulk_sandbox_csv():
    """
    Returns the ready-to-upload sandbox-bulk-accounts.csv file formatted strictly
    for PayPal Developer Portal 'Bulk Sandbox Account Creation'.
    """
    csv_path = os.path.abspath("./sandbox-bulk-accounts.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="sandbox-bulk-accounts.csv template not found on server.",
        )
    return FileResponse(
        path=csv_path,
        filename="sandbox-bulk-accounts.csv",
        media_type="text/csv",
    )


@router.post("/bulk-import-csv")
async def import_bulk_sandbox_csv(req: BulkCsvImportRequest):
    """
    Parses a PayPal Sandbox Bulk CSV file (matching PayPal's sandbox-bulk-headers.csv),
    and registers all contained accounts directly into the Guardian SQLite user ledger.
    """
    imported = []
    f = io.StringIO(req.csv_content.strip())
    reader = csv.DictReader(f)
    
    for row in reader:
        # PayPal bulk columns: country_code,account_type,primary_email_alias,password,first_name,last_name,ppBalance,addBank,ccType,payment_card
        email = (row.get("primary_email_alias") or "").strip()
        if not email or "@" not in email:
            continue
        
        first_name = (row.get("first_name") or "").strip()
        last_name = (row.get("last_name") or "").strip()
        display_name = f"{first_name} {last_name}".strip() or email.split("@")[0]
        account_type = (row.get("account_type") or "PERSONAL").strip().upper()
        
        try:
            balance = float(row.get("ppBalance", 3500.0))
        except (ValueError, TypeError):
            balance = 3500.0
            
        user_id = email.split("@")[0].replace(".", "_")
        payer_id = f"PAYER-BULK-{uuid.uuid4().hex[:6].upper()}"
        
        account = await db_manager.save_user_account(
            user_id=user_id,
            paypal_payer_id=payer_id,
            email=email,
            name=display_name,
            account_type=account_type,
            balance=balance,
            currency="USD",
        )
        imported.append(account)
        
    logger.info("Successfully imported %d sandbox accounts from CSV", len(imported))
    return {
        "status": "success",
        "imported_count": len(imported),
        "accounts": imported,
    }
