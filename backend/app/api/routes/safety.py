from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_maritime_service
from app.domain.models import SafetyEventRecord
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("", response_model=list[SafetyEventRecord], summary="List safety events")
def list_safety_events(service: Annotated[MaritimeService, Depends(get_maritime_service)]) -> list[dict]:
    return service.list_safety_events()
