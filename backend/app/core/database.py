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
            await db.commit()
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


db_manager = DatabaseManager()

