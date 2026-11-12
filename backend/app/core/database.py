import asyncio
import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import aiosqlite

from backend.app.core.config import settings

logger = logging.getLogger("guardian.database")

DB_FILE_PATH = os.path.abspath("./guardian_copilot.db")


class DatabaseManager:
    """
    Asynchronous SQLite Database Manager for:
    - HITL Pending Actions & Approvals
    - Thread Execution Audits
    - LangGraph Checkpoints
    """

    def __init__(self, db_path: str = DB_FILE_PATH):
        self.db_path = db_path

    async def init_db(self):
        """Initializes tables for pending actions and state checkpoints."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS pending_actions (
                    action_id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL, -- awaiting_approval, approved, rejected, executed, failed
                    feedback TEXT,
                    execution_result TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS transaction_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id TEXT,
                    reference_id TEXT,
                    paypal_order_or_invoice_id TEXT,
                    amount REAL,
                    currency TEXT,
                    status TEXT,
                    idempotency_key TEXT,
                    timestamp TEXT NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    paypal_id TEXT UNIQUE NOT NULL,
                    merchant TEXT,
                    item TEXT,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'USD',
                    category TEXT NOT NULL DEFAULT 'General Retail',
                    created_at TEXT NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS user_accounts (
                    user_id TEXT PRIMARY KEY,
                    paypal_payer_id TEXT,
                    email TEXT NOT NULL,
                    name TEXT,
                    account_type TEXT DEFAULT 'PERSONAL',
                    access_token TEXT,
                    refresh_token TEXT,
                    token_expires_at REAL,
                    balance REAL DEFAULT 0.0,
                    currency TEXT DEFAULT 'USD',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            await db.commit()

            # Seed default provisioned sandbox personas if table is empty
            cursor = await db.execute("SELECT COUNT(*) FROM user_accounts")
            (count,) = await cursor.fetchone()
            if count == 0:
                now_str = datetime.now(timezone.utc).isoformat()
                default_personas = [
                    ("alex_cro", "PAYER-HEALTHY-01", "guardian-buyer-healthy@personal.example.com", "Michael Buyer (Healthy)", "PERSONAL", 3500.0, "USD", now_str, now_str),
                    ("emma_tight", "PAYER-TIGHT-02", "guardian-buyer-tight@personal.example.com", "Emma Savings (Tight Reserve)", "PERSONAL", 550.0, "USD", now_str, now_str),
                    ("james_low", "PAYER-LOW-03", "guardian-buyer-low@personal.example.com", "James Student (Overdraft Risk)", "PERSONAL", 200.0, "USD", now_str, now_str),
                    ("alex_merchant", "PAYER-MERCHANT-04", "guardian-merchant-2026@business.example.com", "Alex Merchant (Verified Vendor)", "BUSINESS", 10000.0, "USD", now_str, now_str),
                    ("sarah_procure", "PAYER-CLIENT-05", "guardian-client-procure@business.example.com", "Sarah Procurement (Enterprise Client)", "BUSINESS", 5000.0, "USD", now_str, now_str),
                ]
                await db.executemany(
                    """
                    INSERT INTO user_accounts 
                    (user_id, paypal_payer_id, email, name, account_type, balance, currency, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    default_personas,
                )
                await db.commit()
                logger.info("Seeded %d default PayPal sandbox personas into user_accounts", len(default_personas))

            logger.info("Database initialized successfully at %s", self.db_path)

    async def create_pending_action(
        self,
        action_id: str,
        thread_id: str,
        user_id: str,
        action_type: str,
        tool_name: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Saves a pending action requiring human approval."""
        now = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(payload)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO pending_actions 
                (action_id, thread_id, user_id, action_type, tool_name, payload, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'awaiting_approval', ?, ?)
                """,
                (action_id, thread_id, user_id, action_type, tool_name, payload_json, now, now),
            )
            await db.commit()

        return {
            "action_id": action_id,
            "thread_id": thread_id,
            "user_id": user_id,
            "action_type": action_type,
            "tool_name": tool_name,
            "payload": payload,
            "status": "awaiting_approval",
            "created_at": now,
        }

    async def get_pending_action(self, action_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a pending action by its ID."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM pending_actions WHERE action_id = ?", (action_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return None
            return {
                "action_id": row["action_id"],
                "thread_id": row["thread_id"],
                "user_id": row["user_id"],
                "action_type": row["action_type"],
                "tool_name": row["tool_name"],
                "payload": json.loads(row["payload"]),
                "status": row["status"],
                "feedback": row["feedback"],
                "execution_result": json.loads(row["execution_result"]) if row["execution_result"] else None,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

    async def update_action_status(
        self,
        action_id: str,
        status: str,
        execution_result: Optional[Dict[str, Any]] = None,
        feedback: Optional[str] = None,
    ):
        """Updates status of a pending action after approval/rejection/execution."""
        now = datetime.now(timezone.utc).isoformat()
        result_json = json.dumps(execution_result) if execution_result else None
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE pending_actions 
                SET status = ?, execution_result = ?, feedback = ?, updated_at = ?
                WHERE action_id = ?
                """,
                (status, result_json, feedback, now, action_id),
            )
            await db.commit()

    async def list_pending_actions(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists actions, optionally filtering by status."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if status:
                cursor = await db.execute(
                    "SELECT * FROM pending_actions WHERE status = ? ORDER BY created_at DESC", (status,)
                )
            else:
                cursor = await db.execute("SELECT * FROM pending_actions ORDER BY created_at DESC")
            rows = await cursor.fetchall()
            return [
                {
                    "action_id": row["action_id"],
                    "thread_id": row["thread_id"],
                    "user_id": row["user_id"],
                    "action_type": row["action_type"],
                    "tool_name": row["tool_name"],
                    "payload": json.loads(row["payload"]),
                    "status": row["status"],
                    "feedback": row["feedback"],
                    "execution_result": json.loads(row["execution_result"]) if row["execution_result"] else None,
                    "created_at": row["created_at"],
                }
                for row in rows
            ]

    async def record_transaction(
        self,
        paypal_id: str,
        merchant: str,
        item: str,
        amount: float,
        currency: str = "USD",
        category: str = "General Retail",
        created_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Write-Through Ledger capture for completed PayPal Sandbox orders/invoices.
        Ensures transactions are immediately queryable without waiting for 3-hr index lag.
        """
        now = created_at or datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO transactions 
                (paypal_id, merchant, item, amount, currency, category, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (paypal_id, merchant, item, amount, currency, category, now),
            )
            await db.commit()
            logger.info("Recorded write-through transaction %s: $%s (%s)", paypal_id, amount, category)

        return {
            "paypal_id": paypal_id,
            "merchant": merchant,
            "item": item,
            "amount": amount,
            "currency": currency,
            "category": category,
            "created_at": now,
        }

    async def get_recorded_transactions(self, days: int = 30) -> List[Dict[str, Any]]:
        """Retrieves captured sandbox transactions from local SQLite write-through ledger."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT paypal_id, merchant, item, amount, currency, category, created_at FROM transactions ORDER BY created_at DESC"
            )
            rows = await cursor.fetchall()
            return [
                {
                    "paypal_id": row["paypal_id"],
                    "merchant": row["merchant"],
                    "item": row["item"],
                    "amount": float(row["amount"]),
                    "currency": row["currency"],
                    "category": row["category"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]

    async def save_user_account(
        self,
        user_id: str,
        email: str,
        name: str = "",
        account_type: str = "PERSONAL",
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        token_expires_at: Optional[float] = None,
        balance: float = 0.0,
        currency: str = "USD",
        paypal_payer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Saves or updates a user's connected PayPal account."""
        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO user_accounts
                (user_id, paypal_payer_id, email, name, account_type, access_token, refresh_token, token_expires_at, balance, currency, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM user_accounts WHERE user_id = ?), ?), ?)
                """,
                (user_id, paypal_payer_id, email, name, account_type, access_token, refresh_token, token_expires_at, balance, currency, user_id, now, now),
            )
            await db.commit()
            logger.info("Saved PayPal user account %s (%s)", user_id, email)

        return {
            "user_id": user_id,
            "paypal_payer_id": paypal_payer_id,
            "email": email,
            "name": name,
            "account_type": account_type,
            "balance": balance,
            "currency": currency,
        }

    async def get_user_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user's connected PayPal account profile."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM user_accounts WHERE user_id = ?", (user_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            return {
                "user_id": row["user_id"],
                "paypal_payer_id": row["paypal_payer_id"],
                "email": row["email"],
                "name": row["name"],
                "account_type": row["account_type"],
                "access_token": row["access_token"],
                "refresh_token": row["refresh_token"],
                "token_expires_at": row["token_expires_at"],
                "balance": float(row["balance"]),
                "currency": row["currency"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

    async def list_user_accounts(self) -> List[Dict[str, Any]]:
        """Lists all registered / provisioned user accounts."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT user_id, paypal_payer_id, email, name, account_type, balance, currency FROM user_accounts ORDER BY created_at ASC")
            rows = await cursor.fetchall()
            return [
                {
                    "user_id": row["user_id"],
                    "paypal_payer_id": row["paypal_payer_id"],
                    "email": row["email"],
                    "name": row["name"],
                    "account_type": row["account_type"],
                    "balance": float(row["balance"]),
                    "currency": row["currency"],
                }
                for row in rows
            ]

    async def update_user_balance(self, user_id: str, new_balance: float):
        """Updates a user's balance following an execution."""
        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE user_accounts SET balance = ?, updated_at = ? WHERE user_id = ?",
                (new_balance, now, user_id),
            )
            await db.commit()


db_manager = DatabaseManager()

