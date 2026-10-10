from typing import Optional
from pydantic import BaseModel, Field

class CreateAdminRequest(BaseModel):
    reason: str = Field(
        ..., 
        min_length=10, 
        max_length=1000, 
        description="Justification for requesting emergency administrator access"
    )
    organization: Optional[str] = Field(
        default="", 
        max_length=200, 
        description="Organization or department name"
    )
    designation: Optional[str] = Field(
        default="", 
        max_length=100, 
        description="Official designation or job title"
    )
    official_email: Optional[str] = Field(
        default=None, 
        description="Official municipal or agency email address"
    )
    requested_region: Optional[str] = Field(
        default="", 
        max_length=200, 
        description="Requested region, city, locality, or geographic area"
    )
    supporting_evidence: Optional[str] = Field(
        default=None, 
        max_length=2000, 
        description="Supporting authorization evidence, credentials, or reference link"
    )

class ReviewAdminRequest(BaseModel):
    action: str = Field(
        ..., 
        pattern="^(approve|reject)$", 
        description="Review action: approve or reject"
    )
    note: Optional[str] = Field(
        default=None, 
        max_length=500, 
        description="Optional administrative review note"
    )
    region_name: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Assigned region or sector name"
    )
    center_latitude: Optional[float] = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        description="Assigned center latitude (-90 to 90)"
    )
    center_longitude: Optional[float] = Field(
        default=None,
        ge=-180.0,
        le=180.0,
        description="Assigned center longitude (-180 to 180)"
    )
    radius_km: Optional[float] = Field(
        default=5.0,
        gt=0.0,
        le=1000.0,
        description="Assigned circular radius in kilometers"
    )

class AdminRequestResponse(BaseModel):
    id: str
    user_id: str
    reason: str
    organization: Optional[str] = ""
    designation: Optional[str] = ""
    official_email: Optional[str] = None
    requested_region: Optional[str] = ""
    supporting_evidence: Optional[str] = None
    status: str
    reviewer_id: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_note: Optional[str] = None
    created_at: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    reviewer_name: Optional[str] = None
