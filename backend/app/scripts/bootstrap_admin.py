import os
import sys
import uuid
import json
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Ensure backend root is in sys.path when run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.config import settings
from app.repositories.user_repo import user_repo
from app.repositories.audit_log_repo import audit_log_repo

def bootstrap_initial_admin(target_email: Optional[str] = None) -> Dict[str, Any]:
    """
    Secure One-Time Initial Administrator Bootstrap:
    - Promotes only the explicitly configured owner account
    - Refuses bootstrap if an administrator already exists
    - Enforces email verification on the owner account
    - Uses an atomic transaction to prevent concurrent promotions
    - Records the initial promotion in the audit log
    """
    email = (target_email or settings.ADMIN_INITIAL_EMAIL or "").strip().lower()
    if not email:
        raise ValueError("ADMIN_INITIAL_EMAIL environment variable is not configured.")

    db_path = settings.USERS_DB_PATH
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    now = datetime.now(timezone.utc).isoformat()

    try:
        with conn:
            # 1. Exclusive check for existing administrators within transaction
            cur = conn.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
            row = cur.fetchone()
            admin_count = row["count"] if row else 0
            if admin_count > 0:
                raise PermissionError("Bootstrap refused: At least one administrator account already exists in the database.")

            # 2. Check if the target owner account exists
            cur = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cur.fetchone()
            if not user:
                raise KeyError(
                    f"Account for '{email}' was not found. "
                    "The website owner must first register through FloodVision and verify their email."
                )

            # 3. Check email verification status
            if not bool(user["email_verified"]):
                raise ValueError(
                    f"Account '{email}' exists, but the email address is not verified. "
                    "Please verify your email address before running the bootstrap command."
                )

            # 4. Atomic role upgrade to 'admin'
            user_id = user["id"]
            update_cur = conn.execute(
                "UPDATE users SET role = 'admin', updated_at = ? WHERE id = ? AND role = 'user'",
                (now, user_id)
            )
            if update_cur.rowcount == 0:
                raise RuntimeError("Failed to update user role to administrator.")

            # 5. Insert audit log entry
            audit_id = str(uuid.uuid4())
            details = json.dumps({
                "email": email,
                "name": user["name"],
                "trigger": "cli_bootstrap",
                "notes": "First-time secure system initialization"
            })
            conn.execute(
                """
                INSERT INTO audit_logs (id, actor_id, action, target_user_id, details, timestamp)
                VALUES (?, ?, 'initial_admin_bootstrap', ?, ?, ?)
                """,
                (audit_id, user_id, user_id, details, now)
            )

        print(f"✅ Success: Initial administrator '{email}' (ID: {user_id}) promoted and audit log recorded.")
        return {
            "status": "success",
            "user_id": user_id,
            "email": email,
            "name": user["name"],
            "role": "admin"
        }
    finally:
        conn.close()

def main():
    print("=" * 65)
    print(" FloodVision: One-Time Initial Administrator Bootstrap")
    print("=" * 65)
    target = os.getenv("ADMIN_INITIAL_EMAIL") or settings.ADMIN_INITIAL_EMAIL
    print(f"Target Initial Admin Email: {target}")

    try:
        result = bootstrap_initial_admin()
        print(f"Result: {result}")
        sys.exit(0)
    except PermissionError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    except (KeyError, ValueError, RuntimeError) as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected Error during bootstrap: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
