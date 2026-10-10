import httpx
from typing import List, Dict, Any, Optional
from ..config import settings
from ..schemas.routing import Coordinates, RouteOption, RouteSegment, RouteRequest, RouteResponse
import math

class RoutingService:
    def __init__(self):
        self.base_url = settings.ROUTING_BASE_URL
        self.provider = settings.ROUTING_PROVIDER

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        # Haversine formula
        R = 6371e3
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2) * math.sin(delta_phi / 2) + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2) * math.sin(delta_lambda / 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def match_incidents_to_route(self, route_geometry: List[Dict[str, float]], incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        matched = []
        for incident in incidents:
            lat = incident.get("latitude")
            lon = incident.get("longitude")
            # Tolerance: 50 meters
            if not lat or not lon:
                continue
            
            for pt in route_geometry:
                dist = self.calculate_distance(lat, lon, pt["lat"], pt["lon"])
                if dist < 50:
                    matched.append(incident)
                    break
        return matched

    async def get_routes(self, origin: Coordinates, destination: Coordinates, incidents: List[Dict[str, Any]]) -> RouteResponse:
        # Simple OSRM adapter
        # OSRM expects longitude,latitude
        url = f"{self.base_url}/route/v1/driving/{origin.lon},{origin.lat};{destination.lon},{destination.lat}?alternatives=true&geometries=geojson&steps=true"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            # Return synthetic or empty if external service fails
            raise Exception(f"Routing provider failed: {str(e)}")

        options: List[RouteOption] = []
        
        for route in data.get("routes", []):
            distance = route.get("distance", 0)
            duration = route.get("duration", 0)
            
            # Simple geometry extraction
            geom_coords = route.get("geometry", {}).get("coordinates", [])
            route_geometry = [{"lat": c[1], "lon": c[0]} for c in geom_coords]
            
            matched = self.match_incidents_to_route(route_geometry, incidents)
            
            critical_hazards = 0
            worst_score = 100
            
            for inc in matched:
                score = inc.get("safety_score")
                if score is not None:
                    worst_score = min(worst_score, score)
                if inc.get("risk_level") == "critical":
                    critical_hazards += 1

            if not matched:
                reason = "No known flood incidents along this route."
            elif critical_hazards > 0:
                reason = "Warning: Route intersects critical flood zones."
            else:
                reason = "Route passes near moderate or high risk flood zones."

            route_coords_list = [Coordinates(lat=c[1], lon=c[0]) for c in geom_coords]

            options.append(
                RouteOption(
                    total_distance_m=distance,
                    total_duration_s=duration,
                    segments=[
                        RouteSegment(
                            geometry="full_route",
                            distance_m=distance,
                            duration_s=duration,
                            risk_level="critical" if critical_hazards > 0 else ("moderate" if matched else "low"),
                            safety_score=worst_score
                        )
                    ],
                    overall_safety_score=worst_score,
                    critical_hazards=critical_hazards,
                    recommendation_reason=reason,
                    coordinates=route_coords_list
                )
            )

        # Sort options to prefer lower risk (higher safety score), then distance
        options.sort(key=lambda x: (-x.overall_safety_score, x.total_distance_m))
        
        recommended = options[0] if options else None
        alternatives = options[1:] if len(options) > 1 else []

        if recommended and recommended.critical_hazards > 0:
            recommended.recommendation_reason = "No completely safe route available. Proceed with extreme caution."

        return RouteResponse(
            origin=origin,
            destination=destination,
            recommended_route=recommended,
            alternative_routes=alternatives
        )

routing_service = RoutingService()
