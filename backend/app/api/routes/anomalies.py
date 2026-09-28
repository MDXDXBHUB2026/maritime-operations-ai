from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import EntityId, MaritimeDep
from app.domain.enums import Severity
from app.domain.models import Anomaly

router = APIRouter(tags=["anomalies"])


@router.get("/anomalies", response_model=list[Anomaly])
def list_anomalies(
    maritime: MaritimeDep,
    severity: Severity | None = None,
    status: str | None = Query(default=None, max_length=64),
    vessel: str | None = Query(default=None, max_length=128),
) -> list[dict[str, Any]]:
    return maritime.list_anomalies(
        severity=severity.value if severity else None, status=status, vessel=vessel
    )


@router.get("/anomalies/{anomaly_id}", response_model=Anomaly)
def get_anomaly(anomaly_id: EntityId, maritime: MaritimeDep) -> dict[str, Any]:
    return maritime.get_anomaly(anomaly_id)


@router.get("/anomalies/{anomaly_id}/sensor-readings")
def anomaly_sensor_readings(anomaly_id: EntityId, maritime: MaritimeDep) -> list[dict[str, Any]]:
    maritime.get_anomaly(anomaly_id)  # 404 for unknown anomaly
    return maritime.list_sensor_readings(anomaly_id=anomaly_id)


@router.get("/sensor-readings")
def list_sensor_readings(maritime: MaritimeDep) -> list[dict[str, Any]]:
    return maritime.list_sensor_readings()
