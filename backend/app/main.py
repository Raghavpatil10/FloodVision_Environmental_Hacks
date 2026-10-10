from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import analysis, incidents, routes, auth, admin, admin_requests, images, superadmin

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
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
app.include_router(auth.router, tags=["auth-root"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(admin.router, tags=["admin-root"])
app.include_router(admin_requests.router, prefix="/api", tags=["admin-requests"])
app.include_router(admin_requests.router, tags=["admin-requests-root"])
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(images.router, tags=["images-root"])
app.include_router(superadmin.router, prefix="/api", tags=["superadmin"])
app.include_router(superadmin.router, tags=["superadmin-root"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(analysis.router, tags=["analysis-root"])
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(incidents.router, tags=["incidents-root"])
app.include_router(routes.router, prefix="/api", tags=["routes"])
app.include_router(routes.router, tags=["routes-root"])

