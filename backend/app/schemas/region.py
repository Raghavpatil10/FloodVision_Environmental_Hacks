from typing import Optional
from pydantic import BaseModel, Field

class AssignRegionRequest(BaseModel):
    admin_user_id: str = Field(..., description="Target admin user ID")
    region_name: str = Field(..., min_length=2, max_length=200, description="Region or sector name")
    center_latitude: float = Field(..., ge=-90.0, le=90.0, description="Center latitude (-90 to 90)")
    center_longitude: float = Field(..., ge=-180.0, le=180.0, description="Center longitude (-180 to 180)")
    radius_km: float = Field(default=5.0, gt=0.0, le=1000.0, description="Radius in kilometers")
    is_active: bool = Field(default=True, description="Active status")

class UpdateRegionRequest(BaseModel):
    region_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    center_latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    center_longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    radius_km: Optional[float] = Field(default=None, gt=0.0, le=1000.0)
    is_active: Optional[bool] = None

class RegionResponse(BaseModel):
    id: str
    admin_user_id: str
    region_name: str
    center_latitude: float
    center_longitude: float
    radius_km: float
    is_active: bool
    created_at: str
    updated_at: str
    admin_name: Optional[str] = None
    admin_email: Optional[str] = None
