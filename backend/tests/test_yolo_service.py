import io
from PIL import Image
from backend.app.services.yolo_service import yolo_detector, STANDARD_TIRE_DIAMETER_CM
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def create_sample_image():
    img = Image.new("RGB", (640, 480), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_yolo_depth_detector_basic():
    img_bytes = create_sample_image()
    res = yolo_detector.detect_and_estimate(img_bytes)
    
    assert "estimated_depth_cm" in res
    assert "status_flag" in res
    assert res["status_flag"] in ["Safe", "Caution", "Danger"]
    assert "risk_level" in res
    assert "safety_score" in res
    assert "annotated_image_bytes" in res
    assert len(res["annotated_image_bytes"]) > 0

def test_depth_formula_submersion_calculation():
    # If visible tire ratio is 40% (0.40), submerged ratio is 60% (0.60)
    # Expected depth = 65.0 * 0.60 = 39.0 cm
    visible_ratio = 0.40
    submerged_ratio = 1.0 - visible_ratio
    expected_depth = round(STANDARD_TIRE_DIAMETER_CM * submerged_ratio, 1)
    assert expected_depth == 39.0

def test_api_analyze_endpoint():
    img_bytes = create_sample_image()
    response = client.post(
        "/api/analyze",
        files={"file": ("test.jpg", img_bytes, "image/jpeg")},
        data={"latitude": "19.0760", "longitude": "72.8777"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "estimated_depth_cm" in data
    assert "status_flag" in data
    assert data["status_flag"] in ["Safe", "Caution", "Danger"]
    assert "annotated_image_url" in data
    assert "incident_id" in data
