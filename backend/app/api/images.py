from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Dict, Any, List, Optional
import io
from PIL import Image as PILImage
from datetime import datetime, timezone
import json
import uuid

from ..api.deps import require_regional_admin, get_current_user
from ..repositories.region_repo import region_repo
from ..repositories.image_repo import image_repo
from ..repositories.audit_log_repo import audit_log_repo
from ..services.s3_service import s3_service
from ..services.analysis_service import analysis_service
from ..schemas.image import FloodImageResponse, UpdateFloodImageRequest

router = APIRouter(prefix="/admin/images", tags=["regional-images"])

MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def _validate_image_file(content: bytes) -> str:
    """
    Validates the actual file content, supported format, and dimensions.
    Returns the normalized extension ('jpg', 'png', 'webp').
    """
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    if len(content) > MAX_IMAGE_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the maximum permitted limit of 10 MB."
        )

    try:
        # Re-open stream since verify() consumes it
        with PILImage.open(io.BytesIO(content)) as img:
            img.verify()
            fmt = (img.format or "").upper()
            if fmt not in ("JPEG", "JPG", "PNG", "WEBP"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported image format: '{fmt}'. Only JPEG, PNG, and WebP images are allowed."
                )

        # Inspect dimensions
        with PILImage.open(io.BytesIO(content)) as img:
            w, h = img.size
            if w <= 0 or h <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid image dimensions."
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed or corrupted image content. Upload was rejected."
        )

    ext_map = {"JPEG": "jpg", "JPG": "jpg", "PNG": "png", "WEBP": "webp"}
    return ext_map.get(fmt, "jpg")

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_regional_image(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    severity: Optional[str] = Form("moderate"),
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Uploads a flood image to the administrator's authorized geographic region.
    Strictly verifies:
    1. Authenticated administrator with active regional assignment
    2. Real image byte validation (JPEG, PNG, WebP) and dimensions
    3. Selected GPS coordinates within assigned radius (Haversine formula)
    4. S3 private storage & YOLOv8 computer vision classification
    5. Audit log recording
    """
    # 1. Coordinate range validation
    if not (-90.0 <= latitude <= 90.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid latitude coordinate: {latitude}. Must be between -90 and 90."
        )
    if not (-180.0 <= longitude <= 180.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid longitude coordinate: {longitude}. Must be between -180 and 180."
        )

    # 2. Strict Regional Perimeter Validation
    assigned_region = current_admin["region"]
    is_inside = region_repo.is_point_in_region(latitude, longitude, assigned_region)
    if not is_inside:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upload denied: the selected image location is outside your assigned region. Please choose a location within your authorized area."
        )

    # 3. Read and validate raw image bytes
    content = await file.read()
    ext = _validate_image_file(content)
    content_type = file.content_type or f"image/{ext}"

    # 4. S3 Storage
    s3_key = s3_service.upload_raw_object(
        file_bytes=content,
        filename_prefix=f"regions/{assigned_region['id']}",
        content_type=content_type,
        extension=ext
    )

    # 5. Run YOLOv8 Computer Vision Inference
    yolo_data = None
    estimated_depth = None
    detection_status = "completed"
    try:
        cv_result = analysis_service.analyze_image(content)
        estimated_depth = cv_result.get("estimated_depth_cm")
        yolo_data = {
            "status_flag": cv_result.get("status_flag"),
            "safety_score": cv_result.get("safety_score"),
            "risk_level": cv_result.get("risk_level"),
            "confidence": cv_result.get("confidence"),
            "submerged_ratio": cv_result.get("submerged_ratio"),
            "reason": cv_result.get("reason")
        }
    except Exception as e:
        detection_status = "error"
        yolo_data = {"error": str(e)}

    # 6. Save image metadata in repository
    saved_img = image_repo.save_image(
        uploader_id=current_admin["id"],
        region_id=assigned_region["id"],
        title=title.strip(),
        description=description.strip() if description else None,
        s3_object_key=s3_key,
        content_type=content_type,
        file_size=len(content),
        latitude=latitude,
        longitude=longitude,
        location_validation_status="verified",
        detection_status=detection_status,
        yolo_results=yolo_data,
        estimated_depth_cm=estimated_depth
    )

    # 7. Audit log
    audit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    details = json.dumps({
        "image_id": saved_img["id"],
        "region_id": assigned_region["id"],
        "region_name": assigned_region["region_name"],
        "lat": latitude,
        "lon": longitude,
        "file_size": len(content)
    })
    audit_log_repo.record_log(
        actor_id=current_admin["id"],
        action="regional_image_uploaded",
        target_user_id=current_admin["id"],
        details=details
    )

    # Attach short-lived view URL
    saved_img["view_url"] = s3_service.generate_presigned_url(s3_key)
    return {
        "message": "Image successfully uploaded and verified within assigned region.",
        "image": saved_img
    }

@router.get("")
def list_regional_images(
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Lists images located strictly within the authenticated administrator's active region.
    Applies mathematical server-side spatial filtering.
    """
    region = current_admin["region"]
    images = image_repo.list_images_in_region(
        center_lat=region["center_latitude"],
        center_lon=region["center_longitude"],
        radius_km=region["radius_km"],
        search=search,
        status_filter=status,
        limit=limit
    )

    # Attach authorized viewing URLs
    for img in images:
        img["view_url"] = s3_service.generate_presigned_url(img["s3_object_key"])

    return {
        "region": region,
        "total": len(images),
        "images": images
    }

@router.get("/{image_id}")
def get_regional_image_details(
    image_id: str,
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Retrieves full metadata for an image, verifying it is located within
    the admin's authorized region (IDOR prevention).
    """
    img = image_repo.get_image_by_id(image_id)
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flood image '{image_id}' not found."
        )

    # Spatial IDOR Guard
    region = current_admin["region"]
    if not region_repo.is_point_in_region(img["latitude"], img["longitude"], region):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Image is outside your authorized geographic region."
        )

    img["view_url"] = s3_service.generate_presigned_url(img["s3_object_key"])
    return img

@router.get("/{image_id}/view-url")
def get_image_view_url(
    image_id: str,
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Generates a secure, short-lived presigned URL for the private S3 object.
    Strictly checks that the image belongs within the admin's assigned region.
    """
    img = image_repo.get_image_by_id(image_id)
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flood image '{image_id}' not found."
        )

    region = current_admin["region"]
    if not region_repo.is_point_in_region(img["latitude"], img["longitude"], region):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Image is outside your authorized geographic region."
        )

    url = s3_service.generate_presigned_url(img["s3_object_key"], expiration=3600)
    return {
        "image_id": image_id,
        "view_url": url,
        "expires_in": 3600
    }

