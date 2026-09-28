from fastapi import APIRouter

from app.api.routes import (
    anomalies,
    audit,
    decisions,
    health,
    maintenance,
    operations,
    safety,
    vessels,
    voyages,
)

API_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_PREFIX)
for module in (
    health,
    vessels,
    anomalies,
    maintenance,
    voyages,
    safety,
    operations,
    decisions,
    audit,
):
    api_router.include_router(module.router)
