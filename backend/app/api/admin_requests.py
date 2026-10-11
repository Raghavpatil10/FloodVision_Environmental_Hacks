from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from ..schemas.admin_request import CreateAdminRequest, ReviewAdminRequest, AdminRequestResponse
from ..api.deps import get_current_user, require_verified_user, require_admin
from ..repositories.admin_request_repo import admin_request_repo

router = APIRouter(prefix="/admin-requests", tags=["admin-requests"])

@router.post("", status_code=status.HTTP_201_CREATED)
def submit_admin_request(
    payload: CreateAdminRequest,
    current_user: Dict[str, Any] = Depends(require_verified_user)
):
    """
    Submits an emergency administrative access request.
    Strictly enforces:
    - User must be authenticated and email-verified
    - User cannot already be an administrator (HTTP 400)
    - User cannot submit duplicate pending applications (HTTP 409)
    """
    if current_user.get("role") == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already possesses Administrator privileges."
        )

    try:
        req = admin_request_repo.create_request(
            user_id=current_user["id"],
            reason=payload.reason
        )
        return {
            "message": "Admin access request submitted successfully. It is now pending municipal review.",
            "request": req
        }
    except ValueError as e:
        # Handles duplicate pending applications or invalid states
        err_msg = str(e)
        if "pending" in err_msg.lower() or "already exists" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/me")
def get_my_admin_requests(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves the authenticated user's own application history.
    Users cannot view other citizens' applications.
    """
    requests = admin_request_repo.get_user_requests(current_user["id"])
    return {
        "user_id": current_user["id"],
        "requests": requests
    }

@router.get("")
def list_admin_requests(
    status: Optional[str] = None,
    current_admin: Dict[str, Any] = Depends(require_admin)
):
    """
    Administrator-only: Lists all submitted applications with applicant metadata.
    Supports optional status filtering (e.g. ?status=pending).
    """
    requests = admin_request_repo.get_all_requests(status_filter=status)
    return {
        "total": len(requests),
        "requests": requests
    }

@router.post("/{request_id}/review")
def review_admin_request(
    request_id: str,
    payload: ReviewAdminRequest,
    current_admin: Dict[str, Any] = Depends(require_admin)
):
    """
    Administrator-only: Atomically reviews and approves or rejects an access request.
    Strictly enforces:
    - Reviewer must be an authenticated administrator
    - Reviewer CANNOT approve their own request (HTTP 403)
    - Application must be in 'pending' status (HTTP 409 if already reviewed)
    - Concurrent requests cannot process the same application twice (HTTP 409)
    - Atomic database transaction updating role, request status, and audit log
    """
    try:
        updated_request = admin_request_repo.review_request(
            request_id=request_id,
            reviewer_id=current_admin["id"],
            action=payload.action,
            note=payload.note
        )
        return {
            "message": f"Application successfully marked as '{updated_request['status']}'.",
            "request": updated_request
        }
    except PermissionError as e:
        # Self-approval guard or unverified applicant
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValueError as e:
        err_msg = str(e)
        if "already been reviewed" in err_msg.lower() or "concurrency" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )
