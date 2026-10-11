import boto3
from botocore.exceptions import ClientError, BotoCoreError
from typing import List, Optional, Dict, Any
from ..config import settings
from datetime import datetime, timedelta
import uuid
import logging

from decimal import Decimal

def _floats_to_decimals(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_floats_to_decimals(v) for v in obj]
    return obj

def _decimals_to_floats(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimals_to_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimals_to_floats(v) for v in obj]
    return obj

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
            },
            "demo-nagpur-1": {
                "incident_id": "demo-nagpur-1",
                "latitude": 21.1265,
                "longitude": 79.0667,
                "estimated_depth_cm": 38.5,
                "safety_score": 18,
                "risk_level": "critical",
                "confidence": "0.93",
                "annotated_image_url": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80",
                "status": "active",
                "reported_at": now,
                "last_updated_at": now
            },
            "demo-nagpur-2": {
                "incident_id": "demo-nagpur-2",
                "latitude": 21.1470,
                "longitude": 79.0880,
                "estimated_depth_cm": 14.5,
                "safety_score": 75,
                "risk_level": "safe",
                "confidence": "0.88",
                "annotated_image_url": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80",
                "status": "active",
                "reported_at": now,
                "last_updated_at": now
            }
        }
        try:
            kwargs = {"region_name": settings.AWS_REGION}
            if getattr(settings, "AWS_ENDPOINT_URL", None):
                kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL
            self.dynamodb = boto3.resource('dynamodb', **kwargs)
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
                dynamo_item = _floats_to_decimals(item)
                self.table.put_item(Item=dynamo_item)
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

    def list_incidents(
        self, 
        status: Optional[str] = "active", 
        max_age_hours: Optional[int] = 24,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        radius_km: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        cutoff = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat() if max_age_hours else None
        
        items = list(self._local_incidents.values())
        if self.table:
            try:
                res = self.table.scan()
                if res.get("Items") is not None:
                    items = _decimals_to_floats(res.get("Items"))
            except Exception as e:
                logger.warning(f"Dynamo scan fallback: {e}")

        results = []
        for item in items:
            item_status = str(item.get("status", "active")).lower()
            if status and status.lower() != "all" and item_status != status.lower():
                continue
            if cutoff and item.get("reported_at", "") < cutoff:
                continue
            item_lat = item.get("latitude")
            item_lon = item.get("longitude")
            if lat is not None and lon is not None and item_lat is not None and item_lon is not None:
                d_km = round(self.calculate_distance_km(lat, lon, float(item_lat), float(item_lon)), 2)
                item_copy = dict(item)
                item_copy["distance_km"] = d_km
                if radius_km is not None and d_km > radius_km:
                    continue
                results.append(item_copy)
            else:
                results.append(dict(item))

        results.sort(key=lambda x: x.get("reported_at", ""), reverse=True)
        return results

    def list_recent_incidents(self, max_age_hours: int = 24) -> List[Dict[str, Any]]:
        return self.list_incidents(status="active", max_age_hours=max_age_hours)

    @staticmethod
    def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        import math
        r = 6371.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

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
