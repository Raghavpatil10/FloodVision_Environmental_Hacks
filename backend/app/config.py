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
    AWS_ENDPOINT_URL: Optional[str] = os.getenv("AWS_ENDPOINT_URL", None)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

