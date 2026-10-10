from typing import Optional
from pydantic import BaseModel, Field

class CreateAdminRequest(BaseModel):
    reason: str = Field(
        ..., 
        min_length=10, 
        max_length=1000, 
        description="Justification for requesting emergency administrator access"
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
    region_name: Optional[str] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    radius_km: Optional[float] = None

class AdminRequestResponse(BaseModel):
    id: str
    user_id: str
    reason: str
    status: str
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_note: Optional[str] = None
    created_at: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    reviewer_name: Optional[str] = None
