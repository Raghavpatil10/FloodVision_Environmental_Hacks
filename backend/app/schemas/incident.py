from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class IncidentBase(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    estimated_depth_cm: Optional[float] = None
    safety_score: Optional[int] = None
    risk_level: Optional[str] = None
    status_flag: Optional[str] = None
    confidence: Optional[str] = None
    depth_status: Optional[str] = None
    image_url: Optional[str] = None
    raw_image_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    road_name: Optional[str] = None
    road_segment_id: Optional[str] = None
    status: str = "active"
    source: str = "citizen"

    model_config = ConfigDict(from_attributes=True, extra="ignore")

class IncidentCreate(IncidentBase):
    pass

class Incident(IncidentBase):
    incident_id: str
    reported_at: datetime
    last_updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class IncidentStatusUpdate(BaseModel):
    status: str
