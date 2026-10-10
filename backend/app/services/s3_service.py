import boto3
from botocore.exceptions import ClientError, BotoCoreError
from typing import Optional, Dict, Any
from ..config import settings
import uuid
import logging
import base64

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.s3_client = None
        # Cache for offline/local development mock storage
        self._local_storage: Dict[str, Dict[str, Any]] = {}
        try:
            kwargs = {"region_name": settings.AWS_REGION}
            if getattr(settings, "AWS_ENDPOINT_URL", None):
                kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL
            self.s3_client = boto3.client('s3', **kwargs)
        except Exception as e:
            logger.warning(f"S3 client initialization fallback: {e}")

    def upload_image(self, file_bytes: bytes, filename_prefix: str = "raw", content_type: str = "image/jpeg") -> str:
        """
        Uploads image to Amazon S3 bucket.
        Supports AWS Cloud, LocalStack, and graceful base64 data URI fallback for offline dev.
        """
        key = f"{filename_prefix}/{uuid.uuid4().hex}.jpg"
        if self.s3_client:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_bytes,
                    ContentType=content_type
                )
                if getattr(settings, "AWS_ENDPOINT_URL", None):
                    return f"{settings.AWS_ENDPOINT_URL}/{self.bucket_name}/{key}"
                return f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"S3 upload failed ({e}), falling back to inline data URI.")
        
        # Local development / offline fallback: inline Base64 Data URI
        encoded = base64.b64encode(file_bytes).decode('utf-8')
        data_uri = f"data:{content_type};base64,{encoded}"
        self._local_storage[key] = {"bytes": file_bytes, "content_type": content_type, "data_uri": data_uri}
        return data_uri

    def upload_raw_object(self, file_bytes: bytes, filename_prefix: str = "regional_images", content_type: str = "image/jpeg", extension: str = "jpg") -> str:
        """
        Stores an image object in private S3 and returns the private object key.
        """
        key = f"{filename_prefix}/{uuid.uuid4().hex}.{extension}"
        encoded = base64.b64encode(file_bytes).decode('utf-8')
        data_uri = f"data:{content_type};base64,{encoded}"
        self._local_storage[key] = {"bytes": file_bytes, "content_type": content_type, "data_uri": data_uri}

        if self.s3_client:
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_bytes,
                    ContentType=content_type
                )
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"S3 private put_object failed ({e}), saved in local cache.")

        return key

    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        """
        Generates a secure, short-lived presigned URL for private S3 objects.
        Falls back to local mock data URI if running in mock/offline mode.
        """
        if object_key.startswith("data:"):
            return object_key

        if self.s3_client:
            try:
                presigned = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': object_key},
                    ExpiresIn=expiration
                )
                return presigned
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"Failed to generate presigned S3 URL ({e}), checking local cache.")

        if object_key in self._local_storage:
            return self._local_storage[object_key]["data_uri"]

        # If key is already a full URL
        if object_key.startswith("http://") or object_key.startswith("https://"):
            return object_key

        # Default fallback placeholder
        return f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{object_key}?expires={expiration}"

s3_service = S3Service()
