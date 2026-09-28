from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_maritime_service
from app.domain.models import ID_PATTERN, VesselRecord
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/vessels", tags=["vessels"])
Service = Annotated[MaritimeService, Depends(get_maritime_service)]


@router.get("", response_model=list[VesselRecord])
def list_vessels(service: Service) -> list[dict]:
    return service.list_vessels()


@router.get("/{vessel_id}", response_model=VesselRecord)
def get_vessel(service: Service, vessel_id: Annotated[str, Path(pattern=ID_PATTERN)]) -> dict:
    return service.get_vessel(vessel_id)
