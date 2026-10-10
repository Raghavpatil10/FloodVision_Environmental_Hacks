import sqlite3
import os
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class AdminRequestRepository:
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
                CREATE TABLE IF NOT EXISTS admin_requests (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    reviewer_id TEXT,
                    reviewed_at TEXT,
                    review_note TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(reviewer_id) REFERENCES users(id)
                );
            """)
            # Database constraint: Partial unique index prevents duplicate pending requests
            conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_requests_user_pending 
                ON admin_requests(user_id) 
                WHERE status = 'pending';
            """)
            conn.commit()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        return {
            "id": d["id"],
            "user_id": d["user_id"],
            "reason": d["reason"],
            "status": d["status"],
            "reviewer_id": d.get("reviewer_id"),
            "reviewed_at": d.get("reviewed_at"),
            "review_note": d.get("review_note"),
            "created_at": d["created_at"],
            "user_name": d.get("user_name"),
            "user_email": d.get("user_email"),
            "user_role": d.get("user_role"),
            "reviewer_name": d.get("reviewer_name")
        }

    def create_request(self, user_id: str, reason: str) -> Dict[str, Any]:
        req_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        clean_reason = reason.strip()

        with self._get_connection() as conn:
            # 1. Verify user exists and check role
            cur = conn.execute("SELECT id, name, email, role, email_verified, is_active FROM users WHERE id = ?", (user_id,))
            user = cur.fetchone()
            if not user:
                raise KeyError("User account not found.")

            if user["role"] == "admin":
                raise ValueError("Account already possesses Administrator privileges.")

            if not user["email_verified"]:
                raise PermissionError("Email verification is strictly required before requesting Administrator access.")

            if not user["is_active"]:
                raise PermissionError("Account has been suspended or deactivated.")

            # 2. Check pending request explicitly
            pending = conn.execute(
                "SELECT id FROM admin_requests WHERE user_id = ? AND status = 'pending'",
                (user_id,)
            ).fetchone()
            if pending:
                raise ValueError("A pending admin access request is already under review for this account.")

            # 3. Insert new request
            try:
                conn.execute(
                    """
                    INSERT INTO admin_requests (id, user_id, reason, status, created_at)
                    VALUES (?, ?, ?, 'pending', ?)
                    """,
                    (req_id, user_id, clean_reason, now)
                )

                # Record audit log
                audit_id = str(uuid.uuid4())
                details = json.dumps({"reason": clean_reason})
                conn.execute(
                    """
                    INSERT INTO audit_logs (id, actor_id, action, target_user_id, details, timestamp)
                    VALUES (?, ?, 'admin_request_submitted', ?, ?, ?)
                    """,
                    (audit_id, user_id, user_id, details, now)
                )

                conn.commit()
            except sqlite3.IntegrityError as e:
                logger.warning(f"Integrity error creating admin request: {e}")
                raise ValueError("A pending admin access request already exists for this account.")

        return {
            "id": req_id,
            "user_id": user_id,
            "reason": clean_reason,
            "status": "pending",
            "reviewer_id": None,
            "reviewed_at": None,
            "review_note": None,
            "created_at": now,
            "user_name": user["name"],
            "user_email": user["email"],
            "user_role": user["role"]
        }

    def get_user_requests(self, user_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role,
                       rev.name as reviewer_name
                FROM admin_requests r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN users rev ON r.reviewer_id = rev.id
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC
                """,
                (user_id,)
            )
            return [self._row_to_dict(row) for row in cur.fetchall()]

    def get_all_requests(self, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if status_filter:
                cur = conn.execute(
                    """
                    SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role,
                           rev.name as reviewer_name
                    FROM admin_requests r
                    LEFT JOIN users u ON r.user_id = u.id
                    LEFT JOIN users rev ON r.reviewer_id = rev.id
                    WHERE r.status = ?
                    ORDER BY r.created_at DESC
                    """,
                    (status_filter,)
                )
            else:
                cur = conn.execute(
                    """
                    SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role,
                           rev.name as reviewer_name
                    FROM admin_requests r
                    LEFT JOIN users u ON r.user_id = u.id
                    LEFT JOIN users rev ON r.reviewer_id = rev.id
                    ORDER BY r.created_at DESC
                    """
                )
            return [self._row_to_dict(row) for row in cur.fetchall()]

    def get_request_by_id(self, request_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role,
                       rev.name as reviewer_name
                FROM admin_requests r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN users rev ON r.reviewer_id = rev.id
                WHERE r.id = ?
                """,
                (request_id,)
            )
            row = cur.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def review_request(
        self,
        request_id: str,
        reviewer_id: str,
        action: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically reviews an admin application in a single database transaction:
        - Prevents self-approval
        - Prevents concurrent double-reviews via atomic WHERE status = 'pending'
        - Verifies applicant has email verified
        - Updates request status to 'approved' or 'rejected'
        - Updates user role to 'admin' if approved
        - Records audit log entry
        """
        clean_action = action.strip().lower()
        if clean_action not in ("approve", "reject"):
            raise ValueError("Review action must be either 'approve' or 'reject'.")

        now = datetime.now(timezone.utc).isoformat()
        clean_note = note.strip() if note else None

        with self._get_connection() as conn:
            # 1. Fetch current request state
            cur = conn.execute("SELECT * FROM admin_requests WHERE id = ?", (request_id,))
            req = cur.fetchone()
            if not req:
                raise KeyError(f"Admin request '{request_id}' not found.")

            target_user_id = req["user_id"]

            # 2. Self-approval guard
            if target_user_id == reviewer_id:
                raise PermissionError("Self-approval forbidden: Administrators cannot approve their own access requests.")

            # 3. Check status is pending
            if req["status"] != "pending":
                raise ValueError(f"Application has already been reviewed (current status: '{req['status']}').")

            # 4. Fetch applicant details
            cur_user = conn.execute("SELECT id, name, email, role, email_verified, is_active FROM users WHERE id = ?", (target_user_id,))
            applicant = cur_user.fetchone()
            if not applicant:
                raise KeyError("Applicant user account no longer exists.")

            if clean_action == "approve":
                # Email verification is mandatory
                if not applicant["email_verified"]:
                    raise PermissionError("Cannot approve access: Applicant email address is not verified.")

                if not applicant["is_active"]:
                    raise PermissionError("Cannot approve access: Applicant account is deactivated.")

                new_status = "approved"
                audit_action = "admin_request_approved"
            else:
                new_status = "rejected"
                audit_action = "admin_request_rejected"

            # 5. ATOMIC UPDATE: Check status = 'pending' to prevent race condition/concurrent review
            update_cur = conn.execute(
                """
                UPDATE admin_requests 
                SET status = ?, reviewer_id = ?, reviewed_at = ?, review_note = ?
                WHERE id = ? AND status = 'pending'
                """,
                (new_status, reviewer_id, now, clean_note, request_id)
            )

            if update_cur.rowcount == 0:
                raise ValueError("Concurrency conflict: Application was already reviewed or modified.")

            # 6. If approved, promote user role to admin atomically
            if clean_action == "approve":
                conn.execute(
                    "UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?",
                    (now, target_user_id)
                )

            # 7. Insert audit log atomically in the same transaction
            audit_id = str(uuid.uuid4())
            audit_details = json.dumps({
                "request_id": request_id,
                "action": clean_action,
                "note": clean_note,
                "applicant_email": applicant["email"],
                "applicant_name": applicant["name"]
            })
            conn.execute(
                """
                INSERT INTO audit_logs (id, actor_id, action, target_user_id, details, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (audit_id, reviewer_id, audit_action, target_user_id, audit_details, now)
            )

            conn.commit()

        return self.get_request_by_id(request_id)

admin_request_repo = AdminRequestRepository()
