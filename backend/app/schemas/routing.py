from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Coordinates(BaseModel):
    lat: float
    lon: float

class RouteRequest(BaseModel):
    origin: Coordinates
    destination: Coordinates
    consider_traffic: Optional[bool] = True
    traffic_mode: Optional[str] = "live" # "live", "rush_hour", "free_flow"

class RouteSegment(BaseModel):
    geometry: str
    distance_m: float
    duration_s: float
    risk_level: str
    safety_score: int
    incident_id: Optional[str] = None
    traffic_level: Optional[str] = "free_flow" # "free_flow", "moderate", "heavy", "severe"
    traffic_delay_s: Optional[float] = 0.0
    traffic_speed_kmh: Optional[float] = None

class RouteOption(BaseModel):
    total_distance_m: float
    total_duration_s: float # Duration in traffic (seconds)
    base_duration_s: Optional[float] = None # Free-flow duration without traffic (seconds)
    traffic_delay_s: Optional[float] = 0.0 # Delay due to traffic & waterlogging (seconds)
    traffic_congestion_level: Optional[str] = "free_flow" # "free_flow", "moderate", "heavy", "severe"
    traffic_score: Optional[int] = 100 # Traffic efficiency score (0-100)
    composite_score: Optional[int] = 100 # Blended safety + traffic viability score (0-100)
    segments: List[RouteSegment]
    overall_safety_score: int # Flood safety score (0-100)
    critical_hazards: int
    recommendation_reason: str
    coordinates: Optional[List[Coordinates]] = None
    traffic_segments: Optional[List[Dict[str, Any]]] = None # Colored traffic segments for map
    traffic_bottlenecks: Optional[List[Dict[str, Any]]] = None # Specific choke points

class RouteResponse(BaseModel):
    origin: Coordinates
    destination: Coordinates
    traffic_considered: bool = True
    traffic_summary: Optional[Dict[str, Any]] = None
    recommended_route: RouteOption
    alternative_routes: List[RouteOption]

