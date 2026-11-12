import os
import pickle
import sqlite3
import logging
from typing import Optional, Dict, Any
from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger("guardian.checkpoint")

DB_FILE_PATH = os.path.abspath("./guardian_copilot.db")


class PersistentSqliteCheckpointer(MemorySaver):
    """
    Persistent SQLite Checkpoint Saver for LangGraph.
    Stores thread state snapshots and HITL gate interrupts into SQLite
    so that process restarts and multi-worker recycling never drop active sessions.
    """

    def __init__(self, db_path: str = DB_FILE_PATH):
        super().__init__()
        self.db_path = db_path
        self._init_sqlite()
        self._load_from_sqlite()

    def _init_sqlite(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_checkpoints (
                    key TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    checkpoint_id TEXT NOT NULL,
                    data BLOB NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_writes (
                    key TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    checkpoint_id TEXT NOT NULL,
                    data BLOB NOT NULL
                )
            """)
            conn.commit()

    def _load_from_sqlite(self):
        try:
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute("SELECT thread_id, checkpoint_id, data FROM graph_checkpoints").fetchall()
                count = 0
                for th, cid, blob in rows:
                    try:
                        self.storage[th][cid] = pickle.loads(blob)
                        count += 1
                    except Exception as err:
                        logger.warning("Could not deserialize checkpoint %s:%s: %s", th, cid, err)

                write_rows = conn.execute("SELECT thread_id, checkpoint_id, data FROM graph_writes").fetchall()
                for th, cid, blob in write_rows:
                    try:
                        self.writes[(th, cid)] = pickle.loads(blob)
                    except Exception as err:
                        logger.warning("Could not deserialize write %s:%s: %s", th, cid, err)

                if count > 0:
                    logger.info("Restored %d LangGraph checkpoints from SQLite (%s)", count, self.db_path)
        except Exception as exc:
            logger.warning("Error loading checkpoints from SQLite: %s", exc)

    def put(self, config, checkpoint, metadata, new_versions, *args, **kwargs):
        res = super().put(config, checkpoint, metadata, new_versions, *args, **kwargs)
        try:
            th = config.get("configurable", {}).get("thread_id")
            cid = checkpoint.get("id")
            if th and cid and th in self.storage and cid in self.storage[th]:
                blob = pickle.dumps(self.storage[th][cid])
                key = f"{th}:::{cid}"
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        "INSERT OR REPLACE INTO graph_checkpoints (key, thread_id, checkpoint_id, data) VALUES (?, ?, ?, ?)",
                        (key, th, cid, blob),
                    )
                    conn.commit()
        except Exception as exc:
            logger.warning("Error saving checkpoint to SQLite: %s", exc)
        return res

    def put_writes(self, config, writes, task_id, task_path: str = "", *args, **kwargs):
        super().put_writes(config, writes, task_id, task_path, *args, **kwargs)
        try:
            th = config.get("configurable", {}).get("thread_id")
            cid = config.get("configurable", {}).get("checkpoint_id", "")
            if th and cid:
                key = f"{th}:::{cid}:::{task_id}"
                data_val = self.writes.get((th, cid))
                if data_val:
                    blob = pickle.dumps(data_val)
                    with sqlite3.connect(self.db_path) as conn:
                        conn.execute(
                            "INSERT OR REPLACE INTO graph_writes (key, thread_id, checkpoint_id, data) VALUES (?, ?, ?, ?)",
                            (key, th, cid, blob),
                        )
                        conn.commit()
        except Exception as exc:
            logger.warning("Error saving writes to SQLite: %s", exc)
