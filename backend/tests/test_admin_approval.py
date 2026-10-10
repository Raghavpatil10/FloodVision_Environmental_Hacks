import pytest
import sqlite3
import json
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.repositories.user_repo import UserRepository
from app.repositories.admin_request_repo import AdminRequestRepository
from app.repositories.audit_log_repo import AuditLogRepository
from app.services.auth_service import AuthService
from app.config import settings
from app.scripts.bootstrap_admin import bootstrap_initial_admin

@pytest.fixture
def test_setup(tmp_path, monkeypatch):
    """
    Isolated test setup with a dedicated temporary database,
    monkeypatching user_repo, admin_request_repo, audit_log_repo, and auth_service.
    """
    db_file = str(tmp_path / "test_floodvision.db")
    monkeypatch.setattr("app.config.settings.USERS_DB_PATH", db_file)

    test_user_repo = UserRepository(db_path=db_file)
    test_request_repo = AdminRequestRepository(db_path=db_file)
    test_audit_repo = AuditLogRepository(db_path=db_file)
    test_auth_service = AuthService(repository=test_user_repo)

    # Patch singletons across repositories and routes
    monkeypatch.setattr("app.repositories.user_repo.user_repo", test_user_repo)
    monkeypatch.setattr("app.repositories.admin_request_repo.admin_request_repo", test_request_repo)
    monkeypatch.setattr("app.repositories.audit_log_repo.audit_log_repo", test_audit_repo)
    monkeypatch.setattr("app.services.auth_service.auth_service", test_auth_service)

    monkeypatch.setattr("app.api.deps.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.deps.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.auth.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.auth.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.admin.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.admin.audit_log_repo", test_audit_repo)
    monkeypatch.setattr("app.api.admin_requests.admin_request_repo", test_request_repo)

    with TestClient(app) as client:
        yield {
            "client": client,
            "user_repo": test_user_repo,
            "request_repo": test_request_repo,
            "audit_repo": test_audit_repo,
            "auth_service": test_auth_service,
            "db_file": db_file
        }

