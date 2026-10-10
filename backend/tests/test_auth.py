import pytest
import sqlite3
import time
from fastapi.testclient import TestClient
from app.main import app
from app.repositories.user_repo import UserRepository
from app.services.auth_service import AuthService
from app.config import settings

@pytest.fixture
def auth_test_client(tmp_path, monkeypatch):
    """
    Test fixture providing an isolated SQLite database, fresh service instances,
    and a configured FastAPI test client.
    """
    db_file = str(tmp_path / "test_users.db")
    test_repo = UserRepository(db_path=db_file)
    test_service = AuthService(repository=test_repo)
    
    # Patch singleton instances in modules
    monkeypatch.setattr("app.repositories.user_repo.user_repo", test_repo)
    monkeypatch.setattr("app.services.auth_service.auth_service", test_service)
    monkeypatch.setattr("app.api.deps.user_repo", test_repo)
    monkeypatch.setattr("app.api.deps.auth_service", test_service)
    monkeypatch.setattr("app.api.auth.user_repo", test_repo)
    monkeypatch.setattr("app.api.auth.auth_service", test_service)
    monkeypatch.setattr("app.api.admin.user_repo", test_repo)

    with TestClient(app) as client:
        yield client, test_service, test_repo, db_file

# Scenario 1: Successful user registration
def test_1_successful_user_registration(auth_test_client):
    client, _, _, _ = auth_test_client
    res = client.post("/api/auth/register", json={
        "name": "Jane Citizen",
        "email": "Jane.Citizen@Example.COM",  # mixed case to verify normalization
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["email"] == "jane.citizen@example.com"
    assert data["user"]["name"] == "Jane Citizen"
    assert data["user"]["role"] == "user"
    assert data["user"]["is_active"] is True
    assert settings.SESSION_COOKIE_NAME in res.cookies

# Scenario 2: Duplicate email registration is rejected
def test_2_duplicate_email_rejected(auth_test_client):
    client, _, _, _ = auth_test_client
    payload = {
        "name": "Jane Citizen",
        "email": "jane@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()

# Scenario 3: Invalid email and weak password are rejected
def test_3_invalid_email_and_weak_password_rejected(auth_test_client):
    client, _, _, _ = auth_test_client
    # Invalid email format
    res_bad_email = client.post("/api/auth/register", json={
        "name": "Invalid Email User",
        "email": "not-an-email",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    })
    assert res_bad_email.status_code == 422 or res_bad_email.status_code == 400

    # Short password (< 8 chars)
    res_short = client.post("/api/auth/register", json={
        "name": "Short Password User",
        "email": "short@example.com",
        "password": "short",
        "confirm_password": "short"
    })
    assert res_short.status_code == 422 or res_short.status_code == 400

    # Password without numbers
    res_no_num = client.post("/api/auth/register", json={
        "name": "No Number User",
        "email": "nonum@example.com",
        "password": "PasswordOnlyWithoutNumbers!",
        "confirm_password": "PasswordOnlyWithoutNumbers!"
    })
    assert res_no_num.status_code == 422 or res_no_num.status_code == 400

    # Password mismatch
    res_mismatch = client.post("/api/auth/register", json={
        "name": "Mismatch User",
        "email": "mismatch@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "DifferentPassword123!"
    })
    assert res_mismatch.status_code == 400
    assert "passwords do not match" in res_mismatch.json()["detail"].lower()

# Scenario 4: Passwords are stored as hashes, not plaintext
def test_4_passwords_stored_as_secure_hashes_never_plaintext(auth_test_client):
    client, _, test_repo, db_file = auth_test_client
    plain_password = "MySecretPassword123!"
    res = client.post("/api/auth/register", json={
        "name": "Audit User",
        "email": "audit@example.com",
        "password": plain_password,
        "confirm_password": plain_password
    })
    assert res.status_code == 201

    # Verify directly against database rows
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = 'audit@example.com'")
    row = dict(cursor.fetchone())
    conn.close()

    stored_hash = row.get("password_hash") or row.get("hashed_password")
    assert stored_hash is not None
    # Verify bcrypt signature
    assert stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$")
    assert stored_hash != plain_password
    assert plain_password not in str(row.values())

    # Verify API response never exposes password_hash
    response_data = res.json()["user"]
    assert "password_hash" not in response_data
    assert "hashed_password" not in response_data
    assert "password" not in response_data

# Scenario 5: Valid login succeeds
def test_5_valid_login_succeeds(auth_test_client):
    client, _, _, _ = auth_test_client
    client.post("/api/auth/register", json={
        "name": "Login User",
        "email": "login@example.com",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!"
    })

    res = client.post("/api/auth/login", json={
        "email": "LOGIN@example.com",
        "password": "ValidPassword123!",
        "remember_me": True
    })
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "login@example.com"
    assert settings.SESSION_COOKIE_NAME in res.cookies

# Scenario 6: Incorrect password is rejected without revealing email existence
def test_6_incorrect_password_rejected_safe_error(auth_test_client):
    client, _, _, _ = auth_test_client
    client.post("/api/auth/register", json={
        "name": "Existing User",
        "email": "exists@example.com",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!"
    })

    # Wrong password for existing user
    res_wrong_pw = client.post("/api/auth/login", json={
        "email": "exists@example.com",
        "password": "IncorrectPassword123!"
    })
    assert res_wrong_pw.status_code == 401
    msg1 = res_wrong_pw.json()["detail"]

    # Non-existent user
    res_no_user = client.post("/api/auth/login", json={
        "email": "doesnotexist@example.com",
        "password": "IncorrectPassword123!"
    })
    assert res_no_user.status_code == 401
    msg2 = res_no_user.json()["detail"]

    # Error message must be identical to avoid user enumeration
    assert msg1 == msg2 == "Invalid email address or password."

# Scenario 7: Unauthenticated requests to protected APIs receive 401
def test_7_unauthenticated_requests_receive_401(auth_test_client):
    client, _, _, _ = auth_test_client
    res_me = client.get("/api/auth/me")
    assert res_me.status_code == 401

    res_admin = client.get("/api/admin/overview")
    assert res_admin.status_code == 401

# Scenario 8: Normal users receive 403 when calling admin-only APIs
def test_8_normal_user_receives_403_on_admin_endpoint(auth_test_client):
    client, _, _, _ = auth_test_client
    reg = client.post("/api/auth/register", json={
        "name": "Normal Citizen",
        "email": "citizen@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    session_cookie = reg.cookies[settings.SESSION_COOKIE_NAME]

    # Call admin overview endpoint as normal user
    res_forbidden = client.get(
        "/api/admin/overview",
        cookies={settings.SESSION_COOKIE_NAME: session_cookie}
    )
    assert res_forbidden.status_code == 403
    assert "Administrator" in res_forbidden.json()["detail"]

# Scenario 9 & 10: Forged admin role injection does not grant admin access
def test_9_10_forged_admin_role_rejected(auth_test_client):
    client, _, test_repo, _ = auth_test_client
    # Attempting to supply role="admin" during public registration
    res_reg = client.post("/api/auth/register", json={
        "name": "Attacker User",
        "email": "attacker@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "admin"
    })
    assert res_reg.status_code == 201
    assert res_reg.json()["user"]["role"] == "user"

    # Verify database record is strictly 'user'
    db_user = test_repo.get_by_email("attacker@example.com")
    assert db_user["role"] == "user"

    # Attempting to call admin API
    attacker_cookie = res_reg.cookies[settings.SESSION_COOKIE_NAME]
    res_admin = client.get(
        "/api/admin/overview",
        cookies={settings.SESSION_COOKIE_NAME: attacker_cookie}
    )
    assert res_admin.status_code == 403

# Scenario 11: Public registration cannot create an admin account
def test_11_public_registration_cannot_create_admin(auth_test_client):
    client, _, test_repo, _ = auth_test_client
    res = client.post("/api/auth/register", json={
        "name": "Fake Admin",
        "email": "fakeadmin@floodvision.org",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "admin",
        "is_admin": True
    })
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "user"
    user_record = test_repo.get_by_email("fakeadmin@floodvision.org")
    assert user_record["role"] == "user"

# Scenario 12: Admin provisioning works through controlled setup procedure
def test_12_admin_provisioning_via_controlled_service(auth_test_client):
    client, test_service, _, _ = auth_test_client
    admin_user = test_service.create_admin_user(
        name="Chief Incident Warden",
        email="chief.warden@floodvision.org",
        password="AdminMasterPass123!"
    )
    assert admin_user["role"] == "admin"
    assert admin_user["email"] == "chief.warden@floodvision.org"

    # Admin signs in
    login_res = client.post("/api/auth/login", json={
        "email": "chief.warden@floodvision.org",
        "password": "AdminMasterPass123!"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["role"] == "admin"

    # Admin accesses admin-only endpoint
    admin_cookie = login_res.cookies[settings.SESSION_COOKIE_NAME]
    admin_overview = client.get(
        "/api/admin/overview",
        cookies={settings.SESSION_COOKIE_NAME: admin_cookie}
    )
    assert admin_overview.status_code == 200
    assert admin_overview.json()["admin_user"]["role"] == "admin"

# Scenario 13: Logout invalidates the session
def test_13_logout_invalidates_session(auth_test_client):
    client, _, _, _ = auth_test_client
    reg = client.post("/api/auth/register", json={
        "name": "Logout Tester",
        "email": "logout@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    session_cookie = reg.cookies[settings.SESSION_COOKIE_NAME]

    # Verify session is initially valid
    res_me_before = client.get(
        "/api/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: session_cookie}
    )
    assert res_me_before.status_code == 200

    # Execute logout
    res_logout = client.post("/api/auth/logout")
    assert res_logout.status_code == 200
    # Cookie is expired/cleared via Set-Cookie header
    assert "set-cookie" in res_logout.headers
    assert settings.SESSION_COOKIE_NAME in res_logout.headers["set-cookie"]
    # Subsequent call without cookie returns 401
    res_me_after = client.get("/api/auth/me")
    assert res_me_after.status_code == 401

# Scenario 14: Expired or invalid sessions are rejected
def test_14_expired_or_invalid_session_rejected(auth_test_client):
    client, test_service, _, _ = auth_test_client
    # Invalid/Tampered token
    res_tampered = client.get(
        "/api/auth/me",
        cookies={settings.SESSION_COOKIE_NAME: "tampered.jwt.or.serializer.token"}
    )
    assert res_tampered.status_code == 401

    # Token with expired timestamp (max_age=0)
    token = test_service.create_session_token("some-user-id", "user")
    # Verifying token with max_age=-1 simulating expired time
    payload = test_service.verify_session_token(token, max_age=-1)
    assert payload is None

# Scenario 15: Users cannot access another user's private records (IDOR protection)
def test_15_idor_prevention_user_cannot_access_other_user_record(auth_test_client):
    client, _, _, _ = auth_test_client
    # Register User A
    reg_a = client.post("/api/auth/register", json={
        "name": "User Alpha",
        "email": "alpha@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    user_a_id = reg_a.json()["user"]["id"]
    cookie_a = reg_a.cookies[settings.SESSION_COOKIE_NAME]

    # Register User B
    reg_b = client.post("/api/auth/register", json={
        "name": "User Beta",
        "email": "beta@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    user_b_id = reg_b.json()["user"]["id"]

    # User A accesses their own record -> 200 OK
    res_own = client.get(
        f"/api/auth/users/{user_a_id}",
        cookies={settings.SESSION_COOKIE_NAME: cookie_a}
    )
    assert res_own.status_code == 200
    assert res_own.json()["id"] == user_a_id

    # User A attempts to access User B's record -> 403 Forbidden!
    res_other = client.get(
        f"/api/auth/users/{user_b_id}",
        cookies={settings.SESSION_COOKIE_NAME: cookie_a}
    )
    assert res_other.status_code == 403
    assert "cannot access another user's private records" in res_other.json()["detail"].lower()

# Scenario 16: Database records persist after restarting the backend
def test_16_database_records_persist_after_restart(auth_test_client):
    _, test_service, _, db_file = auth_test_client
    # Create user in current instance
    test_service.register_user(
        name="Persistent Citizen",
        email="persist@example.com",
        password="Password123!"
    )

    # Simulate backend restart by creating a completely new repository instance pointing to the same file
    restarted_repo = UserRepository(db_path=db_file)
    reloaded_user = restarted_repo.get_by_email("persist@example.com")
    
    assert reloaded_user is not None
    assert reloaded_user["name"] == "Persistent Citizen"
    assert reloaded_user["email"] == "persist@example.com"
    assert reloaded_user["is_active"] is True
    # Passwords remain securely verifiable after restart
    restarted_service = AuthService(repository=restarted_repo)
    assert restarted_service.verify_password("Password123!", reloaded_user["password_hash"])

# Scenario 17: CORS, cookie, and session settings configured properly
def test_17_cors_and_cookie_configuration(auth_test_client):
    client, _, _, _ = auth_test_client
    # CORS preflight request
    res_options = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
    )
    assert res_options.status_code == 200
    assert res_options.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res_options.headers.get("access-control-allow-credentials") == "true"

# Scenario 18: Rate limiting blocks brute-force password guessing
def test_18_rate_limiting_blocks_brute_force(auth_test_client):
    client, test_service, _, _ = auth_test_client
    test_service.rate_limiter.reset()

    # Register user
    client.post("/api/auth/register", json={
        "name": "Target Account",
        "email": "target@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })

    # Execute 5 incorrect login attempts
    for _ in range(5):
        res = client.post("/api/auth/login", json={
            "email": "target@example.com",
            "password": "WrongPassword123!"
        })
        assert res.status_code == 401

    # 6th attempt should be blocked with 429 Too Many Requests
    res_blocked = client.post("/api/auth/login", json={
        "email": "target@example.com",
        "password": "WrongPassword123!"
    })
    assert res_blocked.status_code == 429
    assert "too many failed login attempts" in res_blocked.json()["detail"].lower()

# Scenario 19: Deactivated accounts cannot log in
def test_19_deactivated_account_blocked(auth_test_client):
    client, test_service, test_repo, _ = auth_test_client
    reg_user = test_service.register_user(
        name="Deactivated User",
        email="disabled@example.com",
        password="Password123!"
    )
    # Deactivate the user in repository
    test_repo.update_user_status(reg_user["id"], is_active=False)

    # Attempt to log in
    res = client.post("/api/auth/login", json={
        "email": "disabled@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 403
    assert "suspended or deactivated" in res.json()["detail"].lower()
