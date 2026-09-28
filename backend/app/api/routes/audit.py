from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.domain.models import ID_PATTERN, AuditEventOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=list[AuditEventOut])
def list_audit_events(
    session: Annotated[Session, Depends(get_session)],
    decision_id: Annotated[Optional[str], Query(pattern=r"^[0-9a-fA-F\-]{36}$")] = None,
    entity_id: Annotated[Optional[str], Query(pattern=ID_PATTERN)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditEventOut]:
    events = AuditService(session).list(decision_id=decision_id, entity_id=entity_id, limit=limit, offset=offset)
    return [
        AuditEventOut(event_id=e.id, timestamp=e.timestamp, actor=e.actor, action=e.action,
                      entity_type=e.entity_type, entity_id=e.entity_id, previous_state=e.previous_state,
                      new_state=e.new_state, decision_id=e.decision_id, human_approval=e.human_approval,
                      details=e.details)
        for e in events
    ]
