from fastapi import APIRouter, Depends

from app.api.deps import get_current_principal
from app.api.routes import (
    anomalies,
    audit,
    auth,
    datasets,
    decisions,
    health,
    maintenance,
    safety,
    sites,
    users,
    vessels,
    voyages,
)

api_router = APIRouter()

# Public: health check and login.
api_router.include_router(health.router)
api_router.include_router(auth.router)

# Everything else requires an authenticated session. Role checks are applied in the services.
for module in (vessels, anomalies, maintenance, voyages, safety, sites, datasets, decisions, audit):
    api_router.include_router(module.router, dependencies=[Depends(get_current_principal)])

# User administration enforces the Administrator role itself.
api_router.include_router(users.router)
