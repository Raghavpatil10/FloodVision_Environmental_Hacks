from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from ..api.deps import get_current_admin_user
from ..repositories.user_repo import user_repo
from ..repositories.incident_repo import incident_repo
from ..repositories.audit_log_repo import audit_log_repo

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/overview")
def get_admin_overview(admin_user: Dict[str, Any] = Depends(get_current_admin_user)):
    user_counts = user_repo.count_users()
    incidents = incident_repo.list_recent_incidents(max_age_hours=24)
    critical_incidents = [
        i for i in incidents 
        if (float(i.get("estimated_depth_cm") or 0) >= 30.0 or i.get("risk_level") in ("critical", "high"))
    ]

    return {
        "admin_user": {
            "id": admin_user["id"],
            "name": admin_user["name"],
            "email": admin_user["email"],
            "role": admin_user["role"]
        },
        "stats": {
            "total_users": user_counts["total"],
            "registered_citizens": user_counts["users"],
            "admin_officers": user_counts["admins"],
            "active_incidents_24h": len(incidents),
            "critical_hazards": len(critical_incidents),
            "emergency_broadcast_system": "ONLINE (AWS SNS)"
        },
        "recent_incidents": incidents[:5]
    }

@router.get("/users")
def get_all_users(admin_user: Dict[str, Any] = Depends(get_current_admin_user)):
    return {
        "users": user_repo.list_users(limit=100)
    }

@router.get("/audit-logs")
def get_audit_logs(limit: int = 50, admin_user: Dict[str, Any] = Depends(get_current_admin_user)):
    return {
        "logs": audit_log_repo.list_logs(limit=limit)
    }

@router.get("/incidents")
def get_admin_incidents(
    status: str = "all",
    lat: float = None,
    lon: float = None,
    radius_km: float = None,
    max_age_hours: int = 72,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Fetches flood hazard incidents with optional geofenced radius filtering.
    Enables admin officers to focus on hazards strictly within their assigned operational sector.
    """
    incidents = incident_repo.list_incidents(
        status=status,
        max_age_hours=max_age_hours,
        lat=lat,
        lon=lon,
        radius_km=radius_km
    )
    return {
        "sector_center": {"lat": lat, "lon": lon} if lat is not None and lon is not None else None,
        "radius_km": radius_km,
        "status_filter": status,
        "total_count": len(incidents),
        "incidents": incidents
    }

@router.patch("/incidents/{incident_id}/status")
def update_admin_incident_status(
    incident_id: str,
    status_update: Dict[str, Any],
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Marks an incident as resolved or active.
    When marked resolved, it is automatically removed from the Live Map and Route avoidance.
    """
    new_status = status_update.get("status", "resolved")
    success = incident_repo.update_status(incident_id, new_status)
    if not success:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found or could not update status.")

    # Record action in security audit log
    audit_log_repo.create_log(
        action=f"incident_{new_status}",
        actor_id=admin_user["id"],
        target_user_id=None,
        details={
            "incident_id": incident_id,
            "new_status": new_status,
            "admin_name": admin_user["name"],
            "admin_email": admin_user["email"]
        }
    )

    return {
        "status": "success",
        "incident_id": incident_id,
        "new_status": new_status,
        "message": f"Hazard marked as {new_status}. It is now {'removed from live map and safe route detour calculation' if new_status == 'resolved' else 'reactivated on telemetry map'}."
    }
