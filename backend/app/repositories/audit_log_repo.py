import sqlite3
import os
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class AuditLogRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.USERS_DB_PATH
        self._ensure_storage()
        self._init_schema()

    def _ensure_storage(self):
        if self.db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    actor_id TEXT,
                    action TEXT NOT NULL,
                    target_user_id TEXT,
                    details TEXT,
                    timestamp TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_user_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);")
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        parsed_details = None
        if d.get("details"):
            try:
                parsed_details = json.loads(d["details"])
            except Exception:
                parsed_details = d["details"]
        return {
            "id": d["id"],
            "actor_id": d["actor_id"],
            "action": d["action"],
            "target_user_id": d["target_user_id"],
            "details": parsed_details,
            "timestamp": d["timestamp"]
        }

    def record(
        self,
        actor_id: Optional[str],
        action: str,
        target_user_id: Optional[str] = None,
        details: Optional[Any] = None
    ) -> Dict[str, Any]:
        log_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        details_str = json.dumps(details) if isinstance(details, (dict, list)) else (str(details) if details is not None else None)

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (id, actor_id, action, target_user_id, details, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (log_id, actor_id, action, target_user_id, details_str, now)
            )
            conn.commit()

        return {
            "id": log_id,
            "actor_id": actor_id,
            "action": action,
            "target_user_id": target_user_id,
            "details": details,
            "timestamp": now
        }

    # Alias for convenience
    record_log = record

    def list_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
            return [self._row_to_dict(r) for r in cur.fetchall()]

    def list_logs_for_target(self, target_user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM audit_logs WHERE target_user_id = ? ORDER BY timestamp DESC LIMIT ?",
                (target_user_id, limit)
            )
            return [self._row_to_dict(r) for r in cur.fetchall()]

audit_log_repo = AuditLogRepository()
