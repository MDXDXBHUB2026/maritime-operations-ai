from fastapi import APIRouter
from sqlalchemy import text

from app.ai.provider import FallbackProvider
from app.api.deps import ContainerDep
from app.domain.models import HealthResponse, ProviderStatus

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(container: ContainerDep) -> HealthResponse:
    try:
        with container.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001 - health must report, not raise
        database = "unavailable"

    provider = container.provider
    if isinstance(provider, FallbackProvider):
        primary_ok = provider.primary.is_available()
        status = ProviderStatus(
            configured=provider.primary.name,
            active=provider.primary.name if primary_ok else provider.fallback.name,
            available=True,
            detail=None
            if primary_ok
            else f"{provider.primary.name} unreachable; deterministic fallback active",
        )
    else:
        status = ProviderStatus(
            configured=provider.name, active=provider.name, available=provider.is_available()
        )

    data_ok = container.maritime.repository_healthy()
    overall = "ok" if database == "ok" and data_ok else "degraded"
    return HealthResponse(
        status=overall,
        version=container.settings.app_version,
        environment=container.settings.environment,
        database=database,
        data_source=f"{container.maritime.source_name}:{'ok' if data_ok else 'unavailable'}",
        ai_provider=status,
    )
