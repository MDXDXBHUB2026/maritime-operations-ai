from fastapi import APIRouter, Request
from sqlalchemy import text

from app import __version__
from app.domain.models import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(request: Request) -> HealthOut:
    state = request.app.state
    try:
        with state.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = f"ok ({state.engine.dialect.name})"
    except Exception:  # noqa: BLE001 - health must report, not raise
        db_status = "unavailable"
    repo_ok = state.repository.is_available()
    return HealthOut(
        status="ok" if db_status.startswith("ok") and repo_ok else "degraded",
        version=__version__,
        database=db_status,
        data_source=f"{state.repository.source_name} ({'ok' if repo_ok else 'unavailable'})",
        ai_provider=state.provider.name,
        ai_provider_available=state.provider.is_available(),
    )
