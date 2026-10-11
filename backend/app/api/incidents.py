from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..repositories.incident_repo import incident_repo
from ..schemas.incident import Incident, IncidentStatusUpdate

router = APIRouter()

@router.get("/incidents", response_model=List[Incident])
def get_incidents(
    max_age_hours: int = Query(24, ge=1, le=168),
    risk_level: Optional[str] = Query(None),
    include_resolved: bool = Query(False)
):
    incidents_data = incident_repo.list_recent_incidents(
        max_age_hours=max_age_hours,
        status=None if include_resolved else "active",
        include_resolved=include_resolved
    )
    
    if risk_level:
        incidents_data = [i for i in incidents_data if i.get("risk_level") == risk_level]
        
    return incidents_data

@router.get("/incidents/{incident_id}", response_model=Incident)
def get_incident(incident_id: str):
    incident = incident_repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/incidents/{incident_id}/status")
def update_status(incident_id: str, status_update: IncidentStatusUpdate):
    success = incident_repo.update_status(incident_id, status_update.status)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update status")
    updated = incident_repo.get_incident(incident_id)
    return {
        "status": "success",
        "incident_id": incident_id,
        "new_status": status_update.status,
        "incident": updated
    }
