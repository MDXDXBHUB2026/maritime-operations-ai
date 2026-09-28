"""Central, append-only audit trail persisted in the backend database."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEventRecord
from app.domain.models import AuditEvent


def _to_model(row: AuditEventRecord) -> AuditEvent:
    return AuditEvent(
        event_id=row.id,
        timestamp=row.timestamp,
        actor=row.actor,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        previous_state=row.previous_state,
        new_state=row.new_state,
        decision_id=row.decision_id,
        human_approval=row.human_approval,
        details=row.details,
    )


class AuditService:
    """Records are only ever added, never updated or deleted, through this service."""

    def record(
        self,
        session: Session,
        *,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: str,
        previous_state: str | None,
        new_state: str | None,
        decision_id: str | None = None,
        human_approval: dict[str, Any] | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditEventRecord:
        # Added to the caller's transaction so the state change and its audit event
        # are committed (or rolled back) together.
        row = AuditEventRecord(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(UTC),
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_state=previous_state,
            new_state=new_state,
            decision_id=decision_id,
            human_approval=human_approval,
            details=details,
        )
        session.add(row)
        return row

    def list_events(
        self,
        session: Session,
        *,
        decision_id: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        stmt = select(AuditEventRecord)
        if decision_id:
            stmt = stmt.where(AuditEventRecord.decision_id == decision_id)
        if entity_type:
            stmt = stmt.where(AuditEventRecord.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditEventRecord.entity_id == entity_id)
        stmt = stmt.order_by(AuditEventRecord.timestamp.desc()).limit(limit).offset(offset)
        return [_to_model(row) for row in session.scalars(stmt)]
