from backend.app.services.risk_service import calculate_risk

def test_calculate_risk_unknown():
    res = calculate_risk(None)
    assert res["risk_level"] == "unknown"
    assert res["safety_score"] is None

def test_calculate_risk_negative():
    res = calculate_risk(-5.0)
    assert res["risk_level"] == "unknown"
    assert res["safety_score"] is None

def test_calculate_risk_low():
    res = calculate_risk(2.5)
    assert res["risk_level"] == "low"
    assert 90 <= res["safety_score"] <= 100

def test_calculate_risk_moderate():
    res = calculate_risk(10.0)
    assert res["risk_level"] == "moderate"
    assert 60 <= res["safety_score"] <= 89

def test_calculate_risk_high():
    res = calculate_risk(20.0)
    assert res["risk_level"] == "high"
    assert 25 <= res["safety_score"] <= 59

def test_calculate_risk_critical():
    res = calculate_risk(40.0)
    assert res["risk_level"] == "critical"
    assert 0 <= res["safety_score"] <= 24

def test_monotonic_scoring():
    # greater depth never produces a higher safety score
    prev_score = 100
    for depth in range(0, 50):
        res = calculate_risk(float(depth))
        assert res["safety_score"] <= prev_score
        prev_score = res["safety_score"]

def test_low_confidence():
    res = calculate_risk(10.0, confidence=0.3)
    assert res["risk_level"] == "unknown"
    assert res["reason"] == "Low confidence in depth estimation."
