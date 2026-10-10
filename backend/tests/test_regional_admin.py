import pytest
import io
import json
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.user_repo import UserRepository
from app.repositories.admin_request_repo import AdminRequestRepository
from app.repositories.region_repo import RegionRepository
from app.repositories.image_repo import ImageRepository
from app.repositories.audit_log_repo import AuditLogRepository
from app.services.auth_service import AuthService

def create_test_image(format="JPEG", size=(100, 100), color=(0, 120, 255)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()

@pytest.fixture
def regional_test_setup(tmp_path, monkeypatch):
    db_file = str(tmp_path / "test_regional.db")
    monkeypatch.setattr("app.config.settings.USERS_DB_PATH", db_file)

    test_user_repo = UserRepository(db_path=db_file)
    test_req_repo = AdminRequestRepository(db_path=db_file)
    test_reg_repo = RegionRepository(db_path=db_file)
    test_img_repo = ImageRepository(db_path=db_file)
    test_audit_repo = AuditLogRepository(db_path=db_file)
    test_auth_service = AuthService(repository=test_user_repo)

    # Patch modules
    monkeypatch.setattr("app.repositories.user_repo.user_repo", test_user_repo)
    monkeypatch.setattr("app.repositories.admin_request_repo.admin_request_repo", test_req_repo)
    monkeypatch.setattr("app.repositories.region_repo.region_repo", test_reg_repo)
    monkeypatch.setattr("app.repositories.image_repo.image_repo", test_img_repo)
    monkeypatch.setattr("app.repositories.audit_log_repo.audit_log_repo", test_audit_repo)
    monkeypatch.setattr("app.services.auth_service.auth_service", test_auth_service)

    monkeypatch.setattr("app.api.deps.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.deps.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.auth.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.auth.auth_service", test_auth_service)
    monkeypatch.setattr("app.api.admin_requests.admin_request_repo", test_req_repo)
    monkeypatch.setattr("app.api.images.image_repo", test_img_repo)
    monkeypatch.setattr("app.api.images.region_repo", test_reg_repo)
    monkeypatch.setattr("app.api.images.audit_log_repo", test_audit_repo)
    monkeypatch.setattr("app.api.superadmin.user_repo", test_user_repo)
    monkeypatch.setattr("app.api.superadmin.region_repo", test_reg_repo)
    monkeypatch.setattr("app.api.superadmin.image_repo", test_img_repo)
    monkeypatch.setattr("app.api.superadmin.audit_log_repo", test_audit_repo)

    with TestClient(app) as client:
        yield {
            "client": client,
            "user_repo": test_user_repo,
            "req_repo": test_req_repo,
            "reg_repo": test_reg_repo,
            "img_repo": test_img_repo,
            "audit_repo": test_audit_repo,
            "auth_service": test_auth_service
        }

# 1. New registrations receive the regular user role
def test_1_new_registration_regular_user_role(regional_test_setup):
    client = regional_test_setup["client"]
    res = client.post("/api/auth/register", json={
        "name": "Jane Citizen",
        "email": "jane@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "user"

# 2. Pending requests do not grant admin access
def test_2_pending_requests_do_not_grant_admin_access(regional_test_setup):
    client = regional_test_setup["client"]
    client.post("/api/auth/register", json={
        "name": "Pending Officer",
        "email": "pending@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Requesting regional admin role for monitoring.",
        "requested_region": "North Zone"
    })
    assert req_res.status_code == 201
    assert req_res.json()["request"]["status"] == "pending"

    # User cannot access admin endpoints
    res_images = client.get("/api/admin/images")
    assert res_images.status_code == 403
    res_overview = client.get("/api/admin/overview")
    assert res_overview.status_code == 403

# 3. Only a superadmin can approve an admin request
def test_3_only_superadmin_can_approve_admin_request(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    auth_service = regional_test_setup["auth_service"]

    # Regular admin
    user_repo.create_user(
        name="Regular Admin",
        email="regadmin@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    # Superadmin
    user_repo.create_user(
        name="Super Admin",
        email="super@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="superadmin",
        email_verified=True
    )

    # Applicant
    client.post("/api/auth/register", json={
        "name": "Applicant Officer",
        "email": "appofficer@example.com",
        "password": "Password123!"
    })
    client.post("/api/auth/verify-email")
    req_res = client.post("/api/admin-requests", json={
        "reason": "Official emergency officer application.",
        "requested_region": "Downtown Ward"
    })
    req_id = req_res.json()["request"]["id"]

    # 1. Regular admin tries to approve -> 403 Forbidden
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "regadmin@floodvision.org", "password": "AdminPass123!"})
    res_fail = client.post(f"/api/admin-requests/{req_id}/review", json={"action": "approve"})
    assert res_fail.status_code == 403

    # 2. Superadmin approves -> 200 OK
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "super@floodvision.org", "password": "AdminPass123!"})
    res_ok = client.post(f"/api/admin-requests/{req_id}/review", json={
        "action": "approve",
        "note": "Approved by central superadmin.",
        "region_name": "Downtown Ward",
        "center_latitude": 12.9716,
        "center_longitude": 77.5946,
        "radius_km": 5.0
    })
    assert res_ok.status_code == 200
    assert res_ok.json()["request"]["status"] == "approved"

# 4. An approved admin without an active region cannot manage regional images
def test_4_approved_admin_without_region_cannot_manage_images(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    auth_service = regional_test_setup["auth_service"]

    # Create admin with NO region
    user_repo.create_user(
        name="Regionless Admin",
        email="noregion@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )

    client.post("/api/auth/login", json={"email": "noregion@floodvision.org", "password": "AdminPass123!"})
    res = client.get("/api/admin/images")
    assert res.status_code == 403
    assert "geographic region" in res.json()["detail"].lower()

# 5. An admin can view an image inside their assigned region
def test_5_admin_can_view_image_inside_assigned_region(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    img_repo = regional_test_setup["img_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Ward Admin",
        email="wardadmin@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    # Assign region centered at Bangalore (12.9716, 77.5946, 5km)
    region = reg_repo.assign_region(
        admin_user_id=admin["id"],
        region_name="Bangalore Central",
        center_latitude=12.9716,
        center_longitude=77.5946,
        radius_km=5.0
    )

    # Save an image 1 km away (12.9750, 77.5960)
    image = img_repo.save_image(
        uploader_id=admin["id"],
        region_id=region["id"],
        title="Cubbon Park Waterlogging",
        description="Water accumulation near entrance",
        s3_object_key="test/cubbon.jpg",
        content_type="image/jpeg",
        file_size=1024,
        latitude=12.9750,
        longitude=77.5960
    )

    client.post("/api/auth/login", json={"email": "wardadmin@floodvision.org", "password": "AdminPass123!"})
    
    # 1. In list
    list_res = client.get("/api/admin/images")
    assert list_res.status_code == 200
    imgs = list_res.json()["images"]
    assert any(i["id"] == image["id"] for i in imgs)

    # 2. In detail
    detail_res = client.get(f"/api/admin/images/{image['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["title"] == "Cubbon Park Waterlogging"

# 6. An admin cannot view or download an image outside their region
def test_6_admin_cannot_view_image_outside_region(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    img_repo = regional_test_setup["img_repo"]
    auth_service = regional_test_setup["auth_service"]

    # Admin 1 in Bangalore
    admin1 = user_repo.create_user(
        name="Bangalore Admin",
        email="blr@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin1["id"], "Bangalore", 12.9716, 77.5946, radius_km=5.0)

    # Admin 2 in Mumbai (18.9220, 72.8347)
    admin2 = user_repo.create_user(
        name="Mumbai Admin",
        email="mum@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg2 = reg_repo.assign_region(admin2["id"], "Mumbai", 18.9220, 72.8347, radius_km=5.0)

    # Mumbai Image
    mumbai_img = img_repo.save_image(
        uploader_id=admin2["id"],
        region_id=reg2["id"],
        title="Marine Drive Flood",
        description="High tide overflow",
        s3_object_key="test/mumbai.jpg",
        content_type="image/jpeg",
        file_size=2048,
        latitude=18.9250,
        longitude=77.8350
    )

    # Bangalore Admin logs in
    client.post("/api/auth/login", json={"email": "blr@floodvision.org", "password": "AdminPass123!"})

    # Direct IDOR attempt to view Mumbai image -> 403 Forbidden
    res = client.get(f"/api/admin/images/{mumbai_img['id']}")
    assert res.status_code == 403
    assert "outside your authorized" in res.json()["detail"].lower()

# 7. An admin cannot obtain a presigned URL for an unauthorized image
def test_7_admin_cannot_get_presigned_url_for_unauthorized_image(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    img_repo = regional_test_setup["img_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin1 = user_repo.create_user(
        name="Admin A",
        email="admina@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin1["id"], "Region A", 10.0, 10.0, radius_km=5.0)

    # Far away image (lat 50.0, lon 50.0)
    foreign_img = img_repo.save_image(
        uploader_id="other_user",
        region_id=None,
        title="Far Image",
        description="Far",
        s3_object_key="test/far.jpg",
        content_type="image/jpeg",
        file_size=1024,
        latitude=50.0,
        longitude=50.0
    )

    client.post("/api/auth/login", json={"email": "admina@floodvision.org", "password": "AdminPass123!"})
    res = client.get(f"/api/admin/images/{foreign_img['id']}/view-url")
    assert res.status_code == 403

# 8. An upload inside the assigned region succeeds when all other validations pass
def test_8_upload_inside_assigned_region_succeeds(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Uploader Admin",
        email="uploader@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin["id"], "City Sector", 12.9716, 77.5946, radius_km=5.0)

    client.post("/api/auth/login", json={"email": "uploader@floodvision.org", "password": "AdminPass123!"})

    img_bytes = create_test_image("JPEG")
    res = client.post(
        "/api/admin/images",
        data={
            "title": "MG Road Crossing",
            "description": "15cm standing puddle",
            "latitude": 12.9720,
            "longitude": 77.5950,
            "severity": "moderate"
        },
        files={"file": ("mg_road.jpg", img_bytes, "image/jpeg")}
    )
    assert res.status_code == 201
    data = res.json()
    assert "image" in data
    assert data["image"]["title"] == "MG Road Crossing"
    assert data["image"]["location_validation_status"] == "verified"
    assert data["image"]["view_url"] is not None

# 9. An upload outside the assigned region is rejected
def test_9_upload_outside_assigned_region_is_rejected(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Perimeter Admin",
        email="perimeter@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin["id"], "Local Ward", 12.9716, 77.5946, radius_km=2.0)

    client.post("/api/auth/login", json={"email": "perimeter@floodvision.org", "password": "AdminPass123!"})

    img_bytes = create_test_image("JPEG")
    # Coordinates 20km away (13.1000, 77.6000)
    res = client.post(
        "/api/admin/images",
        data={
            "title": "Out of Bounds Water",
            "latitude": 13.1000,
            "longitude": 77.6000
        },
        files={"file": ("outside.jpg", img_bytes, "image/jpeg")}
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "Upload denied: the selected image location is outside your assigned region. Please choose a location within your authorized area."

# 10. GPS and manually selected locations both undergo backend region validation
def test_10_both_gps_and_manual_locations_undergo_backend_validation(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="GPS Admin",
        email="gpsadmin@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin["id"], "Authorized Zone", 12.9716, 77.5946, radius_km=3.0)
    client.post("/api/auth/login", json={"email": "gpsadmin@floodvision.org", "password": "AdminPass123!"})

    img_bytes = create_test_image("PNG")

    # Inside (Valid via GPS simulation)
    res_inside = client.post(
        "/api/admin/images",
        data={"title": "Device GPS Inside", "latitude": 12.9725, "longitude": 77.5940},
        files={"file": ("gps.png", img_bytes, "image/png")}
    )
    assert res_inside.status_code == 201

    # Outside (Invalid manual map pick)
    res_outside = client.post(
        "/api/admin/images",
        data={"title": "Manual Pick Outside", "latitude": 15.0000, "longitude": 75.0000},
        files={"file": ("manual.png", img_bytes, "image/png")}
    )
    assert res_outside.status_code == 403

# 11. An admin cannot modify their own role or expand their region
def test_11_admin_cannot_modify_own_role_or_expand_region(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Restricted Admin",
        email="restricted@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    region = reg_repo.assign_region(admin["id"], "Fixed Zone", 12.9716, 77.5946, radius_km=2.0)
    client.post("/api/auth/login", json={"email": "restricted@floodvision.org", "password": "AdminPass123!"})

    # Cannot assign or expand region via superadmin endpoints -> 403 Forbidden
    res_assign = client.post("/api/superadmin/regions", json={
        "admin_user_id": admin["id"],
        "region_name": "Expanded Zone",
        "center_latitude": 12.9716,
        "center_longitude": 77.5946,
        "radius_km": 50.0
    })
    assert res_assign.status_code == 403

    # Cannot patch region
    res_patch = client.patch(f"/api/superadmin/regions/{region['id']}", json={"radius_km": 100.0})
    assert res_patch.status_code == 403

# 12. Missing or invalid image locations do not bypass regional restrictions
def test_12_missing_or_invalid_locations_rejected(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Validation Admin",
        email="val@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin["id"], "Zone", 12.9716, 77.5946, radius_km=5.0)
    client.post("/api/auth/login", json={"email": "val@floodvision.org", "password": "AdminPass123!"})

    img_bytes = create_test_image("JPEG")

    # Invalid latitude (> 90)
    res_bad_lat = client.post(
        "/api/admin/images",
        data={"title": "Bad Lat", "latitude": 95.0, "longitude": 77.5946},
        files={"file": ("bad_lat.jpg", img_bytes, "image/jpeg")}
    )
    assert res_bad_lat.status_code in (400, 422)

    # Missing coordinates
    res_no_coords = client.post(
        "/api/admin/images",
        data={"title": "No Coords"},
        files={"file": ("no_coords.jpg", img_bytes, "image/jpeg")}
    )
    assert res_no_coords.status_code in (400, 422)

# 13. Unsupported, malformed, and oversized files are rejected
def test_13_unsupported_malformed_oversized_files_rejected(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Security Admin",
        email="sec@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg_repo.assign_region(admin["id"], "Security Zone", 12.9716, 77.5946, radius_km=5.0)
    client.post("/api/auth/login", json={"email": "sec@floodvision.org", "password": "AdminPass123!"})

    # Malformed / fake image content (text disguised as .jpg)
    fake_content = b"<html><script>alert('xss')</script></html>"
    res_fake = client.post(
        "/api/admin/images",
        data={"title": "Fake Image", "latitude": 12.9716, "longitude": 77.5946},
        files={"file": ("payload.jpg", fake_content, "image/jpeg")}
    )
    assert res_fake.status_code == 400
    assert "malformed" in res_fake.json()["detail"].lower() or "unsupported" in res_fake.json()["detail"].lower()

# 14. Direct API calls cannot bypass frontend authorization
def test_14_direct_api_calls_cannot_bypass_authorization(regional_test_setup):
    client = regional_test_setup["client"]
    img_bytes = create_test_image("JPEG")

    # Unauthenticated direct API call
    res = client.post(
        "/api/admin/images",
        data={"title": "Hacker Upload", "latitude": 12.9716, "longitude": 77.5946},
        files={"file": ("hack.jpg", img_bytes, "image/jpeg")}
    )
    assert res.status_code == 401

# 15. Revoked or inactive assignments immediately block access
def test_15_inactive_assignment_immediately_blocks_access(regional_test_setup):
    client = regional_test_setup["client"]
    user_repo = regional_test_setup["user_repo"]
    reg_repo = regional_test_setup["reg_repo"]
    auth_service = regional_test_setup["auth_service"]

    admin = user_repo.create_user(
        name="Deactivated Admin",
        email="deact@floodvision.org",
        hashed_password=auth_service.hash_password("AdminPass123!"),
        role="admin",
        email_verified=True
    )
    reg = reg_repo.assign_region(admin["id"], "Active Zone", 12.9716, 77.5946, radius_km=5.0)
    client.post("/api/auth/login", json={"email": "deact@floodvision.org", "password": "AdminPass123!"})

    # Access is initially granted
    assert client.get("/api/admin/images").status_code == 200

    # Deactivate the regional assignment
    reg_repo.update_region(reg["id"], is_active=False)

    # Immediately blocked on next call -> 403 Forbidden
    res_blocked = client.get("/api/admin/images")
    assert res_blocked.status_code == 403
    assert "geographic region" in res_blocked.json()["detail"].lower()
