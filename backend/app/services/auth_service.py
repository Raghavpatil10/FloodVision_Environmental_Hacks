import bcrypt
import time
import re
import threading
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
import logging
from ..config import settings
from ..repositories.user_repo import user_repo, UserRepository

logger = logging.getLogger(__name__)

class LoginRateLimiter:
    """
    In-memory thread-safe rate limiter to prevent repeated password guessing
    and brute-force credential stuffing attacks against FloodVision authentication.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def record_failure(self, key: str):
        with self._lock:
            now = time.time()
            history = self.attempts.get(key, [])
            history = [t for t in history if now - t < self.window_seconds]
            history.append(now)
            self.attempts[key] = history

    def is_rate_limited(self, key: str) -> bool:
        with self._lock:
            now = time.time()
            history = self.attempts.get(key, [])
            valid_history = [t for t in history if now - t < self.window_seconds]
            self.attempts[key] = valid_history
            return len(valid_history) >= self.max_attempts

    def reset(self, key: Optional[str] = None):
        with self._lock:
            if key:
                self.attempts.pop(key, None)
            else:
                self.attempts.clear()

class AuthService:
    def __init__(self, repository: Optional[UserRepository] = None):
        self.repo = repository or user_repo
        self.serializer = URLSafeTimedSerializer(
            secret_key=settings.SECRET_KEY, 
            salt="floodvision-auth-session"
        )
        self.rate_limiter = LoginRateLimiter(max_attempts=5, window_seconds=300)

    def validate_password_strength(self, password: str):
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long."
            )
        if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one letter and one number."
            )

    def hash_password(self, plain_password: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'), 
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            logger.warning(f"Password verification error: {e}")
            return False

    def create_session_token(self, user_id: str, role: str) -> str:
        payload = {"sub": user_id, "role": role, "iat": time.time()}
        return self.serializer.dumps(payload)

    def verify_session_token(self, token: str, max_age: Optional[int] = None) -> Optional[Dict[str, Any]]:
        age = max_age or settings.SESSION_MAX_AGE_SECONDS
        try:
            payload = self.serializer.loads(token, max_age=age)
            return payload
        except SignatureExpired:
            logger.info("Session token expired")
            return None
        except (BadSignature, Exception) as e:
            logger.warning(f"Invalid session token: {e}")
            return None

    def register_user(
        self, 
        name: str, 
        email: str, 
        password: str, 
        confirm_password: Optional[str] = None
    ) -> Dict[str, Any]:
        # Enforce matching passwords if confirm_password is provided
        if confirm_password is not None and password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Passwords do not match. Please verify and try again."
            )

        self.validate_password_strength(password)

        clean_email = email.strip().lower()
        existing = self.repo.get_by_email(clean_email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address is already registered."
            )

        hashed = self.hash_password(password)
        # Public registration is strictly locked to 'user' role
        created = self.repo.create_user(
            name=name.strip(),
            email=clean_email,
            hashed_password=hashed,
            role="user",
            is_active=True
        )
        return created

    def authenticate_user(
        self, 
        email: str, 
        password: str, 
        client_identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        rate_limit_key = f"{client_identifier or 'ip'}:{clean_email}"

        # 1. Enforce rate limiting protection
        if self.rate_limiter.is_rate_limited(rate_limit_key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please wait 5 minutes before trying again."
            )

        user = self.repo.get_by_email(clean_email)
        if not user:
            self.rate_limiter.record_failure(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email address or password."
            )

        # 2. Check if account is active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been suspended or deactivated. Contact emergency administrators."
            )

        # 3. Verify password hash
        password_hash = user.get("password_hash") or user.get("hashed_password") or ""
        if not self.verify_password(password, password_hash):
            self.rate_limiter.record_failure(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email address or password."
            )

        # Successful authentication: reset rate limiter for this identifier
        self.rate_limiter.reset(rate_limit_key)
        self.repo.update_last_login(user["id"])
        return user

    def create_admin_user(self, name: str, email: str, password: str) -> Dict[str, Any]:
        self.validate_password_strength(password)
            
        clean_email = email.strip().lower()
        existing = self.repo.get_by_email(clean_email)
        if existing:
            raise ValueError(f"User with email '{clean_email}' already exists.")

        hashed = self.hash_password(password)
        admin_user = self.repo.create_user(
            name=name.strip(),
            email=clean_email,
            hashed_password=hashed,
            role="admin",
            is_active=True
        )
        logger.info(f"Admin user created successfully: {clean_email}")
        return admin_user

    def seed_initial_admin_if_configured(self) -> Optional[Dict[str, Any]]:
        admin_email = getattr(settings, "ADMIN_INITIAL_EMAIL", None)
        admin_pass = getattr(settings, "ADMIN_INITIAL_PASSWORD", None)
        admin_name = getattr(settings, "ADMIN_INITIAL_NAME", "Emergency Response Admin")
        
        if admin_email and admin_pass:
            clean_email = admin_email.strip().lower()
            if not self.repo.get_by_email(clean_email):
                try:
                    return self.create_admin_user(
                        name=admin_name,
                        email=clean_email,
                        password=admin_pass
                    )
                except Exception as e:
                    logger.warning(f"Could not auto-seed admin: {e}")
        return None

auth_service = AuthService()
