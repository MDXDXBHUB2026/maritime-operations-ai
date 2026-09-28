from fastapi import APIRouter, Query

from app.api.deps import ContainerDep, SessionDep
from app.domain.models import ENTITY_ID_PATTERN, AuditEvent

router = APIRouter(tags=["audit"])


@router.get("/audit-events", response_model=list[AuditEvent])
def list_audit_events(
    container: ContainerDep,
    session: SessionDep,
    decision_id: str | None = Query(default=None, pattern=r"^[0-9a-fA-F-]{36}$"),
    entity_type: str | None = Query(default=None, pattern=r"^[a-z_]{1,64}$"),
    entity_id: str | None = Query(default=None, pattern=ENTITY_ID_PATTERN),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AuditEvent]:
    return container.audit.list_events(
        session,
        decision_id=decision_id,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )
