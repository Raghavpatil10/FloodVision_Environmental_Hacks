from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import analysis, incidents, routes, auth, admin
from .services.auth_service import auth_service

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # If ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD are set in .env, seed automatically
    auth_service.seed_initial_admin_if_configured()
    yield

app = FastAPI(
    title="FloodVision API",
    version="0.1.0",
    description="Flood depth estimation, risk monitoring, and routing platform.",
    lifespan=lifespan
)

frontend_origins = list(set([
    settings.FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(routes.router, prefix="/api", tags=["routes"])

