from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_maritime_service
from app.domain.models import VoyagePlanRecord
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/voyages", tags=["voyages"])


@router.get("", response_model=list[VoyagePlanRecord], summary="List voyage plans")
def list_voyage_plans(service: Annotated[MaritimeService, Depends(get_maritime_service)]) -> list[dict]:
    return service.list_voyage_plans()
