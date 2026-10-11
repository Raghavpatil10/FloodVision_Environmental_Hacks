import httpx
from typing import List, Dict, Any, Optional
from ..config import settings
from ..schemas.routing import Coordinates, RouteOption, RouteSegment, RouteRequest, RouteResponse, GeocodeResult
import math
import logging

logger = logging.getLogger(__name__)

class RoutingService:
    def __init__(self):
        self.base_url = settings.ROUTING_BASE_URL
        self.provider = settings.ROUTING_PROVIDER
        self.headers = {"User-Agent": "FloodVision-App/1.0 (Environmental Hacks)"}

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine formula to compute distance in meters between two lat/lon coordinates."""
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

    def point_to_segment_distance(self, p_lat: float, p_lon: float, a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
        """Calculates distance in meters from point P to line segment AB."""
        # Convert to local flat projection in meters
        mid_lat = math.radians((a_lat + b_lat) / 2)
        kx = 111320 * math.cos(mid_lat)
        ky = 110540

        px, py = p_lon * kx, p_lat * ky
        ax, ay = a_lon * kx, a_lat * ky
        bx, by = b_lon * kx, b_lat * ky

        dx = bx - ax
        dy = by - ay
        len_sq = dx * dx + dy * dy

        if len_sq == 0:
            return math.hypot(px - ax, py - ay)

        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len_sq))
        proj_x = ax + t * dx
        proj_y = ay + t * dy

        return math.hypot(px - proj_x, py - proj_y)

    def match_incidents_to_route(self, route_geometry: List[Dict[str, float]], incidents: List[Dict[str, Any]], tolerance_meters: float = 120.0) -> List[Dict[str, Any]]:
        """Finds incidents within tolerance_meters of the route polyline."""
        if not route_geometry or not incidents:
            return []

        matched = []
        for incident in incidents:
            lat = incident.get("latitude")
            lon = incident.get("longitude")
            if lat is None or lon is None:
                continue

            is_match = False
            # Check point-to-point and segment-to-point
            for i in range(len(route_geometry) - 1):
                p1 = route_geometry[i]
                p2 = route_geometry[i + 1]
                dist = self.point_to_segment_distance(lat, lon, p1["lat"], p1["lon"], p2["lat"], p2["lon"])
                if dist <= tolerance_meters:
                    is_match = True
                    break

            if not is_match and len(route_geometry) == 1:
                p = route_geometry[0]
                if self.calculate_distance(lat, lon, p["lat"], p["lon"]) <= tolerance_meters:
                    is_match = True

            if is_match and incident not in matched:
                matched.append(incident)

        return matched

    async def geocode_location(self, query: str) -> Optional[Coordinates]:
        """Resolves location name or address to geographic coordinates using OpenStreetMap Nominatim."""
        if not query or not query.strip():
            return None

        clean_q = query.strip()
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": clean_q, "format": "json", "limit": 1, "addressdetails": 1}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, headers=self.headers, timeout=6.0)
                if resp.status_code == 200:
                    data = resp.json()
                    if data and len(data) > 0:
                        return Coordinates(lat=float(data[0]["lat"]), lon=float(data[0]["lon"]))
        except Exception as e:
            logger.warning(f"Geocoding failed for '{query}': {e}")

        return None

    async def search_locations(self, query: str) -> List[GeocodeResult]:
        """Returns autocomplete suggestions for location names."""
        if not query or len(query.strip()) < 2:
            return []

        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": query.strip(), "format": "json", "limit": 5, "addressdetails": 1}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, headers=self.headers, timeout=6.0)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data:
                        name = item.get("name") or item.get("display_name", "").split(",")[0]
                        results.append(
                            GeocodeResult(
                                name=name,
                                display_name=item.get("display_name", name),
                                lat=float(item["lat"]),
                                lon=float(item["lon"])
                            )
                        )
                    return results
        except Exception as e:
            logger.warning(f"Location search failed for '{query}': {e}")

        return []

    async def detect_ip_location(self) -> Dict[str, Any]:
        """Automatically detects user's approximate location based on client IP."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get("http://ip-api.com/json", timeout=4.0)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "success":
                        return {
                            "city": data.get("city", "Local Area"),
                            "region": data.get("regionName", ""),
                            "country": data.get("country", ""),
                            "lat": data.get("lat", 21.1463),
                            "lon": data.get("lon", 79.0849)
                        }
        except Exception as e:
            logger.warning(f"IP Geolocation failed: {e}")

        # Default fallback (Nagpur, Maharashtra)
        return {
            "city": "Nagpur",
            "region": "Maharashtra",
            "country": "India",
            "lat": 21.1463,
            "lon": 79.0849
        }

    async def _fetch_osrm_route(self, coords_list: List[Coordinates]) -> Optional[Dict[str, Any]]:
        """Fetches driving route through sequence of waypoints from OSRM."""
        coords_str = ";".join([f"{c.lon},{c.lat}" for c in coords_list])
        url = f"{self.base_url}/route/v1/driving/{coords_str}?alternatives=true&geometries=geojson&steps=true&overview=full"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=9.0)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.warning(f"OSRM query failed for {coords_str}: {e}")

        return None

    def _create_synthetic_route(self, coords_list: List[Coordinates]) -> Dict[str, Any]:
        """Generates synthetic route fallback when external OSRM is unreachable."""
        full_coords = []
        total_dist = 0.0

        for i in range(len(coords_list) - 1):
            c1 = coords_list[i]
            c2 = coords_list[i + 1]
            steps = 15
            for s in range(steps):
                f = s / steps
                lat = c1.lat + (c2.lat - c1.lat) * f
                lon = c1.lon + (c2.lon - c1.lon) * f
                full_coords.append([lon, lat])
            total_dist += self.calculate_distance(c1.lat, c1.lon, c2.lat, c2.lon)

        last = coords_list[-1]
        full_coords.append([last.lon, last.lat])

        return {
            "routes": [
                {
                    "distance": total_dist,
                    "duration": total_dist / 11.1,  # ~40 km/h
                    "geometry": {"coordinates": full_coords}
                }
            ]
        }

    async def get_routes(self, origin: Coordinates, destination: Coordinates, incidents: List[Dict[str, Any]]) -> RouteResponse:
        """Plans route, detects hazards on the direct path, and dynamically computes a safe detour if needed."""
        # 1. Fetch direct routes from OSRM
        data = await self._fetch_osrm_route([origin, destination])
        if not data or not data.get("routes"):
            data = self._create_synthetic_route([origin, destination])

        options: List[RouteOption] = []

        for route in data.get("routes", []):
            distance = route.get("distance", 0)
            duration = route.get("duration", 0)
            geom_coords = route.get("geometry", {}).get("coordinates", [])
            route_geometry = [{"lat": c[1], "lon": c[0]} for c in geom_coords]

            matched = self.match_incidents_to_route(route_geometry, incidents)

            critical_hazards = 0
            worst_score = 100

            for inc in matched:
                score = inc.get("safety_score")
                if score is not None:
                    worst_score = min(worst_score, score)
                d = float(inc.get("estimated_depth_cm", 0))
                if inc.get("risk_level") == "critical" or d >= 30:
                    critical_hazards += 1

            if not matched:
                reason = "Direct route is clear of recorded flood incidents."
            elif critical_hazards > 0:
                reason = f"Hazard Detected: Direct route crosses critical waterlogging ({critical_hazards} flood reports)."
            else:
                reason = "Caution: Route passes near moderate water puddles."

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
                    coordinates=route_coords_list,
                    is_rerouted=False,
                    avoided_hazard_count=0,
                    hazard_incidents=matched
                )
            )

        # Check if direct routes all encounter hazards
        has_hazards = any(opt.critical_hazards > 0 or opt.overall_safety_score < 70 for opt in options)

        # 2. ACTIVE REROUTING: If hazards exist on route, compute bypass detours!
        if has_hazards:
            hazardous_route = options[0]
            matched_hazards = hazardous_route.hazard_incidents or []

            # Generate bypass waypoints perpendicular to hazard points
            detour_routes: List[RouteOption] = []

            for hazard in matched_hazards[:2]:  # Focus on primary active hazards
                h_lat = float(hazard.get("latitude", origin.lat))
                h_lon = float(hazard.get("longitude", origin.lon))

                # Direction vector from origin to destination
                dx = destination.lon - origin.lon
                dy = destination.lat - origin.lat
                length = math.hypot(dx, dy) or 1.0

                # Perpendicular unit vectors (left and right)
                perp_dx = -dy / length
                perp_dy = dx / length

                # Try left and right detour offsets (approx 800m and 1400m)
                offsets = [0.008, -0.008, 0.014, -0.014]

                for off in offsets:
                    waypoint = Coordinates(
                        lat=h_lat + perp_dy * off,
                        lon=h_lon + perp_dx * off
                    )

                    detour_data = await self._fetch_osrm_route([origin, waypoint, destination])
                    if not detour_data or not detour_data.get("routes"):
                        continue

                    detour_r = detour_data["routes"][0]
                    detour_geom = detour_r.get("geometry", {}).get("coordinates", [])
                    detour_geometry = [{"lat": c[1], "lon": c[0]} for c in detour_geom]

                    detour_matched = self.match_incidents_to_route(detour_geometry, incidents)
                    detour_critical = sum(1 for inc in detour_matched if float(inc.get("estimated_depth_cm", 0)) >= 30)

                    # Only accept detour if it is significantly safer than direct
                    if detour_critical == 0 and len(detour_matched) < len(matched_hazards):
                        detour_score = 100 if not detour_matched else 80
                        detour_coords_list = [Coordinates(lat=c[1], lon=c[0]) for c in detour_geom]

                        depth_val = hazard.get("estimated_depth_cm", "30+")
                        detour_routes.append(
                            RouteOption(
                                total_distance_m=detour_r.get("distance", 0),
                                total_duration_s=detour_r.get("duration", 0),
                                segments=[
                                    RouteSegment(
                                        geometry="detour_route",
                                        distance_m=detour_r.get("distance", 0),
                                        duration_s=detour_r.get("duration", 0),
                                        risk_level="low" if not detour_matched else "moderate",
                                        safety_score=detour_score
                                    )
                                ],
                                overall_safety_score=detour_score,
                                critical_hazards=0,
                                recommendation_reason=f"Safe Bypass Active: Successfully rerouted around {len(matched_hazards)} flood hazard(s) ({depth_val}cm deep) via clear roads.",
                                coordinates=detour_coords_list,
                                is_rerouted=True,
                                avoided_hazard_count=len(matched_hazards),
                                hazard_incidents=matched_hazards
                            )
                        )
                        break  # Found viable detour for this hazard

            if detour_routes:
                # Add viable detour routes to options
                options.extend(detour_routes)

        # Sort: Highest safety score first, then is_rerouted preference, then shortest distance
        options.sort(key=lambda x: (-x.overall_safety_score, 0 if x.is_rerouted else 1, x.total_distance_m))

        recommended = options[0] if options else None
        alternatives = options[1:] if len(options) > 1 else []

        return RouteResponse(
            origin=origin,
            destination=destination,
            recommended_route=recommended,
            alternative_routes=alternatives
        )

routing_service = RoutingService()
