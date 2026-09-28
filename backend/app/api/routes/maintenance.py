from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_maritime_service
from app.domain.models import MaintenanceAssetRecord
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceAssetRecord])
def list_maintenance_assets(service: Annotated[MaritimeService, Depends(get_maritime_service)]) -> list[dict]:
    return service.list_maintenance_assets()
