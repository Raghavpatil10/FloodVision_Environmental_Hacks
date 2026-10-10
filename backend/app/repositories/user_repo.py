import sqlite3
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class UserRepository:
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
            # 1. Create table if it does not exist
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_login TEXT
                );
            """)

            # 2. Check for missing columns to support seamless database migrations
            cursor = conn.execute("PRAGMA table_info(users)")
            existing_cols = {row["name"] for row in cursor.fetchall()}

            if "password_hash" not in existing_cols and "hashed_password" in existing_cols:
                conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
                conn.execute("UPDATE users SET password_hash = hashed_password WHERE password_hash = ''")

            if "is_active" not in existing_cols:
                conn.execute("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")

            if "updated_at" not in existing_cols:
                conn.execute("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
                conn.execute("UPDATE users SET updated_at = created_at WHERE updated_at = ''")

            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        pwd_hash = d.get("password_hash") or d.get("hashed_password") or ""
        return {
            "id": d["id"],
            "name": d["name"],
            "email": d["email"],
            "password_hash": pwd_hash,
            "hashed_password": pwd_hash,  # alias for backwards compatibility
            "role": d["role"],
            "is_active": bool(d.get("is_active", 1)),
            "created_at": d["created_at"],
            "updated_at": d.get("updated_at") or d["created_at"],
            "last_login": d.get("last_login")
        }

    def create_user(
        self, 
        name: str, 
        email: str, 
        hashed_password: str, 
        role: str = "user",
        is_active: bool = True
    ) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        clean_email = email.strip().lower()
        clean_name = name.strip()
        safe_role = "admin" if role.lower() == "admin" else "user"
        active_int = 1 if is_active else 0

        with self._get_connection() as conn:
            # Check which password column is supported
            cursor = conn.execute("PRAGMA table_info(users)")
            existing_cols = {r["name"] for r in cursor.fetchall()}

            if "password_hash" in existing_cols and "hashed_password" in existing_cols:
                conn.execute(
                    """
                    INSERT INTO users (id, name, email, password_hash, hashed_password, role, is_active, created_at, updated_at, last_login)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, clean_name, clean_email, hashed_password, hashed_password, safe_role, active_int, now, now, None)
                )
            elif "password_hash" in existing_cols:
                conn.execute(
                    """
                    INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at, last_login)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, clean_name, clean_email, hashed_password, safe_role, active_int, now, now, None)
                )
            else:
                conn.execute(
                    """
                    INSERT INTO users (id, name, email, hashed_password, role, created_at, last_login)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, clean_name, clean_email, hashed_password, safe_role, now, None)
                )
            conn.commit()

        return {
            "id": user_id,
            "name": clean_name,
            "email": clean_email,
            "password_hash": hashed_password,
            "hashed_password": hashed_password,
            "role": safe_role,
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
            "last_login": None
        }

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def update_last_login(self, user_id: str):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("PRAGMA table_info(users)")
            existing_cols = {r["name"] for r in cursor.fetchall()}
            if "updated_at" in existing_cols:
                conn.execute("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?", (now, now, user_id))
            else:
                conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user_id))
            conn.commit()

    def update_user_status(self, user_id: str, is_active: bool):
        now = datetime.now(timezone.utc).isoformat()
        active_int = 1 if is_active else 0
        with self._get_connection() as conn:
            cursor = conn.execute("PRAGMA table_info(users)")
            existing_cols = {r["name"] for r in cursor.fetchall()}
            if "updated_at" in existing_cols:
                conn.execute("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?", (active_int, now, user_id))
            else:
                conn.execute("UPDATE users SET is_active = ? WHERE id = ?", (active_int, user_id))
            conn.commit()

    def count_users(self) -> Dict[str, int]:
        with self._get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            admins = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0]
            users = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'user'").fetchone()[0]
            return {"total": total, "admins": admins, "users": users}

    def list_users(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM users ORDER BY created_at DESC LIMIT ?", 
                (limit,)
            )
            return [self._row_to_dict(r) for r in cur.fetchall()]

user_repo = UserRepository()
