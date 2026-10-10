import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import math
from ..config import settings
from ..schemas.routing import Coordinates, RouteOption, RouteSegment, RouteRequest, RouteResponse

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

    def analyze_traffic_conditions(
        self,
        route_geometry: List[Dict[str, float]],
        base_duration_s: float,
        distance_m: float,
        matched_incidents: List[Dict[str, Any]],
        route_index: int = 0,
        consider_traffic: bool = True,
        traffic_mode: str = "live"
    ) -> Dict[str, Any]:
        """
        Calculates live traffic conditions, corridor delays, congestion ratings,
        and localized waterlogging bottleneck friction.
        """
        if not consider_traffic or base_duration_s <= 0:
            return {
                "base_duration_s": base_duration_s,
                "total_duration_s": base_duration_s,
                "traffic_delay_s": 0.0,
                "traffic_congestion_level": "free_flow",
                "traffic_score": 100,
                "traffic_segments": [],
                "traffic_bottlenecks": []
            }

        # 1. Determine ambient time-of-day traffic multiplier
        mode = (traffic_mode or "live").lower()
        if mode == "free_flow":
            ambient_factor = 1.0
        elif mode == "rush_hour":
            ambient_factor = 1.60
        else:
            # Live traffic based on regional diurnal peak hours (IST / UTC+5:30)
            now = datetime.now(timezone.utc)
            ist_minutes = now.hour * 60 + now.minute + 330
            ist_hour = (ist_minutes // 60) % 24
            if 8 <= ist_hour < 11:
                ambient_factor = 1.50  # Morning commute peak
            elif 17 <= ist_hour < 21:
                ambient_factor = 1.62  # Evening commute peak
            elif 11 <= ist_hour < 17:
                ambient_factor = 1.25  # Midday steady traffic
            elif 22 <= ist_hour or ist_hour < 6:
                ambient_factor = 1.05  # Late night light traffic
            else:
                ambient_factor = 1.15  # Early morning / shoulder hours

        # 2. Localized waterlogging friction and choke point delays
        bottlenecks = []
        bottleneck_delay_s = 0.0

        for inc in matched_incidents:
            depth = float(inc.get("estimated_depth_cm") or 0.0)
            risk = inc.get("risk_level", "low")
            inc_lat = inc.get("latitude")
            inc_lon = inc.get("longitude")

            if risk == "critical" or depth >= 30:
                # Standstill / critical flood barrier: major vehicle stall queue
                delay = 360.0  # 6.0 min queue delay
                sev = "severe"
                desc = f"Critical flood blockage ({depth:.0f}cm depth) causing vehicle stall gridlock"
            elif risk in ["moderate", "high"] or depth >= 15:
                # Moderate puddle: traffic slows down to 10-15 km/h single-lane crawl
                delay = 180.0  # 3.0 min delay
                sev = "heavy"
                desc = f"Waterlogged corridor ({depth:.0f}cm depth) with significant lane queue slowdown"
            else:
                # Shallow puddle / splash caution
                delay = 45.0   # 45 sec delay
                sev = "moderate"
                desc = f"Shallow puddle ({depth:.0f}cm depth) causing caution slowdown"

            bottleneck_delay_s += delay
            bottlenecks.append({
                "latitude": inc_lat,
                "longitude": inc_lon,
                "severity": sev,
                "delay_s": delay,
                "description": desc,
                "depth_cm": depth
            })

        # 3. Aggregate travel time in traffic
        ambient_delay_s = base_duration_s * (ambient_factor - 1.0)
        total_delay_s = ambient_delay_s + bottleneck_delay_s
        total_duration_in_traffic_s = base_duration_s + total_delay_s

        # 4. Traffic efficiency score (0 - 100)
        congestion_ratio = total_duration_in_traffic_s / max(1.0, base_duration_s)
        if congestion_ratio <= 1.10:
            traffic_score = max(90, int(100 - (congestion_ratio - 1.0) * 100))
        elif congestion_ratio <= 1.35:
            traffic_score = max(70, int(90 - (congestion_ratio - 1.10) * 80))
        elif congestion_ratio <= 1.75:
            traffic_score = max(45, int(70 - (congestion_ratio - 1.35) * 62.5))
        elif congestion_ratio <= 2.25:
            traffic_score = max(25, int(45 - (congestion_ratio - 1.75) * 40))
        else:
            traffic_score = max(10, int(25 - (congestion_ratio - 2.25) * 15))

        # Overall congestion rating
        if traffic_score >= 85:
            congestion_level = "free_flow"
        elif traffic_score >= 65:
            congestion_level = "moderate"
        elif traffic_score >= 40:
            congestion_level = "heavy"
        else:
            congestion_level = "severe"

        # 5. Build traffic color-coded sub-segments along the route
        traffic_segments = []
        n_pts = len(route_geometry)
        if n_pts >= 2:
            chunk_size = max(2, math.ceil(n_pts / 6))
            for i in range(0, n_pts - 1, chunk_size):
                sub_pts = route_geometry[i:min(n_pts, i + chunk_size + 1)]
                if len(sub_pts) < 2:
                    continue
                
                # Check if this segment intersects any incident bottleneck
                seg_has_critical = False
                seg_has_moderate = False
                for b in bottlenecks:
                    for pt in sub_pts:
                        if self.calculate_distance(pt["lat"], pt["lon"], b["latitude"], b["longitude"]) < 80:
                            if b["severity"] == "severe":
                                seg_has_critical = True
                            elif b["severity"] == "heavy":
                                seg_has_moderate = True
                            break

                if seg_has_critical:
                    seg_level = "severe"
                    seg_color = "#ef4444"
                elif seg_has_moderate:
                    seg_level = "heavy"
                    seg_color = "#f97316"
                elif ambient_factor >= 1.50:
                    seg_level = "heavy" if i % 2 == 0 else "moderate"
                    seg_color = "#f97316" if i % 2 == 0 else "#f59e0b"
                elif ambient_factor >= 1.20:
                    seg_level = "moderate"
                    seg_color = "#f59e0b"
                else:
                    seg_level = "free_flow"
                    seg_color = "#10b981"

                traffic_segments.append({
                    "start": sub_pts[0],
                    "end": sub_pts[-1],
                    "coordinates": sub_pts,
                    "level": seg_level,
                    "color": seg_color
                })

        return {
            "base_duration_s": round(base_duration_s, 1),
            "total_duration_s": round(total_duration_in_traffic_s, 1),
            "traffic_delay_s": round(total_delay_s, 1),
            "traffic_congestion_level": congestion_level,
            "traffic_score": traffic_score,
            "traffic_segments": traffic_segments,
            "traffic_bottlenecks": bottlenecks
        }

    async def get_routes(
        self,
        origin: Coordinates,
        destination: Coordinates,
        incidents: List[Dict[str, Any]],
        consider_traffic: bool = True,
        traffic_mode: str = "live"
    ) -> RouteResponse:
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
        raw_routes = data.get("routes", [])

        for route_idx, route in enumerate(raw_routes):
            distance = route.get("distance", 0)
            base_duration = route.get("duration", 0)
            
            # Simple geometry extraction
            geom_coords = route.get("geometry", {}).get("coordinates", [])
            route_geometry = [{"lat": c[1], "lon": c[0]} for c in geom_coords]
            
            # Match predefined flood incidents
            matched = self.match_incidents_to_route(route_geometry, incidents)
            
            critical_hazards = 0
            worst_score = 100
            
            for inc in matched:
                score = inc.get("safety_score")
                if score is not None:
                    worst_score = min(worst_score, score)
                if inc.get("risk_level") == "critical" or float(inc.get("estimated_depth_cm") or 0) >= 30:
                    critical_hazards += 1

            # Analyze traffic conditions along the corridor
            traffic_res = self.analyze_traffic_conditions(
                route_geometry=route_geometry,
                base_duration_s=base_duration,
                distance_m=distance,
                matched_incidents=matched,
                route_index=route_idx,
                consider_traffic=consider_traffic,
                traffic_mode=traffic_mode
            )

            # Composite viability score blending flood safety (60%) and traffic flow (40%)
            if critical_hazards > 0:
                # Road closure / stall hazard: severely penalized
                composite_score = min(worst_score, 30)
            else:
                composite_score = round(0.60 * worst_score + 0.40 * traffic_res["traffic_score"])

            # Synthesize recommendation reasoning considering both factors
            delay_min = max(0, round(traffic_res["traffic_delay_s"] / 60))
            total_min = max(1, round(traffic_res["total_duration_s"] / 60))
            cong_label = traffic_res["traffic_congestion_level"].replace("_", " ").title()

            if critical_hazards > 0:
                reason = f"Hazard Warning: Intersects {critical_hazards} critical flood zone(s) with severe traffic gridlock (+{delay_min} min delay). Highly unsafe."
            elif not matched:
                if traffic_res["traffic_score"] >= 80:
                    reason = f"Recommended: Optimal flood-safe path with smooth {cong_label.lower()} traffic ({total_min} min, +{delay_min} min delay, 0 flood hazards)."
                else:
                    reason = f"Recommended: Clear of flood hazards, with {cong_label.lower()} commuter traffic ({total_min} min, +{delay_min} min delay)."
            else:
                reason = f"Caution: Passes near moderate waterlogging with {cong_label.lower()} traffic ({total_min} min, +{delay_min} min delay)."

            route_coords_list = [Coordinates(lat=c[1], lon=c[0]) for c in geom_coords]

            options.append(
                RouteOption(
                    total_distance_m=distance,
                    total_duration_s=traffic_res["total_duration_s"],
                    base_duration_s=traffic_res["base_duration_s"],
                    traffic_delay_s=traffic_res["traffic_delay_s"],
                    traffic_congestion_level=traffic_res["traffic_congestion_level"],
                    traffic_score=traffic_res["traffic_score"],
                    composite_score=composite_score,
                    segments=[
                        RouteSegment(
                            geometry="full_route",
                            distance_m=distance,
                            duration_s=traffic_res["total_duration_s"],
                            risk_level="critical" if critical_hazards > 0 else ("moderate" if matched else "low"),
                            safety_score=worst_score,
                            traffic_level=traffic_res["traffic_congestion_level"],
                            traffic_delay_s=traffic_res["traffic_delay_s"]
                        )
                    ],
                    overall_safety_score=worst_score,
                    critical_hazards=critical_hazards,
                    recommendation_reason=reason,
                    coordinates=route_coords_list,
                    traffic_segments=traffic_res["traffic_segments"],
                    traffic_bottlenecks=traffic_res["traffic_bottlenecks"]
                )
            )

        # Sort options:
        # 1. Routes with 0 critical flood hazards (passable) prioritized over impassable routes
        # 2. Higher composite viability score (blending flood safety + traffic efficiency)
        # 3. Lower total travel time in traffic
        # 4. Lower total distance
        options.sort(key=lambda x: (
            1 if x.critical_hazards == 0 else 0,
            x.composite_score if x.composite_score is not None else x.overall_safety_score,
            -x.total_duration_s,
            -x.total_distance_m
        ), reverse=True)
        
        recommended = options[0] if options else None
        alternatives = options[1:] if len(options) > 1 else []

        if recommended and recommended.critical_hazards > 0:
            recommended.recommendation_reason = "No completely safe route available. Proceed with extreme caution due to critical flood submersion."

        return RouteResponse(
            origin=origin,
            destination=destination,
            traffic_considered=consider_traffic,
            traffic_summary={
                "traffic_mode": traffic_mode,
                "considered": consider_traffic,
                "routes_evaluated": len(options)
            },
            recommended_route=recommended,
            alternative_routes=alternatives
        )

routing_service = RoutingService()
