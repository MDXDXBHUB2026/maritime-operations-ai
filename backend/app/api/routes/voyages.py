from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import EntityId, MaritimeDep
from app.domain.models import VoyagePlan

router = APIRouter(prefix="/voyages", tags=["voyages"])


@router.get("")
def list_voyages(maritime: MaritimeDep) -> list[dict[str, Any]]:
    """Voyage performance summaries (voyages dataset)."""
    return maritime.list_voyages()


@router.get("/plans", response_model=list[VoyagePlan])
def list_voyage_plans(
    maritime: MaritimeDep, vessel_id: str | None = Query(default=None, max_length=64)
) -> list[dict[str, Any]]:
    """Detailed voyage plans used by voyage optimisation and the voyage agent."""
    return maritime.list_voyage_plans(vessel_id=vessel_id)


@router.get("/plans/{voyage_id}", response_model=VoyagePlan)
def get_voyage_plan(voyage_id: EntityId, maritime: MaritimeDep) -> dict[str, Any]:
    return maritime.get_voyage_plan(voyage_id)
