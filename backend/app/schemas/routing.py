from pydantic import BaseModel, Field
from typing import List, Optional

class Coordinates(BaseModel):
    lat: float
    lon: float

class RouteRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates

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

class RouteResponse(BaseModel):
    origin: Coordinates
    destination: Coordinates
    recommended_route: RouteOption
    alternative_routes: List[RouteOption]
