"""Read-only pass-through for supporting datasets the frontend needs in API mode (allow-listed)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path, Request

from app.api.deps import get_maritime_service
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=list[str])
def list_datasets(request: Request) -> list[str]:
    return request.app.state.repository.available_datasets()


@router.get("/{name}", response_model=list[dict[str, Any]])
def get_dataset(
    service: Annotated[MaritimeService, Depends(get_maritime_service)],
    name: Annotated[str, Path(pattern=r"^[a-z_]{1,40}$")],
) -> list[dict]:
    return service.list_dataset(name)
