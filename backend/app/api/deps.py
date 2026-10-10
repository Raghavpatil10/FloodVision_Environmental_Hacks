from fastapi import Request, Depends, HTTPException, status
from typing import Optional, Dict, Any
from ..config import settings
from ..services.auth_service import auth_service
from ..repositories.user_repo import user_repo

def get_token_from_request(request: Request) -> Optional[str]:
    # 1. Prefer Secure HTTP-only Cookie
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    # 2. Fallback to Authorization Header (Bearer token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return None

def get_current_user(request: Request) -> Dict[str, Any]:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this resource."
        )

    payload = auth_service.verify_session_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please sign in again."
        )

    user = user_repo.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this session no longer exists."
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended or deactivated. Contact emergency administrators."
        )

    return user

def require_verified_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not current_user.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify your email address to perform this action."
        )
    return current_user

def require_superadmin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Superadmin privileges required to manage administrator approvals and geographic assignments."
        )
    return current_user

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This action requires Administrator privileges."
        )
    return current_user

# Alias for backwards compatibility
get_current_admin_user = require_admin

def require_regional_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Validates that the user is an authorized administrator and has an active geographic region assignment.
    Superadmins can also manage regional images if they have an active region assigned.
    """
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This action requires an approved Administrator account."
        )

    from ..repositories.region_repo import region_repo
    region = region_repo.get_active_region_by_admin_id(current_user["id"])
    if not region:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrator does not have an active geographic region assigned. Please contact the platform superadmin."
        )

    user_with_region = dict(current_user)
    user_with_region["region"] = region
    return user_with_region

def get_optional_current_user(request: Request) -> Optional[Dict[str, Any]]:
    token = get_token_from_request(request)
    if not token:
        return None
    payload = auth_service.verify_session_token(token)
    if not payload or "sub" not in payload:
        return None
    return user_repo.get_by_id(payload["sub"])
