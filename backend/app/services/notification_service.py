import boto3
from botocore.exceptions import ClientError
from ..config import settings
from typing import Dict, Any

import logging

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.topic_arn = settings.SNS_TOPIC_ARN
        kwargs = {"region_name": settings.AWS_REGION}
        if getattr(settings, "AWS_ENDPOINT_URL", None):
            kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL
        try:
            self.sns = boto3.client('sns', **kwargs)
        except Exception as e:
            logger.warning(f"SNS client initialization fallback: {e}")
            self.sns = None
        
    def trigger_alert_if_critical(self, incident: Dict[str, Any]):
        depth = incident.get("estimated_depth_cm")
        
        # Only trigger if valid depth and exceeds critical threshold
        if depth is not None and depth >= settings.CRITICAL_DEPTH_CM:
            self._send_sns(incident)
            
    def _send_sns(self, incident: Dict[str, Any]):
        if not self.topic_arn:
            print("SNS_TOPIC_ARN not configured, skipping alert.")
            return
            
        message = (
            f"URGENT: Critical flood hazard reported!\n"
            f"Estimated Depth: {incident.get('estimated_depth_cm')} cm\n"
            f"Location: {incident.get('latitude')}, {incident.get('longitude')}\n"
            f"Risk Level: {incident.get('risk_level')}\n"
        )
        
        try:
            self.sns.publish(
                TopicArn=self.topic_arn,
                Message=message,
                Subject="FloodVision Critical Alert"
            )
        except ClientError as e:
            print(f"Failed to send SNS alert: {str(e)}")

notification_service = NotificationService()
