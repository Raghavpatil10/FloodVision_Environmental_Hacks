from typing import Dict, Any, Optional

def calculate_risk(depth_cm: Optional[float], confidence: Optional[float] = None) -> Dict[str, Any]:
    if depth_cm is None or depth_cm < 0:
        return {
            "depth_cm": None,
            "safety_score": None,
            "risk_level": "unknown",
            "reason": "Depth is unavailable or invalid",
            "confidence": confidence
        }

    # Low detected risk: 0–5 cm, score 90–100.
    if depth_cm <= 5.0:
        # 0 -> 100, 5 -> 90. Decrease by 2 for each cm.
        score = 100 - int((depth_cm / 5.0) * 10)
        risk_level = "low"
        reason = "Water level is manageable for most vehicles."
    # Moderate risk: above 5 cm through 15 cm, score 60–89.
    elif depth_cm <= 15.0:
        # 5 -> 89, 15 -> 60. Range = 29. 
        # depth beyond 5: depth_cm - 5 (0 to 10)
        score = 89 - int(((depth_cm - 5.0) / 10.0) * 29)
        risk_level = "moderate"
        reason = "Proceed with caution. May affect low-clearance vehicles."
    # High risk: above 15 cm through 30 cm, score 25–59.
    elif depth_cm <= 30.0:
        # 15 -> 59, 30 -> 25. Range = 34.
        score = 59 - int(((depth_cm - 15.0) / 15.0) * 34)
        risk_level = "high"
        reason = "Dangerous for most passenger vehicles. Avoid if possible."
    # Critical risk: above 30 cm, score 0–24.
    else:
        # 30 -> 24. Decreases down to 0 at maybe 60 cm.
        score = max(0, 24 - int(((depth_cm - 30.0) / 30.0) * 24))
        risk_level = "critical"
        reason = "Severe flooding. Engine stall or sweeping hazard. Do not enter."

    if confidence is not None and confidence < 0.5:
        return {
            "depth_cm": depth_cm,
            "safety_score": score,
            "risk_level": "unknown",
            "reason": "Low confidence in depth estimation.",
            "confidence": confidence
        }

    return {
        "depth_cm": round(depth_cm, 1),
        "safety_score": score,
        "risk_level": risk_level,
        "reason": reason,
        "confidence": confidence
    }