@router.patch("/{image_id}")
def update_regional_image(
    image_id: str,
    payload: UpdateFloodImageRequest,
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Updates image title or description, verifying regional authorization.
    """
    img = image_repo.get_image_by_id(image_id)
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flood image '{image_id}' not found."
        )

    region = current_admin["region"]
    if not region_repo.is_point_in_region(img["latitude"], img["longitude"], region):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Image is outside your authorized geographic region."
        )

    updated = image_repo.update_image(
        image_id=image_id,
        title=payload.title,
        description=payload.description
    )
    updated["view_url"] = s3_service.generate_presigned_url(updated["s3_object_key"])
    return {
        "message": "Image metadata updated successfully.",
        "image": updated
    }

@router.delete("/{image_id}")
def delete_regional_image(
    image_id: str,
    current_admin: Dict[str, Any] = Depends(require_regional_admin)
):
    """
    Deletes an image from the regional repository with strict boundary authorization.
    """
    img = image_repo.get_image_by_id(image_id)
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flood image '{image_id}' not found."
        )

    region = current_admin["region"]
    if not region_repo.is_point_in_region(img["latitude"], img["longitude"], region):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Image is outside your authorized geographic region."
        )

    success = image_repo.delete_image(image_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete image record.")

    audit_log_repo.record_log(
        actor_id=current_admin["id"],
        action="regional_image_deleted",
        target_user_id=current_admin["id"],
        details=json.dumps({"image_id": image_id, "title": img["title"]})
    )

    return {"message": "Image successfully removed from regional repository."}
