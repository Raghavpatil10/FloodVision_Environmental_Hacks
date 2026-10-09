from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import analysis, incidents, routes

app = FastAPI(
    title="FloodVision API",
    version="0.1.0",
    description="Flood depth estimation, risk monitoring, and routing platform."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(routes.router, prefix="/api", tags=["routes"])
