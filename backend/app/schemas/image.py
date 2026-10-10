from typing import Optional, Any
from pydantic import BaseModel, Field

class CreateFloodImageMetadata(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, description="Image title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Description of flood conditions")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Selected latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Selected longitude coordinate")
    severity: Optional[str] = Field(default="moderate", description="Estimated flood severity or category")

class UpdateFloodImageRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)

class FloodImageResponse(BaseModel):
    id: str
    uploader_id: str
    region_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    s3_object_key: str
    content_type: str
    file_size: int
    latitude: float
    longitude: float
    location_validation_status: str
    detection_status: str
    yolo_results: Optional[Any] = None
    estimated_depth_cm: Optional[float] = None
    created_at: str
    updated_at: str
    uploader_name: Optional[str] = None
    uploader_email: Optional[str] = None
    distance_to_center_km: Optional[float] = None
    view_url: Optional[str] = None
