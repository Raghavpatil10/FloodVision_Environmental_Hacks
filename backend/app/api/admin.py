from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Dict, Any, List, Optional
import json
from ..api.deps import get_current_admin_user
from ..repositories.user_repo import user_repo
from ..repositories.incident_repo import incident_repo
from ..repositories.audit_log_repo import audit_log_repo
from ..repositories.region_repo import region_repo, haversine_distance_km

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/overview")
def get_admin_overview(admin_user: Dict[str, Any] = Depends(get_current_admin_user)):
    user_counts = user_repo.count_users()
    incidents = incident_repo.list_recent_incidents(max_age_hours=24)
    critical_incidents = [
        i for i in incidents 
        if (float(i.get("estimated_depth_cm") or 0) >= 30.0 or i.get("risk_level") in ("critical", "high"))
    ]

    active_region = region_repo.get_active_region_by_admin_id(admin_user["id"])

    return {
        "admin_user": {
            "id": admin_user["id"],
            "name": admin_user["name"],
            "email": admin_user["email"],
            "role": admin_user["role"],
            "region": active_region
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

@router.get("/incidents")
def get_regional_admin_incidents(
    status_filter: Optional[str] = Query(None, description="'active', 'resolved', or null for all"),
    max_age_hours: int = Query(72, ge=1, le=720),
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Fetches flood incidents specifically within the administrator's assigned geographic sector.
    Enforces regional jurisdiction boundary (default radius e.g. 5.0 km).
    Superadmins without a specific region can view all cross-district incidents.
    """
    all_incidents = incident_repo.list_recent_incidents(
        max_age_hours=max_age_hours,
        status=status_filter,
        include_resolved=(status_filter is None or status_filter == "all")
    )
    if status_filter and status_filter != "all":
        all_incidents = [i for i in all_incidents if i.get("status") == status_filter]

    active_region = region_repo.get_active_region_by_admin_id(admin_user["id"])
    
    # 1. Admin with assigned regional post: filter by assigned radius
    if active_region:
        center_lat = active_region["center_latitude"]
        center_lon = active_region["center_longitude"]
        radius_km = active_region["radius_km"]

        regional_incidents = []
        for inc in all_incidents:
            inc_lat = inc.get("latitude")
            inc_lon = inc.get("longitude")
            if inc_lat is not None and inc_lon is not None:
                dist = haversine_distance_km(float(inc_lat), float(inc_lon), center_lat, center_lon)
                if dist <= radius_km:
                    inc_copy = dict(inc)
                    inc_copy["distance_from_post_km"] = round(dist, 2)
                    inc_copy["in_assigned_perimeter"] = True
                    regional_incidents.append(inc_copy)

        regional_incidents.sort(key=lambda x: (x.get("status") != "active", -float(x.get("estimated_depth_cm") or 0)))

        return {
            "has_assigned_region": True,
            "region": active_region,
            "radius_km": radius_km,
            "total_in_radius": len(regional_incidents),
            "active_in_radius": len([i for i in regional_incidents if i.get("status") == "active"]),
            "resolved_in_radius": len([i for i in regional_incidents if i.get("status") == "resolved"]),
            "incidents": regional_incidents
        }

    # 2. Superadmin or unassigned admin: return all incidents with distance from default municipality
    default_lat, default_lon = 19.0760, 72.8777
    annotated_incidents = []
    for inc in all_incidents:
        inc_copy = dict(inc)
        inc_lat = inc.get("latitude")
        inc_lon = inc.get("longitude")
        if inc_lat is not None and inc_lon is not None:
            dist = haversine_distance_km(float(inc_lat), float(inc_lon), default_lat, default_lon)
            inc_copy["distance_from_post_km"] = round(dist, 2)
        else:
            inc_copy["distance_from_post_km"] = 0.0
        inc_copy["in_assigned_perimeter"] = True
        annotated_incidents.append(inc_copy)

    annotated_incidents.sort(key=lambda x: (x.get("status") != "active", -float(x.get("estimated_depth_cm") or 0)))

    return {
        "has_assigned_region": False,
        "is_superadmin": admin_user.get("role") == "superadmin",
        "radius_km": 15.0, # Broad municipal default
        "region": {
            "region_name": "Full Municipal Jurisdiction (All Sectors)" if admin_user.get("role") == "superadmin" else "Unassigned Sector",
            "center_latitude": default_lat,
            "center_longitude": default_lon,
            "radius_km": 15.0
        },
        "total_in_radius": len(annotated_incidents),
        "active_in_radius": len([i for i in annotated_incidents if i.get("status") == "active"]),
        "resolved_in_radius": len([i for i in annotated_incidents if i.get("status") == "resolved"]),
        "incidents": annotated_incidents
    }

@router.patch("/incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: str,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    """
    Marks a waterlogged road issue as 'resolved'.
    Once marked as resolved, the hazard is automatically purged from the public Live Map
    and Route Planner, clearing the street for traffic!
    """
    incident = incident_repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    # Check regional jurisdiction if admin has assigned region
    active_region = region_repo.get_active_region_by_admin_id(admin_user["id"])
    if active_region and admin_user.get("role") != "superadmin":
        inc_lat = incident.get("latitude")
        inc_lon = incident.get("longitude")
        if inc_lat is not None and inc_lon is not None:
            dist = haversine_distance_km(float(inc_lat), float(inc_lon), active_region["center_latitude"], active_region["center_longitude"])
            if dist > active_region["radius_km"] * 1.25: # small tolerance buffer
                raise HTTPException(
                    status_code=403,
                    detail=f"Incident is outside your authorized jurisdiction ({round(dist, 1)}km away, radius is {active_region['radius_km']}km)."
                )

    success = incident_repo.update_status(incident_id, "resolved")
    if not success:
        raise HTTPException(status_code=400, detail="Could not update incident status.")

    audit_log_repo.record_log(
        actor_id=admin_user["id"],
        action="incident_resolved",
        target_user_id=None,
        details=json.dumps({
            "incident_id": incident_id,
            "resolved_by": admin_user["name"],
            "depth_cm": incident.get("estimated_depth_cm")
        })
    )

    updated = incident_repo.get_incident(incident_id)
    return {
        "message": f"Incident {incident_id[:8]} marked as RESOLVED. Cleared from Live Map and Route Planner.",
        "incident": updated
    }

@router.patch("/incidents/{incident_id}/reopen")
def reopen_incident(
    incident_id: str,
    admin_user: Dict[str, Any] = Depends(get_current_admin_user)
):
    incident = incident_repo.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    success = incident_repo.update_status(incident_id, "active")
    if not success:
        raise HTTPException(status_code=400, detail="Could not reopen incident.")

    return {
        "message": "Incident reopened as active hazard.",
        "incident": incident_repo.get_incident(incident_id)
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
