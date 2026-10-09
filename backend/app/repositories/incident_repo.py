import boto3
from botocore.exceptions import ClientError, BotoCoreError
from typing import List, Optional, Dict, Any
from ..config import settings
from datetime import datetime, timedelta
import uuid
import logging

logger = logging.getLogger(__name__)

class IncidentRepository:
    def __init__(self):
        self.table_name = settings.DYNAMODB_TABLE_NAME
        self.dynamodb = None
        self.table = None
        now = datetime.utcnow().isoformat()
        self._local_incidents: Dict[str, Dict[str, Any]] = {
            "demo-1": {
                "incident_id": "demo-1",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "estimated_depth_cm": 35.5,
                "safety_score": 25,
                "risk_level": "critical",
                "confidence": "0.91",
                "annotated_image_url": "https://example.com/annotated_dummy.jpg",
                "status": "active",
                "reported_at": now,
                "last_updated_at": now
            },
            "demo-2": {
                "incident_id": "demo-2",
                "latitude": 19.0800,
                "longitude": 72.8850,
                "estimated_depth_cm": 18.0,
                "safety_score": 60,
                "risk_level": "moderate",
                "confidence": "0.85",
                "annotated_image_url": "https://example.com/annotated_dummy.jpg",
                "status": "active",
                "reported_at": now,
                "last_updated_at": now
            }
        }
        try:
            self.dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
            self.table = self.dynamodb.Table(self.table_name)
        except Exception as e:
            logger.warning(f"DynamoDB initialization fallback to memory: {e}")
    
    def save_incident(self, incident_data: Dict[str, Any]) -> str:
        incident_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        item = {
            **incident_data,
            "incident_id": incident_id,
            "status": incident_data.get("status", "active"),
            "reported_at": now,
            "last_updated_at": now
        }
        
        if self.table:
            try:
                self.table.put_item(Item=item)
                return incident_id
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"Failed to save to DynamoDB, falling back to local memory: {e}")
        
        self._local_incidents[incident_id] = item
        return incident_id

    def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
        if self.table:
            try:
                response = self.table.get_item(Key={"incident_id": incident_id})
                item = response.get("Item")
                if item:
                    return item
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"Failed to fetch from DynamoDB, falling back to local memory: {e}")
        
        return self._local_incidents.get(incident_id)

    def list_recent_incidents(self, max_age_hours: int = 24) -> List[Dict[str, Any]]:
        cutoff = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
        
        if self.table:
            try:
                response = self.table.scan(
                    FilterExpression="reported_at >= :cutoff AND #st = :active",
                    ExpressionAttributeNames={"#st": "status"},
                    ExpressionAttributeValues={":cutoff": cutoff, ":active": "active"}
                )
                items = response.get("Items")
                if items is not None:
                    return items
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"Failed to scan DynamoDB, falling back to local memory: {e}")
        
        return [
            item for item in self._local_incidents.values()
            if item.get("status") == "active" and item.get("reported_at", "") >= cutoff
        ]

    def update_status(self, incident_id: str, new_status: str) -> bool:
        now = datetime.utcnow().isoformat()
        if self.table:
            try:
                self.table.update_item(
                    Key={"incident_id": incident_id},
                    UpdateExpression="SET #st = :val, last_updated_at = :now",
                    ExpressionAttributeNames={"#st": "status"},
                    ExpressionAttributeValues={":val": new_status, ":now": now}
                )
                return True
            except (ClientError, BotoCoreError, Exception) as e:
                logger.warning(f"Failed to update status in DynamoDB, falling back to local memory: {e}")
        
        if incident_id in self._local_incidents:
            self._local_incidents[incident_id]["status"] = new_status
            self._local_incidents[incident_id]["last_updated_at"] = now
            return True
        return False

incident_repo = IncidentRepository()
