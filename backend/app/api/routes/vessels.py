from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import EntityId, MaritimeDep
from app.domain.models import Vessel

router = APIRouter(prefix="/vessels", tags=["vessels"])


@router.get("", response_model=list[Vessel])
def list_vessels(
    maritime: MaritimeDep,
    operational_status: str | None = Query(default=None, max_length=64),
) -> list[dict[str, Any]]:
    return maritime.list_vessels(operational_status=operational_status)


@router.get("/{vessel_id}", response_model=Vessel)
def get_vessel(vessel_id: EntityId, maritime: MaritimeDep) -> dict[str, Any]:
    return maritime.get_vessel(vessel_id)
