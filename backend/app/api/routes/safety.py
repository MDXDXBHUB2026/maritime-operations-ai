from typing import Any

from fastapi import APIRouter, Query

from app.api.deps import EntityId, MaritimeDep
from app.domain.enums import Severity
from app.domain.models import SafetyEvent

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("", response_model=list[SafetyEvent])
def list_safety_events(
    maritime: MaritimeDep,
    severity: Severity | None = None,
    status: str | None = Query(default=None, max_length=64),
) -> list[dict[str, Any]]:
    return maritime.list_safety_events(severity=severity.value if severity else None, status=status)


@router.get("/{event_id}", response_model=SafetyEvent)
def get_safety_event(event_id: EntityId, maritime: MaritimeDep) -> dict[str, Any]:
    return maritime.get_safety_event(event_id)
