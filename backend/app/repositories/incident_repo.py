import boto3
from botocore.exceptions import ClientError
from typing import List, Optional, Dict, Any
from ..config import settings
from datetime import datetime, timedelta
import uuid

class IncidentRepository:
    def __init__(self):
        self.table_name = settings.DYNAMODB_TABLE_NAME
        # Initialize dynamo resource, relying on implicit AWS credentials
        self.dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.table = self.dynamodb.Table(self.table_name)
    
    def save_incident(self, incident_data: Dict[str, Any]) -> str:
        incident_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        item = {
            **incident_data,
            "incident_id": incident_id,
            "reported_at": now,
            "last_updated_at": now
        }
        
        try:
            self.table.put_item(Item=item)
            return incident_id
        except ClientError as e:
            # We log and re-raise, or handle. We'll raise to let caller know.
            raise Exception(f"Failed to save to DynamoDB: {str(e)}")

    def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = self.table.get_item(Key={"incident_id": incident_id})
            return response.get("Item")
        except ClientError as e:
            raise Exception(f"Failed to fetch from DynamoDB: {str(e)}")

    def list_recent_incidents(self, max_age_hours: int = 24) -> List[Dict[str, Any]]:
        # In a real production app with DynamoDB, we'd use a GSI (e.g., status and reported_at).
        # Since Dynamo doesn't support generic spatial queries without a library,
        # and we don't have a GSI guaranteed, we will use a scan with a filter.
        # This is a limitation but acceptable given the instruction constraints.
        cutoff = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
        
        try:
            response = self.table.scan(
                FilterExpression="reported_at >= :cutoff AND #st = :active",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":cutoff": cutoff, ":active": "active"}
            )
            return response.get("Items", [])
        except ClientError as e:
            raise Exception(f"Failed to scan DynamoDB: {str(e)}")

    def update_status(self, incident_id: str, new_status: str) -> bool:
        try:
            now = datetime.utcnow().isoformat()
            self.table.update_item(
                Key={"incident_id": incident_id},
                UpdateExpression="SET #st = :val, last_updated_at = :now",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={":val": new_status, ":now": now}
            )
            return True
        except ClientError as e:
            return False

incident_repo = IncidentRepository()
