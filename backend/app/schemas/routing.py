from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Coordinates(BaseModel):
    lat: float
    lon: float

class GeocodeResult(BaseModel):
    name: str
    display_name: str
    lat: float
    lon: float

class RouteRequest(BaseModel):
    origin: Optional[Coordinates] = None
    destination: Optional[Coordinates] = None
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None

class RouteSegment(BaseModel):
    geometry: str
    distance_m: float
    duration_s: float
    risk_level: str
    safety_score: int
    incident_id: Optional[str] = None

class RouteOption(BaseModel):
    total_distance_m: float
    total_duration_s: float
    segments: List[RouteSegment]
    overall_safety_score: int
    critical_hazards: int
    recommendation_reason: str
    coordinates: Optional[List[Coordinates]] = None
    is_rerouted: bool = False
    avoided_hazard_count: int = 0
    hazard_incidents: Optional[List[Dict[str, Any]]] = None

class RouteResponse(BaseModel):
    origin: Coordinates
    destination: Coordinates
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None
    recommended_route: RouteOption
    alternative_routes: List[RouteOption]
