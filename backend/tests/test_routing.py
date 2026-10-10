import pytest
from backend.app.services.routing_service import routing_service
from backend.app.schemas.routing import Coordinates

def test_calculate_distance():
    # known distance between points
    dist = routing_service.calculate_distance(0, 0, 0, 1) # 1 degree long at equator is ~111km
    assert 111000 < dist < 112000

def test_match_incidents():
    route_geom = [{"lat": 10.0, "lon": 10.0}, {"lat": 10.1, "lon": 10.1}]
    # incident very close to route pt 1
    incidents = [{"latitude": 10.0001, "longitude": 10.0001, "safety_score": 20}]
    matched = routing_service.match_incidents_to_route(route_geom, incidents)
    assert len(matched) == 1
    
    # incident far from route
    incidents_far = [{"latitude": 11.0, "longitude": 11.0, "safety_score": 20}]
    matched_far = routing_service.match_incidents_to_route(route_geom, incidents_far)
    assert len(matched_far) == 0

@pytest.mark.asyncio
async def test_get_routes_mocked(mocker):
    # Mock httpx.AsyncClient.get to return a dummy OSRM response
    class MockResponse:
        def raise_for_status(self): pass
        def json(self):
            return {
                "routes": [
                    {
                        "distance": 1000,
                        "duration": 300,
                        "geometry": {"coordinates": [[10.0, 10.0], [10.1, 10.1]]}
                    },
                    {
                        "distance": 1500,
                        "duration": 400,
                        "geometry": {"coordinates": [[10.0, 10.0], [10.2, 10.2]]}
                    }
                ]
            }

    mocker.patch('httpx.AsyncClient.get', return_value=MockResponse())
    
    origin = Coordinates(lat=10.0, lon=10.0)
    dest = Coordinates(lat=10.1, lon=10.1)
    
    # Incident on the first route
    incidents = [{"latitude": 10.1, "longitude": 10.1, "safety_score": 10, "risk_level": "critical"}]
    
    res = await routing_service.get_routes(origin, dest, incidents)
    # The first route has a critical incident, second route does not.
    # Second route should be recommended over the first.
    assert res.recommended_route.total_distance_m == 1500
    assert len(res.alternative_routes) == 1
    assert res.alternative_routes[0].total_distance_m == 1000
    assert res.recommended_route.traffic_delay_s >= 0
    assert res.recommended_route.traffic_congestion_level in ["free_flow", "moderate", "heavy", "severe"]

def test_analyze_traffic_conditions():
    route_geom = [{"lat": 21.14, "lon": 79.08}, {"lat": 21.15, "lon": 79.09}]
    base_duration = 600.0  # 10 min
    distance = 5000.0

    # Clean route in free flow mode
    res_free = routing_service.analyze_traffic_conditions(
        route_geom, base_duration, distance, [], consider_traffic=True, traffic_mode="free_flow"
    )
    assert res_free["total_duration_s"] == 600.0
    assert res_free["traffic_delay_s"] == 0.0
    assert res_free["traffic_score"] >= 95
    assert res_free["traffic_congestion_level"] == "free_flow"

    # Route during rush hour mode
    res_rush = routing_service.analyze_traffic_conditions(
        route_geom, base_duration, distance, [], consider_traffic=True, traffic_mode="rush_hour"
    )
    assert res_rush["total_duration_s"] > 600.0
    assert res_rush["traffic_delay_s"] > 0
    assert res_rush["traffic_score"] < 70

    # Route with waterlogging incident creating a bottleneck
    incidents = [{"latitude": 21.145, "longitude": 79.085, "estimated_depth_cm": 22.0, "risk_level": "moderate"}]
    res_flood = routing_service.analyze_traffic_conditions(
        route_geom, base_duration, distance, incidents, consider_traffic=True, traffic_mode="free_flow"
    )
    assert len(res_flood["traffic_bottlenecks"]) == 1
    assert res_flood["traffic_bottlenecks"][0]["severity"] == "heavy"
    assert res_flood["traffic_delay_s"] >= 180.0

@pytest.mark.asyncio
async def test_traffic_aware_route_selection_when_both_flood_safe(mocker):
    # Two routes both have NO flood incidents.
    # Route 1 has distance 2000, duration 400 (faster free flow).
    # Route 2 has distance 2500, duration 600.
    class MockResponse:
        def raise_for_status(self): pass
        def json(self):
            return {
                "routes": [
                    {
                        "distance": 2000,
                        "duration": 400,
                        "geometry": {"coordinates": [[21.10, 79.05], [21.11, 79.06]]}
                    },
                    {
                        "distance": 2500,
                        "duration": 600,
                        "geometry": {"coordinates": [[21.10, 79.05], [21.12, 79.07]]}
                    }
                ]
            }

    mocker.patch('httpx.AsyncClient.get', return_value=MockResponse())

    origin = Coordinates(lat=21.10, lon=79.05)
    dest = Coordinates(lat=21.11, lon=79.06)

    # Empty incidents list - pure traffic comparison
    res = await routing_service.get_routes(origin, dest, [], consider_traffic=True, traffic_mode="rush_hour")
    assert res.traffic_considered is True
    assert res.recommended_route.total_distance_m == 2000
    assert res.recommended_route.composite_score is not None
    assert "traffic" in res.recommended_route.recommendation_reason.lower()

