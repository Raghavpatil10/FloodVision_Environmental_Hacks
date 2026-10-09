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
