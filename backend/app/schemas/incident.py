from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class IncidentBase(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    estimated_depth_cm: Optional[float] = None
    safety_score: Optional[int] = None
    risk_level: Optional[str] = None
    confidence: Optional[str] = None
    depth_status: Optional[str] = None
    image_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    road_name: Optional[str] = None
    road_segment_id: Optional[str] = None
    status: str = "active"
    source: str = "citizen"

class IncidentCreate(IncidentBase):
    pass

class Incident(IncidentBase):
    incident_id: str
    reported_at: datetime
    last_updated_at: datetime

    class Config:
        from_attributes = True

class IncidentStatusUpdate(BaseModel):
    status: str