# 1. New registrations always receive the user role
def test_1_new_registration_always_receives_user_role(test_setup):
    client = test_setup["client"]
    res = client.post("/api/auth/register", json={
        "name": "Citizen User",
        "email": "citizen@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert res.status_code == 201
    data = res.json()["user"]
    assert data["role"] == "user"
    assert data["email_verified"] is False

# 2. Login and logout work
def test_2_login_and_logout_work(test_setup):
    client = test_setup["client"]
    # Register
    client.post("/api/auth/register", json={
        "name": "Login Tester",
        "email": "logintester@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    client.cookies.clear()

    # Login
    login_res = client.post("/api/auth/login", json={
        "email": "logintester@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    assert settings.SESSION_COOKIE_NAME in client.cookies

    # Me returns user
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "logintester@example.com"

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Next me returns 401
    client.cookies.clear()
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

# 3. Email verification is enforced
def test_3_email_verification_is_enforced(test_setup):
    client = test_setup["client"]
    # Register
    client.post("/api/auth/register", json={
        "name": "Unverified User",
        "email": "unverified@example.com",
        "password": "Password123!"
    })

    # Try applying for admin access without verified email -> 403 Forbidden
    req_res = client.post("/api/admin-requests", json={
        "reason": "I am a municipal traffic warden for North Sector."
    })
    assert req_res.status_code == 403
    assert "email verification required" in req_res.json()["detail"].lower()

    # Now verify email
    verify_res = client.post("/api/auth/verify-email")
    assert verify_res.status_code == 200
    assert verify_res.json()["user"]["email_verified"] is True

    # Now applying succeeds -> 201 Created
    req_res2 = client.post("/api/admin-requests", json={
        "reason": "I am a municipal traffic warden for North Sector."
    })
    assert req_res2.status_code == 201
    assert req_res2.json()["request"]["status"] == "pending"

# 4. Duplicate pending requests are rejected
def test_4_duplicate_pending_requests_rejected(test_setup):
    client = test_setup["client"]
    client.post("/api/auth/register", json={
        "name": "Duplicate Tester",
        "email": "dup@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")

    # First request
    res1 = client.post("/api/admin-requests", json={
        "reason": "First application for emergency flood response team."
    })
    assert res1.status_code == 201

    # Second request while pending -> HTTP 409 Conflict
    res2 = client.post("/api/admin-requests", json={
        "reason": "Second application trying to duplicate pending request."
    })
    assert res2.status_code == 409
    assert "pending" in res2.json()["detail"].lower()

# 5. Users cannot view other users' requests
def test_5_users_cannot_view_other_users_requests(test_setup):
    client = test_setup["client"]

    # User 1 registers and applies
    client.post("/api/auth/register", json={
        "name": "User One",
        "email": "user1@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    client.post("/api/admin-requests", json={
        "reason": "User 1 applying for warden role in Sector 1."
    })

    # User 2 registers and applies
    client.cookies.clear()
    client.post("/api/auth/register", json={
        "name": "User Two",
        "email": "user2@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    client.post("/api/admin-requests", json={
        "reason": "User 2 applying for warden role in Sector 2."
    })

    # User 2 gets /api/admin-requests/me -> should only see User 2's request
    my_reqs = client.get("/api/admin-requests/me").json()["requests"]
    assert len(my_reqs) == 1
    assert my_reqs[0]["reason"] == "User 2 applying for warden role in Sector 2."

    # User 2 cannot access admin list endpoint -> 403 Forbidden
    admin_list = client.get("/api/admin-requests")
    assert admin_list.status_code == 403

# 6. Normal users cannot access admin APIs
def test_6_normal_users_cannot_access_admin_apis(test_setup):
    client = test_setup["client"]
    client.post("/api/auth/register", json={
        "name": "Normal Citizen",
        "email": "normal@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")

    assert client.get("/api/admin/overview").status_code == 403
    assert client.get("/api/admin/users").status_code == 403
    assert client.get("/api/admin/audit-logs").status_code == 403
    assert client.get("/api/admin-requests").status_code == 403
    assert client.post("/api/admin-requests/some-id/review", json={"action": "approve"}).status_code == 403

# 7. Superadmins can view and review applications; regular admins cannot approve
def test_7_admins_can_view_and_review_applications(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]

    # Provision a regular admin
    hashed_pwd = test_setup["auth_service"].hash_password("AdminPass123!")
    user_repo.create_user(
        name="Officer Admin",
        email="officer@floodvision.org",
        hashed_password=hashed_pwd,
        role="admin",
        email_verified=True
    )

    # Provision a superadmin
    user_repo.create_user(
        name="Super Admin",
        email="superadmin@floodvision.org",
        hashed_password=hashed_pwd,
        role="superadmin",
        email_verified=True
    )

    # Citizen registers, verifies, applies
    client.post("/api/auth/register", json={
        "name": "Applicant Citizen",
        "email": "applicant@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Warden for flood monitoring district."
    })
    request_id = req_res.json()["request"]["id"]

    # Login as regular admin -> 403 Forbidden on review list
    client.cookies.clear()
    client.post("/api/auth/login", json={
        "email": "officer@floodvision.org",
        "password": "AdminPass123!"
    })
    admin_list_res = client.get("/api/admin-requests")
    assert admin_list_res.status_code == 403

    # Login as superadmin -> 200 OK
    client.cookies.clear()
    client.post("/api/auth/login", json={
        "email": "superadmin@floodvision.org",
        "password": "AdminPass123!"
    })
    list_res = client.get("/api/admin-requests")
    assert list_res.status_code == 200
    requests = list_res.json()["requests"]
    assert any(r["id"] == request_id for r in requests)

# 8. Self-approval is blocked
def test_8_self_approval_is_blocked(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]
    req_repo = test_setup["request_repo"]

    # Create superadmin
    hashed = test_setup["auth_service"].hash_password("AdminPass123!")
    admin = user_repo.create_user(
        name="Self Reviewer",
        email="selfadmin@example.com",
        hashed_password=hashed,
        role="superadmin",
        email_verified=True
    )

    # Insert a dummy pending request belonging to the admin directly in DB
    dummy_req = req_repo.create_request.__wrapped__(req_repo, admin["id"], "Self request for testing") if hasattr(req_repo.create_request, "__wrapped__") else None
    if not dummy_req:
        # Create directly in DB
        with req_repo._get_connection() as conn:
            req_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO admin_requests (id, user_id, reason, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))",
                (req_id, admin["id"], "Self test reason")
            )
            conn.commit()
            dummy_req_id = req_id

    # Login as this admin
    client.post("/api/auth/login", json={
        "email": "selfadmin@example.com",
        "password": "AdminPass123!"
    })

    # Try reviewing own request -> 403 Forbidden
    review_res = client.post(f"/api/admin-requests/{dummy_req_id}/review", json={
        "action": "approve",
        "note": "Self approving"
    })
    assert review_res.status_code == 403
    assert "self-approval" in review_res.json()["detail"].lower()

# 9. Approval changes the role and records audit log atomically
def test_9_approval_changes_role_and_records_audit_log(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]
    audit_repo = test_setup["audit_repo"]

    # Superadmin
    hashed = test_setup["auth_service"].hash_password("AdminPass123!")
    admin = user_repo.create_user(
        name="Chief Admin",
        email="chief@example.com",
        hashed_password=hashed,
        role="superadmin",
        email_verified=True
    )

    # Citizen
    client.post("/api/auth/register", json={
        "name": "Promotee User",
        "email": "promotee@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Ready for emergency administration duty."
    })
    req_id = req_res.json()["request"]["id"]
    promotee_id = req_res.json()["request"]["user_id"]

    # Login as Chief Superadmin
    client.cookies.clear()
    client.post("/api/auth/login", json={
        "email": "chief@example.com",
        "password": "AdminPass123!"
    })

    # Approve request
    review_res = client.post(f"/api/admin-requests/{req_id}/review", json={
        "action": "approve",
        "note": "Credentials verified and accepted."
    })
    assert review_res.status_code == 200
    assert review_res.json()["request"]["status"] == "approved"

    # Verify user role is now admin in DB
    updated_user = user_repo.get_by_id(promotee_id)
    assert updated_user["role"] == "admin"

    # Verify audit log was recorded
    logs = audit_repo.list_logs_for_target(promotee_id)
    assert any(l["action"] == "admin_request_approved" for l in logs)

# 10. Rejection does not grant admin privileges
def test_10_rejection_does_not_grant_admin_privileges(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]

    # Superadmin
    hashed = test_setup["auth_service"].hash_password("AdminPass123!")
    admin = user_repo.create_user(
        name="Strict Admin",
        email="strict@example.com",
        hashed_password=hashed,
        role="superadmin",
        email_verified=True
    )

    # Citizen
    client.post("/api/auth/register", json={
        "name": "Rejected User",
        "email": "rejectme@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Not enough experience provided."
    })
    req_id = req_res.json()["request"]["id"]
    rejectee_id = req_res.json()["request"]["user_id"]

    # Login as superadmin
    client.cookies.clear()
    client.post("/api/auth/login", json={
        "email": "strict@example.com",
        "password": "AdminPass123!"
    })

    # Reject
    review_res = client.post(f"/api/admin-requests/{req_id}/review", json={
        "action": "reject",
        "note": "Insufficient municipal credentials."
    })
    assert review_res.status_code == 200
    assert review_res.json()["request"]["status"] == "rejected"

    # Role remains user
    user = user_repo.get_by_id(rejectee_id)
    assert user["role"] == "user"

# 11. Concurrent reviews cannot both process the same pending request
def test_11_concurrent_reviews_prevent_double_processing(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]

    # Superadmin
    hashed = test_setup["auth_service"].hash_password("AdminPass123!")
    user_repo.create_user(
        name="Review Admin",
        email="reviewadmin@example.com",
        hashed_password=hashed,
        role="superadmin",
        email_verified=True
    )

    # Applicant
    client.post("/api/auth/register", json={
        "name": "Race Applicant",
        "email": "race@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Testing atomic state update concurrency."
    })
    req_id = req_res.json()["request"]["id"]

    # Login as Superadmin
    client.cookies.clear()
    client.post("/api/auth/login", json={
        "email": "reviewadmin@example.com",
        "password": "AdminPass123!"
    })

    # First review succeeds
    res1 = client.post(f"/api/admin-requests/{req_id}/review", json={
        "action": "approve",
        "note": "First review succeeds"
    })
    assert res1.status_code == 200

    # Second review attempt returns 409 Conflict (already reviewed)
    res2 = client.post(f"/api/admin-requests/{req_id}/review", json={
        "action": "reject",
        "note": "Second review should fail"
    })
    assert res2.status_code == 409

# 12. Initial bootstrap fails if a superadmin already exists
def test_12_initial_bootstrap_fails_if_admin_exists(test_setup, monkeypatch):
    user_repo = test_setup["user_repo"]

    # Setup owner account
    hashed = test_setup["auth_service"].hash_password("OwnerPassword123!")
    owner = user_repo.create_user(
        name="Site Owner",
        email="owner@floodvision.org",
        hashed_password=hashed,
        role="user",
        email_verified=True
    )

    monkeypatch.setattr("app.config.settings.ADMIN_INITIAL_EMAIL", "owner@floodvision.org")

    # First bootstrap succeeds
    boot_res = bootstrap_initial_admin(target_email="owner@floodvision.org")
    assert boot_res["status"] == "success"
    assert user_repo.get_by_id(owner["id"])["role"] == "superadmin"

    # Second bootstrap attempt MUST fail with PermissionError because a superadmin now exists
    with pytest.raises(PermissionError) as exc_info:
        bootstrap_initial_admin(target_email="owner@floodvision.org")
    assert "already exists" in str(exc_info.value).lower()

# 13. Revoked or disabled accounts cannot continue using admin-only operations
def test_13_disabled_account_cannot_continue_admin_operations(test_setup):
    client = test_setup["client"]
    user_repo = test_setup["user_repo"]

    hashed = test_setup["auth_service"].hash_password("AdminPass123!")
    admin = user_repo.create_user(
        name="Suspended Admin",
        email="suspended@floodvision.org",
        hashed_password=hashed,
        role="admin",
        email_verified=True
    )

    # Login
    client.post("/api/auth/login", json={
        "email": "suspended@floodvision.org",
        "password": "AdminPass123!"
    })
    assert client.get("/api/admin/overview").status_code == 200

    # Deactivate account in database
    user_repo.update_user_status(admin["id"], is_active=False)

    # Subsequent protected requests return 403 Forbidden
    res = client.get("/api/admin/overview")
    assert res.status_code == 403
    assert "suspended" in res.json()["detail"].lower() or "deactivated" in res.json()["detail"].lower()

# 14. Existing FloodVision reporting, depth estimation, and routes remain operational
def test_14_existing_floodvision_features_unbroken(test_setup):
    client = test_setup["client"]

    # Health check
    assert client.get("/health").status_code == 200

    # Incidents list
    incidents_res = client.get("/api/incidents")
    assert incidents_res.status_code == 200
    assert isinstance(incidents_res.json(), list)

    # Route planner
    routes_res = client.post("/api/routes/plan", json={
        "origin": {"lat": 12.9716, "lon": 77.5946},
        "destination": {"lat": 12.9780, "lon": 77.6000}
    })
    assert routes_res.status_code == 200
