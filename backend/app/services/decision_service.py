"""Decision lifecycle: agent recommendation -> human review/approval -> simulated execution.

Agents Decide; Services Execute. This service is the only component that changes
decision state, and every transition writes an audit event in the same transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.manager_agent import ManagerAgent
from app.db.models import DecisionRecord
from app.domain.enums import AgentName, AuditAction, DecisionStatus, EntityType
from app.domain.errors import (
    ForbiddenError,
    HumanApprovalRequiredError,
    InvalidTransitionError,
    NotFoundError,
)
from app.security.permissions import approver_labels, can_decide, can_generate, can_review
from app.domain.models import DecisionOut, Principal
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



class SeparationOfDutiesError(ForbiddenError):
    code = "separation_of_duties"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_out(rec: DecisionRecord) -> DecisionOut:
    return DecisionOut(
        recommendation_id=rec.id, agent=rec.agent, entity_type=rec.entity_type, entity_id=rec.entity_id,
        status=rec.status, severity=rec.severity, summary=rec.summary, rationale=rec.rationale,
        evidence=rec.evidence, recommended_actions=rec.recommended_actions, confidence=rec.confidence,
        confidence_basis=rec.confidence_basis, requires_human_approval=rec.requires_human_approval,
        safety_critical=rec.safety_critical, provider=rec.provider, created_by=rec.created_by,
        created_by_role=rec.created_by_role, created_by_user_id=rec.created_by_user_id,
        created_at=rec.created_at, updated_at=rec.updated_at, reviewed_by=rec.reviewed_by,
        decided_by=rec.decided_by, decided_by_role=rec.decided_by_role, decided_at=rec.decided_at, decision_comment=rec.decision_comment,
        execution_mode=rec.execution_mode,
    )


class DecisionService:
    def __init__(self, session: Session, maritime: MaritimeService, manager: ManagerAgent) -> None:
        self.session = session
        self.maritime = maritime
        self.manager = manager
        self.audit = AuditService(session)

    # -- queries ----------------------------------------------------------
    def _load(self, decision_id: str) -> DecisionRecord:
        rec = self.session.get(DecisionRecord, decision_id)
        if rec is None:
            raise NotFoundError(f"Decision '{decision_id}' not found")
        return rec

    def get(self, decision_id: str) -> DecisionOut:
        return to_out(self._load(decision_id))

    def list(self, status: Optional[DecisionStatus] = None, agent: Optional[AgentName] = None,
             entity_id: Optional[str] = None, limit: int = 100, offset: int = 0) -> list[DecisionOut]:
        stmt = select(DecisionRecord)
        if entity_id:
            stmt = stmt.where(DecisionRecord.entity_id == entity_id)
        if status:
            stmt = stmt.where(DecisionRecord.status == status.value)
        if agent:
            stmt = stmt.where(DecisionRecord.agent == agent.value)
        stmt = stmt.order_by(DecisionRecord.created_at.desc()).limit(limit).offset(offset)
        return [to_out(r) for r in self.session.scalars(stmt)]

    # -- authorisation ----------------------------------------------------
    @staticmethod
    def _require(allowed: bool, message: str) -> None:
        if not allowed:
            raise ForbiddenError(message)

    def _require_decider(self, rec: DecisionRecord, principal: Principal, verb: str) -> None:
        domain = AgentName(rec.agent)
        self._require(
            can_decide(principal.role, domain),
            f"{principal.role.label} cannot {verb} {domain.value} decisions; "
            f"requires {' or '.join(approver_labels(domain))}",
        )

    # -- commands ---------------------------------------------------------
    def generate(self, agent: AgentName, entity_id: str, principal: Principal) -> DecisionOut:
        self._require(can_generate(principal.role),
                      f"{principal.role.label} cannot request AI recommendations")
        context = self.maritime.build_context(agent, entity_id)
        rec_model = self.manager.recommend(context)
        now = _now()
        rec = DecisionRecord(
            id=str(uuid.uuid4()), agent=rec_model.agent.value, entity_type=rec_model.entity_type.value,
            entity_id=rec_model.entity_id, status=S.PROPOSED.value, severity=rec_model.severity.value,
            summary=rec_model.summary, rationale=rec_model.rationale,
            evidence=[e.model_dump(mode="json") for e in rec_model.evidence],
            recommended_actions=[a.model_dump(mode="json") for a in rec_model.recommended_actions],
            confidence=rec_model.confidence, confidence_basis=rec_model.confidence_basis.value,
            requires_human_approval=rec_model.requires_human_approval, safety_critical=rec_model.safety_critical,
            provider=rec_model.provider, created_by=principal.actor_label, created_by_user_id=principal.user_id,
            created_by_role=principal.role.value, created_at=now, updated_at=now,
        )
        self.session.add(rec)
        self.session.flush()
        self.audit.record_for(
            principal, action=AuditAction.RECOMMENDATION_CREATED, entity_type=EntityType.DECISION,
            entity_id=rec.id, previous_state=None, new_state=S.PROPOSED, decision_id=rec.id,
            details={"agent": rec.agent, "source_entity_type": rec.entity_type, "source_entity_id": rec.entity_id,
                     "severity": rec.severity, "provider": rec.provider, "routed_by": AgentName.MANAGER.value},
        )
        self.session.commit()
        return to_out(rec)

    def _transition(self, rec: DecisionRecord, target: DecisionStatus, principal: Principal,
                    action: AuditAction, human_approval: Optional[dict] = None,
                    details: Optional[dict] = None) -> DecisionRecord:
        current = DecisionStatus(rec.status)
        if target not in ALLOWED_TRANSITIONS[current]:
            raise InvalidTransitionError(f"Cannot move decision from {current.value} to {target.value}")
        rec.status = target.value
        rec.updated_at = _now()
        self.audit.record_for(principal, action=action, entity_type=EntityType.DECISION, entity_id=rec.id,
                              previous_state=current, new_state=target, decision_id=rec.id,
                              human_approval=human_approval, details=details)
        return rec

    def _approval_record(self, principal: Principal, approved: bool, when: datetime, text: Optional[str]) -> dict:
        return {"approved": approved, "approver": principal.actor_label, "approver_user_id": principal.user_id,
                "approver_role": principal.role.value, "decided_at": when.isoformat(),
                ("comment" if approved else "reason"): text}

    def review(self, decision_id: str, principal: Principal, comment: Optional[str]) -> DecisionOut:
        self._require(can_review(principal.role), f"{principal.role.label} cannot review decisions")
        rec = self._load(decision_id)
        rec = self._transition(rec, S.UNDER_REVIEW, principal, AuditAction.REVIEW_STARTED,
                               details={"comment": comment} if comment else None)
        rec.reviewed_by = principal.actor_label
        self.session.commit()
        return to_out(rec)

    def approve(self, decision_id: str, principal: Principal, comment: Optional[str]) -> DecisionOut:
        rec = self._load(decision_id)
        self._require_decider(rec, principal, "approve")
        if rec.safety_critical and rec.created_by_user_id == principal.user_id:
            raise SeparationOfDutiesError(
                "Safety-critical decisions need a second person: the requester cannot approve their own request")
        now = _now()
        rec = self._transition(rec, S.APPROVED, principal, AuditAction.APPROVED,
                               human_approval=self._approval_record(principal, True, now, comment))
        self._set_decided(rec, principal, now, comment)
        self.session.commit()
        return to_out(rec)

    def reject(self, decision_id: str, principal: Principal, reason: str) -> DecisionOut:
        rec = self._load(decision_id)
        self._require_decider(rec, principal, "reject")
        now = _now()
        rec = self._transition(rec, S.REJECTED, principal, AuditAction.REJECTED,
                               human_approval=self._approval_record(principal, False, now, reason))
        self._set_decided(rec, principal, now, reason)
        self.session.commit()
        return to_out(rec)

    @staticmethod
    def _set_decided(rec: DecisionRecord, principal: Principal, when: datetime, text: Optional[str]) -> None:
        rec.decided_by, rec.decided_by_user_id, rec.decided_by_role = (
            principal.actor_label, principal.user_id, principal.role.value)
        rec.decided_at, rec.decision_comment = when, text

    def execute(self, decision_id: str, principal: Principal) -> DecisionOut:
        """Simulated execution. Only reachable from APPROVED, which itself requires an authorised human."""
        rec = self._load(decision_id)
        self._require_decider(rec, principal, "execute")
        if rec.status != S.APPROVED.value or not rec.decided_by_user_id:
            raise HumanApprovalRequiredError(
                f"Decision is {rec.status}; execution requires prior human approval (APPROVED)")
        rec = self._transition(rec, S.EXECUTED, principal, AuditAction.EXECUTED_SIMULATED,
                               human_approval={"approved_by": rec.decided_by,
                                               "approved_by_role": rec.decided_by_role,
                                               "approved_at": rec.decided_at.isoformat() if rec.decided_at else None},
                               details={"execution_mode": "simulated",
                                        "note": "Phase 1: no operational system was changed"})
        rec.execution_mode = "simulated"
        self.session.commit()
        return to_out(rec)

    def cancel(self, decision_id: str, principal: Principal, reason: str) -> DecisionOut:
        rec = self._load(decision_id)
        self._require_decider(rec, principal, "cancel")
        rec = self._transition(rec, S.CANCELLED, principal, AuditAction.CANCELLED, details={"reason": reason})
        self.session.commit()
        return to_out(rec)
