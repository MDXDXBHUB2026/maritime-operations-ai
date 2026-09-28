"""Append-only audit trail. Events are written in the same transaction as the state change they record."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.domain.enums import AuditAction, DecisionStatus, EntityType


class AuditService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def record(
        self,
        *,
        actor: str,
        action: AuditAction,
        entity_type: EntityType,
        entity_id: str,
        previous_state: Optional[DecisionStatus],
        new_state: Optional[DecisionStatus],
        decision_id: Optional[str],
        human_approval: Optional[dict[str, Any]] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> AuditEvent:
        event = AuditEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc),
            actor=actor,
            action=action.value,
            entity_type=entity_type.value,
            entity_id=entity_id,
            previous_state=previous_state.value if previous_state else None,
            new_state=new_state.value if new_state else None,
            decision_id=decision_id,
            human_approval=human_approval,
            details=details,
        )
        self.session.add(event)
        return event

    def list(self, decision_id: Optional[str] = None, entity_id: Optional[str] = None,
             limit: int = 100, offset: int = 0) -> list[AuditEvent]:
        stmt = select(AuditEvent)
        if decision_id:
            stmt = stmt.where(AuditEvent.decision_id == decision_id)
        if entity_id:
            stmt = stmt.where(AuditEvent.entity_id == entity_id)
        stmt = stmt.order_by(AuditEvent.timestamp.desc(), AuditEvent.id).limit(limit).offset(offset)
        return list(self.session.scalars(stmt))
