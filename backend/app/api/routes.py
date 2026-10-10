from fastapi import APIRouter, HTTPException
from ..schemas.routing import RouteRequest, RouteResponse
from ..services.routing_service import routing_service
from ..repositories.incident_repo import incident_repo

router = APIRouter()

@router.post("/routes/plan", response_model=RouteResponse)
async def plan_route(request: RouteRequest):
    # Fetch recent active incidents to evaluate route
    incidents = incident_repo.list_recent_incidents(max_age_hours=24)
    
    try:
        response = await routing_service.get_routes(
            origin=request.origin,
            destination=request.destination,
            incidents=incidents,
            consider_traffic=request.consider_traffic if request.consider_traffic is not None else True,
            traffic_mode=request.traffic_mode or "live"
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
