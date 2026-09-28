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
from app.db.models import DecisionRecord, Delegation, User
from app.domain.enums import AgentName, AuditAction, DecisionStatus, EntityType
from app.domain.errors import (
    ForbiddenError,
    HumanApprovalRequiredError,
    InvalidTransitionError,
    NotFoundError,
    OutOfScopeError,  # noqa: F401 - re-exported for callers/tests
)
from app.security.permissions import can_generate, can_review
from app.domain.models import DecisionOut, Principal
from app.services.audit_service import AuditService
from app.services.authority_service import AuthorityService
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
        safety_critical=rec.safety_critical, provider=rec.provider, site_id=rec.site_id, site_name=rec.site_name,
        created_by=rec.created_by,
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
        self.authority = AuthorityService(session, maritime.site_by_id)

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
    # Role, site scope, time-bound assignments and delegations are evaluated by AuthorityService.
    @staticmethod
    def _require(allowed: bool, message: str) -> None:
        if not allowed:
            raise ForbiddenError(message)

    def _site_of(self, rec: DecisionRecord) -> tuple[Optional[str], Optional[str]]:
        """Site of a decision; decisions created before site scoping are resolved once and stored."""
        if rec.site_id is None:
            try:
                site = self.maritime.site_for_context(
                    self.maritime.build_context(AgentName(rec.agent), rec.entity_id))
            except NotFoundError:
                site = None
            if site is not None:
                rec.site_id, rec.site_name = site.site_id, site.name
        return rec.site_id, rec.site_name

    def _authorize_decide(self, rec: DecisionRecord, principal: Principal, verb: str) -> Optional[Delegation]:
        site_id, site_name = self._site_of(rec)
        return self.authority.authorize_decide(principal, AgentName(rec.agent), site_id, site_name, verb)

    def _delegation_details(self, delegation: Optional[Delegation]) -> Optional[dict]:
        if delegation is None:
            return None
        delegator = self.session.get(User, delegation.delegator_user_id)
        return {"delegation_id": delegation.id,
                "on_behalf_of": delegator.display_name if delegator else delegation.delegator_user_id,
                "on_behalf_of_user_id": delegation.delegator_user_id,
                "on_behalf_of_role": delegator.role if delegator else None,
                "delegation_valid_until": delegation.valid_until.isoformat()}

    @staticmethod
    def _merge(details: Optional[dict], extra: Optional[dict]) -> Optional[dict]:
        if not extra:
            return details
        return {**(details or {}), "delegation": extra}

    # -- commands ---------------------------------------------------------
    def generate(self, agent: AgentName, entity_id: str, principal: Principal) -> DecisionOut:
        self._require(can_generate(principal.role),
                      f"{principal.role.label} cannot request AI recommendations")
        context = self.maritime.build_context(agent, entity_id)
        site = self.maritime.site_for_context(context)
        delegation = self.authority.authorize_write(principal, agent, site.site_id if site else None,
                                                    site.name if site else None, "request")
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
            provider=rec_model.provider, site_id=site.site_id if site else None,
            site_name=site.name if site else None, created_by=principal.actor_label, created_by_user_id=principal.user_id,
            created_by_role=principal.role.value, created_at=now, updated_at=now,
        )
        self.session.add(rec)
        self.session.flush()
        self.audit.record_for(
            principal, action=AuditAction.RECOMMENDATION_CREATED, entity_type=EntityType.DECISION,
            entity_id=rec.id, previous_state=None, new_state=S.PROPOSED, decision_id=rec.id,
            details=self._merge({"agent": rec.agent, "source_entity_type": rec.entity_type,
                                 "source_entity_id": rec.entity_id, "severity": rec.severity,
                                 "provider": rec.provider, "routed_by": AgentName.MANAGER.value,
                                 "site_id": rec.site_id, "site_name": rec.site_name},
                                self._delegation_details(delegation)),
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

    def _approval_record(self, principal: Principal, approved: bool, when: datetime, text: Optional[str],
                         delegation: Optional[Delegation] = None) -> dict:
        record = {"approved": approved, "approver": principal.actor_label, "approver_user_id": principal.user_id,
                  "approver_role": principal.role.value, "decided_at": when.isoformat(),
                  ("comment" if approved else "reason"): text}
        extra = self._delegation_details(delegation)
        if extra:
            record["delegated_from"] = extra
        return record

    def review(self, decision_id: str, principal: Principal, comment: Optional[str]) -> DecisionOut:
        self._require(can_review(principal.role), f"{principal.role.label} cannot review decisions")
        rec = self._load(decision_id)
        site_id, site_name = self._site_of(rec)
        delegation = self.authority.authorize_write(principal, AgentName(rec.agent), site_id, site_name, "review")
        rec = self._transition(rec, S.UNDER_REVIEW, principal, AuditAction.REVIEW_STARTED,
                               details=self._merge({"comment": comment} if comment else None,
                                                   self._delegation_details(delegation)))
        rec.reviewed_by = principal.actor_label
        self.session.commit()
        return to_out(rec)

    def approve(self, decision_id: str, principal: Principal, comment: Optional[str]) -> DecisionOut:
        rec = self._load(decision_id)
        delegation = self._authorize_decide(rec, principal, "approve")
        if rec.safety_critical and rec.created_by_user_id == principal.user_id:
            raise SeparationOfDutiesError(
                "Safety-critical decisions need a second person: the requester cannot approve their own request")
        now = _now()
        rec = self._transition(rec, S.APPROVED, principal, AuditAction.APPROVED,
                               human_approval=self._approval_record(principal, True, now, comment, delegation))
        self._set_decided(rec, principal, now, comment, delegation)
        self.session.commit()
        return to_out(rec)

    def reject(self, decision_id: str, principal: Principal, reason: str) -> DecisionOut:
        rec = self._load(decision_id)
        delegation = self._authorize_decide(rec, principal, "reject")
        now = _now()
        rec = self._transition(rec, S.REJECTED, principal, AuditAction.REJECTED,
                               human_approval=self._approval_record(principal, False, now, reason, delegation))
        self._set_decided(rec, principal, now, reason, delegation)
        self.session.commit()
        return to_out(rec)

    def _set_decided(self, rec: DecisionRecord, principal: Principal, when: datetime, text: Optional[str],
                     delegation: Optional[Delegation] = None) -> None:
        label = principal.actor_label
        extra = self._delegation_details(delegation)
        if extra:
            label = f"{label} on behalf of {extra['on_behalf_of']}"[:80]
        rec.decided_by, rec.decided_by_user_id, rec.decided_by_role = label, principal.user_id, principal.role.value
        rec.decided_via_delegation_id = delegation.id if delegation else None
        rec.decided_at, rec.decision_comment = when, text

    def execute(self, decision_id: str, principal: Principal) -> DecisionOut:
        """Simulated execution. Only reachable from APPROVED, which itself requires an authorised human."""
        rec = self._load(decision_id)
        delegation = self._authorize_decide(rec, principal, "execute")
        if rec.status != S.APPROVED.value or not rec.decided_by_user_id:
            raise HumanApprovalRequiredError(
                f"Decision is {rec.status}; execution requires prior human approval (APPROVED)")
        rec = self._transition(rec, S.EXECUTED, principal, AuditAction.EXECUTED_SIMULATED,
                               human_approval={"approved_by": rec.decided_by,
                                               "approved_by_role": rec.decided_by_role,
                                               "approved_at": rec.decided_at.isoformat() if rec.decided_at else None},
                               details=self._merge({"execution_mode": "simulated",
                                                    "note": "Phase 1: no operational system was changed"},
                                                   self._delegation_details(delegation)))
        rec.execution_mode = "simulated"
        self.session.commit()
        return to_out(rec)

    def cancel(self, decision_id: str, principal: Principal, reason: str) -> DecisionOut:
        rec = self._load(decision_id)
        delegation = self._authorize_decide(rec, principal, "cancel")
        rec = self._transition(rec, S.CANCELLED, principal, AuditAction.CANCELLED,
                               details=self._merge({"reason": reason}, self._delegation_details(delegation)))
        self.session.commit()
        return to_out(rec)
