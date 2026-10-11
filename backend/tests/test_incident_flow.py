import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.repositories.user_repo import UserRepository
from app.repositories.admin_request_repo import AdminRequestRepository
from app.repositories.region_repo import RegionRepository
from app.repositories.incident_repo import incident_repo
from app.repositories.audit_log_repo import AuditLogRepository
from app.services.auth_service import AuthService
import io
from PIL import Image

def create_dummy_image() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (320, 240), color=(0, 100, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()

@pytest.fixture
def flow_test_setup(tmp_path, monkeypatch):
    db_file = str(tmp_path / "test_flow.db")
    monkeypatch.setattr("app.config.settings.USERS_DB_PATH", db_file)

    test_user_repo = UserRepository(db_path=db_file)
    test_req_repo = AdminRequestRepository(db_path=db_file)
    test_reg_repo = RegionRepository(db_path=db_file)
    test_audit_repo = AuditLogRepository(db_path=db_file)
    test_auth_service = AuthService(repository=test_user_repo)

    monkeypatch.setattr("app.repositories.user_repo.user_repo", test_user_repo)
    monkeypatch.setattr("app.repositories.admin_request_repo.admin_request_repo", test_req_repo)
    monkeypatch.setattr("app.repositories.region_repo.region_repo", test_reg_repo)
    monkeypatch.setattr("app.repositories.audit_log_repo.audit_log_repo", test_audit_repo)
    monkeypatch.setattr("app.services.auth_service.auth_service", test_auth_service)

    monkeypatch.setattr("app.api.deps.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.deps.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.auth.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.auth.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.admin.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.admin.region_repo", test_reg_repo)
    monkeypatch.setattr("app.api.admin.audit_log_repo", test_audit_repo)

    with TestClient(app) as client:
        yield {
            "client": client,
            "user_repo": test_user_repo,
            "reg_repo": test_reg_repo,
            "auth_service": test_auth_service
        }

def test_incident_lifecycle_flow(flow_test_setup):
    client = flow_test_setup["client"]
    user_repo = flow_test_setup["user_repo"]
    reg_repo = flow_test_setup["reg_repo"]
    auth_service = flow_test_setup["auth_service"]

    # 1. Create a Regional Admin assigned to Central Sector (19.0760, 72.8777, radius 5.0 km)
    admin = user_repo.create_user(
        name="Sector Officer",
        email="sector@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(
        admin_user_id=admin["id"],
        region_name="Mumbai Central Ward",
        center_latitude=19.0760,
        center_longitude=72.8777,
        radius_km=5.0
    )

    # 2. Citizen uploads an image of an issue near the center (1.5 km away: 19.0850, 72.8800)
    img_bytes = create_dummy_image()
    upload_res = client.post(
        "/api/analyze",
        data={"latitude": 19.0850, "longitude": 72.8800},
        files={"file": ("puddle.jpg", img_bytes, "image/jpeg")}
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert "incident_id" in upload_data
    incident_id = upload_data["incident_id"]

    # Also save an outlier incident far away (30 km away: 19.3000, 73.0000)
    outlier_id = incident_repo.save_incident({
        "latitude": 19.3000,
        "longitude": 73.0000,
        "estimated_depth_cm": 25.0,
        "status_flag": "Caution",
        "safety_score": 60,
        "risk_level": "moderate",
        "confidence": "0.90",
        "status": "active"
    })

    # 3. Live Map public endpoint (/api/incidents) contains the new active incident
    map_res = client.get("/api/incidents")
    assert map_res.status_code == 200
    active_ids = [i["incident_id"] for i in map_res.json()]
    assert incident_id in active_ids

    # 4. Admin logs in and checks /api/admin/incidents
    client.post("/api/auth/login", json={"email": "sector@floodvision.org", "password": "AdminPass123!"})
    admin_inc_res = client.get("/api/admin/incidents")
    assert admin_inc_res.status_code == 200
    admin_data = admin_inc_res.json()
    assert admin_data["has_assigned_region"] is True
    assert admin_data["radius_km"] == 5.0

    regional_ids = [i["incident_id"] for i in admin_data["incidents"]]
    # The 1.5km incident must be inside the 5km radius!
    assert incident_id in regional_ids
    # The 30km outlier incident must be filtered out!
    assert outlier_id not in regional_ids

    # 5. Admin resolves the incident
    resolve_res = client.patch(f"/api/admin/incidents/{incident_id}/resolve")
    assert resolve_res.status_code == 200
    assert "RESOLVED" in resolve_res.json()["message"]

    # 6. Public Live Map now purges the resolved incident
    map_after_res = client.get("/api/incidents")
    active_ids_after = [i["incident_id"] for i in map_after_res.json()]
    assert incident_id not in active_ids_after

    # But with include_resolved=true, it is accessible
    map_history_res = client.get("/api/incidents?include_resolved=true")
    history_ids = [i["incident_id"] for i in map_history_res.json()]
    assert incident_id in history_ids
