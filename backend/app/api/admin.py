from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from ..api.deps import get_current_admin_user
from ..repositories.user_repo import user_repo
from ..repositories.incident_repo import incident_repo

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
