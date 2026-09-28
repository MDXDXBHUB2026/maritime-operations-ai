"""Decision lifecycle with a human approval gate.

States: PROPOSED -> UNDER_REVIEW -> APPROVED -> EXECUTED, with REJECTED and CANCELLED
as terminal exits. Rules enforced here (not in the UI):

* Agents can only create PROPOSED decisions. Nothing moves to EXECUTED without a named
  human first approving it; PROPOSED -> EXECUTED is never a valid transition.
* Safety-critical recommendations must be explicitly taken UNDER_REVIEW before approval.
* Human transitions reject reserved non-human actor identities (agent:*, system*, ...).
* Every transition writes an audit event in the same database transaction.
* Execution is simulated in Phase 1: no operational system or dataset is modified.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.manager_agent import ManagerAgent
from app.db.models import DecisionRecord
from app.domain.enums import AgentKind, DecisionStatus, Severity
from app.domain.models import AgentRecommendation, Decision
from app.errors import ForbiddenActorError, InvalidTransitionError, NotFoundError
from app.services.audit_service import AuditService
from app.services.maritime_service import MaritimeService

S = DecisionStatus

ALLOWED_TRANSITIONS: dict[DecisionStatus, frozenset[DecisionStatus]] = {
    S.PROPOSED: frozenset({S.UNDER_REVIEW, S.APPROVED, S.REJECTED, S.CANCELLED}),
    S.UNDER_REVIEW: frozenset({S.APPROVED, S.REJECTED, S.CANCELLED}),
    S.APPROVED: frozenset({S.EXECUTED, S.CANCELLED}),
    S.REJECTED: frozenset(),
    S.EXECUTED: frozenset(),
    S.CANCELLED: frozenset(),
}

RESERVED_ACTOR_PREFIXES = ("agent:", "system", "ai:", "automation")


def _now() -> datetime:
    return datetime.now(UTC)


def _require_human(actor: str) -> str:
    normalized = actor.strip()
    if normalized.lower().startswith(RESERVED_ACTOR_PREFIXES):
        raise ForbiddenActorError(
            f"Actor '{normalized}' is reserved for non-human components and cannot "
            "review, approve, reject, execute or cancel decisions."
        )
    return normalized


def to_decision(row: DecisionRecord) -> Decision:
    return Decision(
        recommendation_id=row.id,
        status=DecisionStatus(row.status),
        agent=AgentKind(row.agent),
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        severity=Severity(row.severity),
        summary=row.summary,
        requires_human_approval=row.requires_human_approval,
        safety_critical=row.safety_critical,
        recommendation=AgentRecommendation.model_validate(row.recommendation),
        created_at=row.created_at,
        updated_at=row.updated_at,
        reviewed_by=row.reviewed_by,
        reviewed_at=row.reviewed_at,
        decided_by=row.decided_by,
        decided_at=row.decided_at,
        decision_comment=row.decision_comment,
        executed_at=row.executed_at,
        execution_result=row.execution_result,
    )


class DecisionService:
    def __init__(
        self, maritime: MaritimeService, manager: ManagerAgent, audit: AuditService
    ) -> None:
        self._maritime = maritime
        self._manager = manager
        self._audit = audit

    # ------------------------------------------------------------------ generation
    def generate(
        self, session: Session, kind: AgentKind, entity_id: str, requested_by: str
    ) -> Decision:
        context = self._maritime.build_context(kind, entity_id)
        recommendation = self._manager.recommend(context)
        now = _now()
        row = DecisionRecord(
            id=str(uuid.uuid4()),
            agent=recommendation.agent.value,
            entity_type=recommendation.entity_type,
            entity_id=recommendation.entity_id,
            severity=recommendation.severity.value,
            summary=recommendation.summary,
            status=S.PROPOSED.value,
            requires_human_approval=recommendation.requires_human_approval,
            safety_critical=recommendation.safety_critical,
            recommendation=recommendation.model_dump(mode="json"),
            created_at=now,
            updated_at=now,
        )
        try:
            session.add(row)
            session.flush()
            self._audit.record(
                session,
                actor=f"agent:{kind.value}",
                action="decision.proposed",
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                previous_state=None,
                new_state=S.PROPOSED.value,
                decision_id=row.id,
                details={
                    "requested_by": requested_by,
                    "provider": recommendation.provider,
                    "provider_fallback_used": recommendation.provider_fallback_used,
                    "severity": recommendation.severity.value,
                    "safety_critical": recommendation.safety_critical,
                },
            )
            session.commit()
        except Exception:
            session.rollback()
            raise
        return to_decision(row)

    # ------------------------------------------------------------------ queries
    def get(self, session: Session, decision_id: str) -> Decision:
        return to_decision(self._load(session, decision_id))

    def _load(self, session: Session, decision_id: str) -> DecisionRecord:
        row = session.get(DecisionRecord, decision_id)
        if row is None:
            raise NotFoundError(f"Decision '{decision_id}' not found")
        return row

    # ------------------------------------------------------------------ transitions
    def review(
        self, session: Session, decision_id: str, actor: str, comment: str | None
    ) -> Decision:
        actor = _require_human(actor)
        row = self._load(session, decision_id)
        self._check(row, S.UNDER_REVIEW)
        row.reviewed_by, row.reviewed_at = actor, _now()
        return self._transition(
            session, row, S.UNDER_REVIEW, actor, "decision.review_started", {"comment": comment}
        )

    def approve(
        self, session: Session, decision_id: str, actor: str, comment: str | None
    ) -> Decision:
        actor = _require_human(actor)
        row = self._load(session, decision_id)
        self._check(row, S.APPROVED)
        if row.safety_critical and row.status == S.PROPOSED.value:
            raise InvalidTransitionError(
                "Safety-critical recommendations must be placed UNDER_REVIEW before approval."
            )
        now = _now()
        row.decided_by, row.decided_at, row.decision_comment = actor, now, comment
        approval = {
            "approved": True,
            "approved_by": actor,
            "approved_at": now.isoformat(),
            "comment": comment,
        }
        return self._transition(
            session, row, S.APPROVED, actor, "decision.approved", None, approval
        )

    def reject(self, session: Session, decision_id: str, actor: str, reason: str) -> Decision:
        actor = _require_human(actor)
        row = self._load(session, decision_id)
        self._check(row, S.REJECTED)
        now = _now()
        row.decided_by, row.decided_at, row.decision_comment = actor, now, reason
        approval = {
            "approved": False,
            "rejected_by": actor,
            "rejected_at": now.isoformat(),
            "reason": reason,
        }
        return self._transition(
            session, row, S.REJECTED, actor, "decision.rejected", None, approval
        )

    def execute(self, session: Session, decision_id: str, actor: str) -> Decision:
        """Simulated execution of an APPROVED decision. Modifies no operational data."""
        actor = _require_human(actor)
        row = self._load(session, decision_id)
        self._check(row, S.EXECUTED)
        if not row.decided_by:
            raise InvalidTransitionError("Decision has no recorded human approval.")
        row.executed_at = _now()
        row.execution_result = {
            "mode": "simulated",
            "executed_by": actor,
            "message": (
                "Simulated execution only. No vessel, maintenance, voyage or safety system "
                "was modified. Integrate an execution tool in a later phase."
            ),
        }
        return self._transition(
            session,
            row,
            S.EXECUTED,
            actor,
            "decision.executed",
            {"mode": "simulated", "approved_by": row.decided_by},
        )

    def cancel(self, session: Session, decision_id: str, actor: str, reason: str) -> Decision:
        actor = _require_human(actor)
        row = self._load(session, decision_id)
        self._check(row, S.CANCELLED)
        return self._transition(
            session, row, S.CANCELLED, actor, "decision.cancelled", {"reason": reason}
        )

    # ------------------------------------------------------------------ internals
    @staticmethod
    def _check(row: DecisionRecord, target: DecisionStatus) -> None:
        current = DecisionStatus(row.status)
        if target not in ALLOWED_TRANSITIONS[current]:
            raise InvalidTransitionError(
                f"Transition {current.value} -> {target.value} is not permitted."
            )

    def _transition(
        self,
        session: Session,
        row: DecisionRecord,
        target: DecisionStatus,
        actor: str,
        action: str,
        details: dict[str, Any] | None,
        human_approval: dict[str, Any] | None = None,
    ) -> Decision:
        try:
            previous = row.status
            row.status = target.value
            row.updated_at = _now()
            self._audit.record(
                session,
                actor=actor,
                action=action,
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                previous_state=previous,
                new_state=target.value,
                decision_id=row.id,
                human_approval=human_approval,
                details=details,
            )
            session.commit()
        except Exception:
            session.rollback()
            raise
        return to_decision(row)
