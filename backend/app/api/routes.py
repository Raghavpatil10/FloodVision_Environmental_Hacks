from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..schemas.routing import RouteRequest, RouteResponse, GeocodeResult, Coordinates
from ..services.routing_service import routing_service
from ..repositories.incident_repo import incident_repo

router = APIRouter()

@router.get("/routes/geocode", response_model=List[GeocodeResult])
async def geocode_query(q: str = Query(..., min_length=1, description="Location search query")):
    """Searches location names and landmarks, returning coordinates and display names."""
    results = await routing_service.search_locations(q)
    return results

@router.get("/routes/locate-ip")
async def locate_by_ip():
    """Detects user area and coordinates using IP geolocation fallback."""
    return await routing_service.detect_ip_location()

@router.post("/routes/plan", response_model=RouteResponse)
async def plan_route(request: RouteRequest):
    """
    Plans safe route from origin to destination. Supports location names or lat/lon coordinates.
    Dynamically reroutes if flood hazards or road waterlogging reports are encountered on the direct path.
    """
    origin_coords = request.origin
    dest_coords = request.destination

    # Resolve origin name if provided and coordinates are missing
    if not origin_coords and request.origin_name:
        origin_coords = await routing_service.geocode_location(request.origin_name)
        if not origin_coords:
            raise HTTPException(status_code=400, detail=f"Could not locate start location: '{request.origin_name}'. Please verify the name or city.")

    # Resolve destination name if provided and coordinates are missing
    if not dest_coords and request.destination_name:
        dest_coords = await routing_service.geocode_location(request.destination_name)
        if not dest_coords:
            raise HTTPException(status_code=400, detail=f"Could not locate destination: '{request.destination_name}'. Please verify the name or city.")

    if not origin_coords or not dest_coords:
        raise HTTPException(status_code=400, detail="Both origin and destination (either coordinates or location names) are required.")

    # Fetch recent active incidents to evaluate route
    incidents = incident_repo.list_recent_incidents(max_age_hours=24)
    
    try:
        response = await routing_service.get_routes(origin_coords, dest_coords, incidents)
        response.origin_name = request.origin_name
        response.destination_name = request.destination_name
        return response
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
