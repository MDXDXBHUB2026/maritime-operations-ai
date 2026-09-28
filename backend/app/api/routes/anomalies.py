from typing import Annotated

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_maritime_service
from app.domain.models import ID_PATTERN, AnomalyRecord
from app.services.maritime_service import MaritimeService

router = APIRouter(prefix="/anomalies", tags=["anomalies"])
Service = Annotated[MaritimeService, Depends(get_maritime_service)]


@router.get("", response_model=list[AnomalyRecord])
def list_anomalies(service: Service) -> list[dict]:
    return service.list_anomalies()


@router.get("/{anomaly_id}", response_model=AnomalyRecord)
def get_anomaly(service: Service, anomaly_id: Annotated[str, Path(pattern=ID_PATTERN)]) -> dict:
    return service.get_anomaly(anomaly_id)
