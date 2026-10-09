from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from ..services.analysis_service import analysis_service
from ..services.risk_service import calculate_risk
from ..services.notification_service import notification_service
from ..repositories.incident_repo import incident_repo

router = APIRouter()

@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    content = await file.read()
    
    # Analyze
    depth, confidence, annotated_url = analysis_service.analyze_image(content)
    
    # Calculate risk
    risk_info = calculate_risk(depth, confidence)
    
    response_data = {
        "estimated_depth_cm": risk_info["depth_cm"],
        "safety_score": risk_info["safety_score"],
        "risk_level": risk_info["risk_level"],
        "confidence": confidence,
        "annotated_image_url": annotated_url,
        "reason": risk_info["reason"]
    }
    
    if latitude is not None and longitude is not None:
        incident_data = {
            "latitude": latitude,
            "longitude": longitude,
            "estimated_depth_cm": depth,
            "safety_score": risk_info["safety_score"],
            "risk_level": risk_info["risk_level"],
            "confidence": str(confidence),
            "annotated_image_url": annotated_url
        }
        incident_id = incident_repo.save_incident(incident_data)
        response_data["incident_id"] = incident_id
        
        # Trigger notification if critical
        notification_service.trigger_alert_if_critical(incident_data)
        
    return response_data
