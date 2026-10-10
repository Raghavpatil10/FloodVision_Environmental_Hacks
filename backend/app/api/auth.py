from fastapi import APIRouter, Response, Request, Depends, status, HTTPException
from typing import Dict, Any, Optional
from ..schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from ..services.auth_service import auth_service
from ..repositories.user_repo import user_repo
from ..api.deps import get_current_user, get_optional_current_user
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

def _set_auth_cookie(response: Response, token: str, max_age: int):
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        expires=max_age,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )

def _user_to_response(user: Dict[str, Any]) -> UserResponse:
    return UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        is_active=bool(user.get("is_active", True)),
        email_verified=bool(user.get("email_verified", False)),
        verified_at=user.get("verified_at"),
        created_at=user["created_at"],
        updated_at=user.get("updated_at") or user["created_at"],
        last_login=user.get("last_login")
    )

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response):
    user = auth_service.register_user(
        name=payload.name,
        email=payload.email,
        password=payload.password,
        confirm_password=payload.confirm_password
    )
    
    max_age = settings.SESSION_MAX_AGE_SECONDS
    token = auth_service.create_session_token(user_id=user["id"], role=user["role"])
    _set_auth_cookie(response, token, max_age)

    return AuthResponse(
        user=_user_to_response(user),
        message="Account registered successfully. Welcome to FloodVision."
    )

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "127.0.0.1"
    user = auth_service.authenticate_user(
        email=payload.email,
        password=payload.password,
        client_identifier=client_ip
    )

    # 7 days if remember_me, otherwise 24 hours
    max_age = settings.SESSION_MAX_AGE_SECONDS if payload.remember_me else 86400
    token = auth_service.create_session_token(user_id=user["id"], role=user["role"])
    _set_auth_cookie(response, token, max_age)

    return AuthResponse(
        user=_user_to_response(user),
        message=f"Welcome back, {user['name']}."
    )

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/"
    )
    return {"message": "Session invalidated. Logged out successfully."}

@router.get("/me", response_model=Dict[str, UserResponse])
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": _user_to_response(current_user)}

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_profile(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    IDOR-Protected Profile Access:
    Users can only access their own profile unless they hold administrator privileges.
    """
    if current_user["id"] != user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot access another user's private records."
        )

    target_user = user_repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    return _user_to_response(target_user)

@router.post("/forgot-password")
def forgot_password(payload: Dict[str, str]):
    email = payload.get("email", "").strip().lower()
    return {
        "status": "acknowledged",
        "email": email,
        "message": (
            "Password recovery notification recorded. In compliance with emergency-response protocols, "
            "password resets are managed by the Chief Flood Incident Administrator or Traffic Operations Command."
        )
    }

@router.post("/verify-email")
def verify_email(
    payload: Optional[Dict[str, str]] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    token = (payload or {}).get("token")
    target_user_id = None

    if token:
        email = auth_service.verify_email_verification_token(token)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token."
            )
        user = user_repo.get_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account associated with token not found."
            )
        target_user_id = user["id"]
    elif current_user:
        target_user_id = current_user["id"]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to verify email."
        )

    user_repo.verify_email(target_user_id)
    updated_user = user_repo.get_by_id(target_user_id)
    return {
        "status": "verified",
        "message": "Email address verified successfully.",
        "user": _user_to_response(updated_user)
    }

@router.post("/send-verification")
def send_verification(current_user: Dict[str, Any] = Depends(get_current_user)):
    token = auth_service.generate_email_verification_token(current_user["email"])
    return {
        "status": "sent",
        "message": f"Verification token generated for {current_user['email']}.",
        "verification_token": token
    }

@router.get("/admin-status")
def get_admin_status():
    """Returns whether at least one administrator account exists in the database."""
    counts = user_repo.count_users()
    has_admin = counts["admins"] > 0
    return {
        "has_admin": has_admin,
        "admin_count": counts["admins"],
        "default_admin_email": settings.ADMIN_INITIAL_EMAIL or "admin@floodvision.org"
    }
