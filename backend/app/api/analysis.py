from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import boto3
from ..services.analysis_service import analysis_service
from ..services.notification_service import notification_service, send_emergency_sms
from ..repositories.incident_repo import incident_repo

router = APIRouter()

@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPEG or PNG image.")
        
    content = await file.read()
    
    # Run YOLO Analysis and S3 Image Upload
    result = analysis_service.analyze_image(content)
    depth = result["estimated_depth_cm"]
    
    # Determine location format for SMS alert
    if latitude is not None and longitude is not None:
        location_str = f"Lat {latitude:.4f}, Lon {longitude:.4f}"
    else:
        location_str = "Monitored Road Corridor (Camera Sensor)"
        
    # Trigger AWS SNS Emergency Alert ONLY IF calculated depth > 30cm
    sms_alert_sent = send_emergency_sms(depth=depth, location=location_str)
    
    response_data = {
        "estimated_depth_cm": depth,
        "status_flag": result["status_flag"],
        "safety_score": result["safety_score"],
        "risk_level": result["risk_level"],
        "confidence": result["confidence"],
        "submerged_ratio": result["submerged_ratio"],
        "annotated_image_url": result["annotated_image_url"],
        "raw_image_url": result["raw_image_url"],
        "reason": result["reason"],
        "sms_alert_sent": sms_alert_sent
    }
    
    if latitude is not None and longitude is not None:
        incident_data = {
            "latitude": latitude,
            "longitude": longitude,
            "estimated_depth_cm": depth,
            "status_flag": result["status_flag"],
            "safety_score": result["safety_score"],
            "risk_level": result["risk_level"],
            "confidence": str(result["confidence"]),
            "annotated_image_url": result["annotated_image_url"],
            "raw_image_url": result["raw_image_url"],
            "sms_alert_sent": sms_alert_sent,
            "status": "active"
        }
        incident_id = incident_repo.save_incident(incident_data)
        response_data["incident_id"] = incident_id
        
    return response_data
