import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID", None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY", None)
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "floodvision-images")
    DYNAMODB_TABLE_NAME: str = os.getenv("DYNAMODB_TABLE_NAME", "floodvision_incidents")
    SNS_TOPIC_ARN: str = os.getenv("SNS_TOPIC_ARN", "")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    ROUTING_PROVIDER: str = os.getenv("ROUTING_PROVIDER", "osrm")
    ROUTING_BASE_URL: str = os.getenv("ROUTING_BASE_URL", "http://router.project-osrm.org")
    MAX_IMAGE_SIZE_MB: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "5"))
    MAX_INCIDENT_AGE_HOURS: int = int(os.getenv("MAX_INCIDENT_AGE_HOURS", "24"))
    CRITICAL_DEPTH_CM: float = float(os.getenv("CRITICAL_DEPTH_CM", "30.0"))
    TRAFFIC_WARDEN_PHONE_NUMBER: Optional[str] = os.getenv("TRAFFIC_WARDEN_PHONE_NUMBER", "+15550192834")
    AWS_ENDPOINT_URL: Optional[str] = os.getenv("AWS_ENDPOINT_URL", None)

    # Authentication & Session Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "floodvision-auth-jwt-secret-key-change-in-prod-2026")
    SESSION_COOKIE_NAME: str = "floodvision_session"
    SESSION_MAX_AGE_SECONDS: int = int(os.getenv("SESSION_MAX_AGE_SECONDS", str(86400 * 7)))  # 7 days
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
    USERS_DB_PATH: str = os.getenv("USERS_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "users.db"))
    ADMIN_INITIAL_EMAIL: Optional[str] = os.getenv("ADMIN_INITIAL_EMAIL", None)
    ADMIN_INITIAL_PASSWORD: Optional[str] = os.getenv("ADMIN_INITIAL_PASSWORD", None)
    ADMIN_INITIAL_NAME: str = os.getenv("ADMIN_INITIAL_NAME", "Emergency Response Admin")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

