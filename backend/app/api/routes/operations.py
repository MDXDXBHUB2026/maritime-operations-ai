"""Read-only operational datasets needed for frontend parity in API mode."""

from typing import Any

from fastapi import APIRouter

from app.api.deps import MaritimeDep

router = APIRouter(tags=["operations"])


@router.get("/alerts")
def list_alerts(maritime: MaritimeDep) -> list[dict[str, Any]]:
    return maritime.list_alerts()


@router.get("/automation-tasks")
def list_automation_tasks(maritime: MaritimeDep) -> list[dict[str, Any]]:
    return maritime.list_automation_tasks()
