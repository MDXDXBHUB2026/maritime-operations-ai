from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import EntityId, MaritimeDep
from app.domain.enums import Severity
from app.domain.models import MaintenanceAsset

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

# Static sub-paths are declared before "/{asset_id}" so they are matched first.


@router.get("/history")
def maintenance_history(
    maritime: MaritimeDep, asset_id: str | None = Query(default=None, max_length=64)
) -> list[dict[str, Any]]:
    return maritime.list_maintenance_history(asset_id=asset_id)


@router.get("/work-orders")
def work_orders(
    maritime: MaritimeDep, asset_id: str | None = Query(default=None, max_length=64)
) -> list[dict[str, Any]]:
    return maritime.list_work_orders(asset_id=asset_id)


@router.get("/equipment")
def equipment(maritime: MaritimeDep) -> list[dict[str, Any]]:
    return maritime.list_equipment()


@router.get("", response_model=list[MaintenanceAsset])
def list_assets(
    maritime: MaritimeDep,
    criticality: Severity | None = None,
    vessel: str | None = Query(default=None, max_length=128),
) -> list[dict[str, Any]]:
    return maritime.list_maintenance_assets(
        criticality=criticality.value if criticality else None, vessel=vessel
    )


@router.get("/{asset_id}", response_model=MaintenanceAsset)
def get_asset(asset_id: EntityId, maritime: MaritimeDep) -> dict[str, Any]:
    return maritime.get_maintenance_asset(asset_id)
