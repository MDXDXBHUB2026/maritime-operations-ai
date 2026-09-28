from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_maritime_service
from app.domain.models import Site
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=list[Site], summary="Vessels and terminals that decisions and scopes refer to")
def list_sites(service: Annotated[MaritimeService, Depends(get_maritime_service)]) -> list[Site]:
    return service.list_sites()
