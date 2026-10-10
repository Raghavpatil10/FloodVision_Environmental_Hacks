from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
import json

from ..api.deps import require_superadmin
from ..repositories.region_repo import region_repo
from ..repositories.image_repo import image_repo
from ..repositories.user_repo import user_repo
from ..repositories.audit_log_repo import audit_log_repo
from ..schemas.region import AssignRegionRequest, UpdateRegionRequest, RegionResponse
from ..services.s3_service import s3_service

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

@router.get("/regions")
def list_all_regions(
    active_only: bool = False,
    current_superadmin: Dict[str, Any] = Depends(require_superadmin)
):
    """
    Superadmin-only: Lists all defined geographic regions across the platform.
    """
    regions = region_repo.list_all_regions(active_only=active_only)
    return {
        "total": len(regions),
        "regions": regions
    }

@router.post("/regions", status_code=status.HTTP_201_CREATED)
def assign_admin_region(
    payload: AssignRegionRequest,
    current_superadmin: Dict[str, Any] = Depends(require_superadmin)
):
    """
    Superadmin-only: Assigns or reassigns an authorized geographic perimeter to an administrator.
    """
    # Verify target admin user exists
    target = user_repo.get_by_id(payload.admin_user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target user '{payload.admin_user_id}' does not exist."
        )

    if target["role"] not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target user has role '{target['role']}', which cannot receive regional admin assignments."
        )

    try:
        new_region = region_repo.assign_region(
            admin_user_id=payload.admin_user_id,
            region_name=payload.region_name,
            center_latitude=payload.center_latitude,
            center_longitude=payload.center_longitude,
            radius_km=payload.radius_km,
            is_active=payload.is_active
        )

        audit_log_repo.record_log(
            actor_id=current_superadmin["id"],
            action="admin_region_assigned",
            target_user_id=payload.admin_user_id,
            details=json.dumps({
                "region_id": new_region["id"],
                "region_name": payload.region_name,
                "radius_km": payload.radius_km,
                "center_lat": payload.center_latitude,
                "center_lon": payload.center_longitude
            })
        )

        return {
            "message": "Geographic region assigned successfully.",
            "region": new_region
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/regions/{region_id}")
def update_region(
    region_id: str,
    payload: UpdateRegionRequest,
    current_superadmin: Dict[str, Any] = Depends(require_superadmin)
):
    """
    Superadmin-only: Updates a region's name, coordinates, radius, or active status.
    """
    existing = region_repo.get_region_by_id(region_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region '{region_id}' not found."
        )

    try:
        updated = region_repo.update_region(
            region_id=region_id,
            region_name=payload.region_name,
            center_latitude=payload.center_latitude,
            center_longitude=payload.center_longitude,
            radius_km=payload.radius_km,
            is_active=payload.is_active
        )

        audit_log_repo.record_log(
            actor_id=current_superadmin["id"],
            action="admin_region_updated",
            target_user_id=existing["admin_user_id"],
            details=json.dumps({
                "region_id": region_id,
                "radius_km": payload.radius_km,
                "is_active": payload.is_active
            })
        )

        return {
            "message": "Region updated successfully.",
            "region": updated
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/admins")
def list_admins_with_regions(current_superadmin: Dict[str, Any] = Depends(require_superadmin)):
    """
    Superadmin-only: Lists all administrators and their active regional assignments.
    """
    all_users = user_repo.list_users(limit=200)
    admins = [u for u in all_users if u["role"] in ("admin", "superadmin")]
    for adm in admins:
        adm["region"] = region_repo.get_active_region_by_admin_id(adm["id"])
    return {
        "total": len(admins),
        "admins": admins
    }

@router.get("/images")
def list_all_images_across_regions(
    limit: int = 100,
    current_superadmin: Dict[str, Any] = Depends(require_superadmin)
):
    """
    Superadmin-only: Platform-wide overview of all submitted flood images.
    """
    images = image_repo.list_all_images(limit=limit)
    for img in images:
        img["view_url"] = s3_service.generate_presigned_url(img["s3_object_key"])
    return {
        "total": len(images),
        "images": images
    }

@router.get("/stats")
def get_platform_stats(current_superadmin: Dict[str, Any] = Depends(require_superadmin)):
    """
    Superadmin-only: High-level platform telemetry.
    """
    user_counts = user_repo.count_users()
    regions = region_repo.list_all_regions()
    all_imgs = image_repo.list_all_images(limit=500)

    return {
        "users": user_counts,
        "total_regions": len(regions),
        "active_regions": len([r for r in regions if r["is_active"]]),
        "total_images": len(all_imgs),
        "server_time": str(user_counts)
    }
