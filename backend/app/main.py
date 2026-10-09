from fastapi import FastAPI
from .config import settings
from .api import analysis, incidents, routes

app = FastAPI(
    title="FloodVision API",
    version="0.1.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Include routers (they may be empty placeholders for now)
app.include_router(analysis.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(routes.router, prefix="/api")
