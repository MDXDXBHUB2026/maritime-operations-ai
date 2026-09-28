from fastapi import APIRouter

from app.api.routes import anomalies, audit, datasets, decisions, health, maintenance, safety, vessels, voyages

api_router = APIRouter()
for module in (health, vessels, anomalies, maintenance, voyages, safety, datasets, decisions, audit):
    api_router.include_router(module.router)
