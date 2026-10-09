import boto3
from botocore.exceptions import ClientError, BotoCoreError
from typing import Optional
from ..config import settings
import uuid
import logging
import base64

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.s3_client = None
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
        return f"data:{content_type};base64,{encoded}"

s3_service = S3Service()
