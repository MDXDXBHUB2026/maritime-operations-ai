"""Effective authority: role x domain x site, evaluated at the moment of each action.

Brings together:
- time-bound site assignments (crew rotation): only assignments whose period covers "now" count;
- the one-Master / one-Chief-Engineer-per-vessel rule, enforced whenever assignments change;
- crew handover: ends the outgoing officer's assignment and starts the incoming one at one instant;
- delegation: a person with approval authority can lend it, for one site and selected domains, for a
  bounded period, to a named colleague. A delegation is only honoured while the delegator still
  holds that authority themselves (fail closed); delegated authority cannot be delegated again.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import Delegation, User, UserSiteAssignment
from app.domain.enums import AgentName, AuditAction, EntityType, Role, SiteType
from app.domain.errors import ConflictError, DomainError, ForbiddenError, NotFoundError, OutOfScopeError
from app.domain.models import (
    AssignmentOut,
    CrewMember,
    CrewOut,
    DelegationCreate,
    DelegationOut,
    EligibleDelegate,
    HandoverRequest,
    Principal,
    Site,
)
from app.security.permissions import (
    ADMIN_ROLES,
    OPERATIONAL_ROLES,
    SHIPBOARD_ROLES,
    approver_labels,
    can_decide,
    in_scope,
)
from app.services.audit_service import AuditService

SiteCatalog = Callable[[], dict[str, Site]]

# Small tolerance for "now" supplied by a client clock.
CLOCK_SKEW = timedelta(minutes=5)


class InvalidPeriodError(DomainError):
    status_code = 422
    code = "invalid_period"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def period_active(valid_from: Optional[datetime], valid_until: Optional[datetime], at: datetime) -> bool:
    return (valid_from is None or valid_from <= at) and (valid_until is None or at < valid_until)


def period_status(valid_from: Optional[datetime], valid_until: Optional[datetime], at: datetime) -> str:
    if valid_until is not None and valid_until <= at:
        return "ended"
    if valid_from is not None and valid_from > at:
        return "scheduled"
    return "active"


def periods_overlap(a_from: Optional[datetime], a_until: Optional[datetime],
                    b_from: Optional[datetime], b_until: Optional[datetime]) -> bool:
    starts_before_b_ends = a_from is None or b_until is None or a_from < b_until
    b_starts_before_a_ends = b_from is None or a_until is None or b_from < a_until
    return starts_before_b_ends and b_starts_before_a_ends


def effective_site_ids(session: Session, user_id: str, at: Optional[datetime] = None) -> frozenset[str]:
    at = at or now_utc()
    rows = session.scalars(select(UserSiteAssignment).where(UserSiteAssignment.user_id == user_id))
    return frozenset(r.site_id for r in rows if period_active(r.valid_from, r.valid_until, at))


def principal_for(session: Session, user: User, at: Optional[datetime] = None) -> Principal:
    return Principal(user_id=user.id, username=user.username, display_name=user.display_name, role=Role(user.role),
                     fleet_wide=bool(user.fleet_wide), site_ids=effective_site_ids(session, user.id, at))


def shipboard_conflicts(session: Session, role: Role, site_id: str, valid_from: Optional[datetime],
                        valid_until: Optional[datetime], exclude_user_id: str) -> list[User]:
    """Other active users holding the same shipboard role on the vessel in an overlapping period."""
    if role not in SHIPBOARD_ROLES:
        return []
    stmt = (select(User, UserSiteAssignment)
            .join(UserSiteAssignment, UserSiteAssignment.user_id == User.id)
            .where(UserSiteAssignment.site_id == site_id, User.role == role.value, User.is_active.is_(True),
                   User.id != exclude_user_id))
    return [u for u, a in session.execute(stmt)
            if periods_overlap(valid_from, valid_until, a.valid_from, a.valid_until)]


class AuthorityService:
    def __init__(self, session: Session, site_catalog: SiteCatalog, settings: Optional[Settings] = None) -> None:
        self.session = session
        self.site_catalog = site_catalog
        self.settings = settings
        self.audit = AuditService(session)

    # -- helpers -------------------------------------------------------------
    def _site(self, site_id: str, catalog: Optional[dict[str, Site]] = None) -> Site:
        catalog = catalog if catalog is not None else self.site_catalog()
        return catalog.get(site_id) or Site(site_id=site_id, name=site_id, site_type=SiteType.VESSEL)

    def _user(self, user_id: str) -> User:
        user = self.session.get(User, user_id)
        if user is None:
            raise NotFoundError(f"User '{user_id}' not found")
        return user

    # -- delegation validity ---------------------------------------------------
    def delegation_state(self, d: Delegation, at: Optional[datetime] = None) -> tuple[str, Optional[str]]:
        """Status plus an explanation when a delegation exists but cannot currently be used."""
        at = at or now_utc()
        if d.revoked_at is not None:
            return "revoked", d.revoke_reason
        if d.valid_until <= at:
            return "expired", None
        if d.valid_from > at:
            return "scheduled", None
        delegator = self.session.get(User, d.delegator_user_id)
        delegate = self.session.get(User, d.delegate_user_id)
        if delegator is None or not delegator.is_active:
            return "suspended", "Delegator account is not active"
        if delegate is None or not delegate.is_active or Role(delegate.role) not in OPERATIONAL_ROLES:
            return "suspended", "Delegate account is not active or no longer eligible"
        grantor = principal_for(self.session, delegator, at)
        missing = [dom for dom in d.domains if not can_decide(grantor.role, AgentName(dom))]
        if missing:
            return "suspended", f"Delegator's role no longer covers {', '.join(missing)}"
        if not in_scope(grantor.fleet_wide, grantor.site_ids, d.site_id):
            return "suspended", "Delegator is no longer assigned to this site"
        return "active", None

    def usable_delegation(self, principal: Principal, domain: AgentName, site_id: Optional[str],
                          at: Optional[datetime] = None) -> Optional[Delegation]:
        if site_id is None:
            return None
        at = at or now_utc()
        rows = self.session.scalars(select(Delegation).where(
            Delegation.delegate_user_id == principal.user_id, Delegation.site_id == site_id,
            Delegation.revoked_at.is_(None), Delegation.valid_from <= at, Delegation.valid_until > at))
        for d in rows:
            if domain.value in d.domains and self.delegation_state(d, at)[0] == "active":
                return d
        return None

    # -- authorisation used by the decision service -------------------------------
    def _scope_error(self, principal: Principal, site_name: Optional[str], verb: str) -> OutOfScopeError:
        where = site_name or "an unresolved site"
        if not principal.fleet_wide and not principal.site_ids:
            return OutOfScopeError(
                f"{principal.display_name} has no current site assignment; cannot {verb} decisions for {where}")
        catalog = self.site_catalog()
        assigned = ", ".join(sorted(catalog[i].name if i in catalog else i for i in principal.site_ids))
        return OutOfScopeError(
            f"{principal.display_name} cannot {verb} decisions for {where}; authority is limited to: {assigned}")

    def authorize_decide(self, principal: Principal, domain: AgentName, site_id: Optional[str],
                         site_name: Optional[str], verb: str) -> Optional[Delegation]:
        """Approve/reject/execute/cancel. Returns the delegation used, or None for direct authority."""
        direct_role = can_decide(principal.role, domain)
        direct_scope = in_scope(principal.fleet_wide, principal.site_ids, site_id)
        if direct_role and direct_scope:
            return None
        delegation = self.usable_delegation(principal, domain, site_id)
        if delegation is not None:
            return delegation
        if not direct_role:
            raise ForbiddenError(f"{principal.role.label} cannot {verb} {domain.value} decisions; "
                                 f"requires {' or '.join(approver_labels(domain))}")
        raise self._scope_error(principal, site_name, verb)

    def authorize_write(self, principal: Principal, domain: AgentName, site_id: Optional[str],
                        site_name: Optional[str], verb: str) -> Optional[Delegation]:
        """Request/review: the role check is done by the caller; this checks site scope (or delegation)."""
        if in_scope(principal.fleet_wide, principal.site_ids, site_id):
            return None
        delegation = self.usable_delegation(principal, domain, site_id)
        if delegation is not None:
            return delegation
        raise self._scope_error(principal, site_name, verb)

    # -- views ---------------------------------------------------------------------
    def to_delegation_out(self, d: Delegation, catalog: Optional[dict[str, Site]] = None,
                          at: Optional[datetime] = None) -> DelegationOut:
        delegator = self._user(d.delegator_user_id)
        delegate = self._user(d.delegate_user_id)
        status, note = self.delegation_state(d, at)
        return DelegationOut(
            delegation_id=d.id, delegator_user_id=delegator.id, delegator=delegator.display_name,
            delegator_role=Role(delegator.role), delegate_user_id=delegate.id, delegate=delegate.display_name,
            delegate_role=Role(delegate.role), site=self._site(d.site_id, catalog),
            domains=[AgentName(x) for x in d.domains], valid_from=d.valid_from, valid_until=d.valid_until,
            reason=d.reason, status=status, status_note=note, created_at=d.created_at, revoked_at=d.revoked_at,
            revoke_reason=d.revoke_reason)

    def assignments_for(self, user_id: str, catalog: Optional[dict[str, Site]] = None,
                        include_ended: bool = False) -> list[AssignmentOut]:
        at = now_utc()
        catalog = catalog if catalog is not None else self.site_catalog()
        out = []
        for a in self.session.scalars(select(UserSiteAssignment).where(UserSiteAssignment.user_id == user_id)):
            status = period_status(a.valid_from, a.valid_until, at)
            if status == "ended" and not include_ended:
                continue
            out.append(AssignmentOut(site=self._site(a.site_id, catalog), valid_from=a.valid_from,
                                     valid_until=a.valid_until, status=status))
        return sorted(out, key=lambda x: (x.site.name, x.valid_from or datetime.min.replace(tzinfo=timezone.utc)))

    def delegations_for(self, user_id: str, given: bool, catalog: Optional[dict[str, Site]] = None,
                        current_only: bool = True) -> list[DelegationOut]:
        col = Delegation.delegator_user_id if given else Delegation.delegate_user_id
        rows = self.session.scalars(select(Delegation).where(col == user_id).order_by(Delegation.valid_from.desc()))
        out = [self.to_delegation_out(d, catalog) for d in rows]
        if current_only:
            out = [d for d in out if d.status in ("active", "scheduled", "suspended")]
        return out

    def list_delegations(self, principal: Principal) -> list[DelegationOut]:
        catalog = self.site_catalog()
        if principal.role in ADMIN_ROLES:
            rows = self.session.scalars(select(Delegation).order_by(Delegation.created_at.desc()).limit(500))
            return [self.to_delegation_out(d, catalog) for d in rows]
        rows = self.session.scalars(select(Delegation).where(or_(
            Delegation.delegator_user_id == principal.user_id, Delegation.delegate_user_id == principal.user_id,
        )).order_by(Delegation.created_at.desc()))
        return [self.to_delegation_out(d, catalog) for d in rows]

    def eligible_delegates(self, principal: Principal) -> list[EligibleDelegate]:
        users = self.session.scalars(select(User).where(User.is_active.is_(True)).order_by(User.display_name))
        return [EligibleDelegate(user_id=u.id, display_name=u.display_name, role=Role(u.role),
                                 role_label=Role(u.role).label)
                for u in users if u.id != principal.user_id and Role(u.role) in OPERATIONAL_ROLES]

    # -- delegation commands ---------------------------------------------------------
    def create_delegation(self, principal: Principal, data: DelegationCreate) -> DelegationOut:
        at = now_utc()
        valid_from = as_utc(data.valid_from) or at
        valid_until = as_utc(data.valid_until)
        max_days = self.settings.max_delegation_days if self.settings else 30
        if valid_from < at - CLOCK_SKEW:
            raise InvalidPeriodError("A delegation cannot start in the past")
        if valid_until <= valid_from:
            raise InvalidPeriodError("valid_until must be after valid_from")
        if valid_until - valid_from > timedelta(days=max_days):
            raise InvalidPeriodError(f"A delegation may last at most {max_days} days")

        catalog = self.site_catalog()
        if data.site_id not in catalog:
            raise NotFoundError(f"Site '{data.site_id}' not found")
        domains = sorted({d.value for d in data.domains})
        # Only authority held directly (role + current assignment) can be delegated - no re-delegation.
        not_held = [d for d in domains if not can_decide(principal.role, AgentName(d))]
        if not_held:
            raise ForbiddenError(f"{principal.role.label} holds no approval authority for {', '.join(not_held)} "
                                 "and cannot delegate it")
        if not in_scope(principal.fleet_wide, principal.site_ids, data.site_id):
            raise self._scope_error(principal, catalog[data.site_id].name, "delegate")

        delegate = self._user(data.delegate_user_id)
        if delegate.id == principal.user_id:
            raise InvalidPeriodError("You cannot delegate to yourself")
        if not delegate.is_active or Role(delegate.role) not in OPERATIONAL_ROLES:
            raise ForbiddenError(f"{delegate.display_name} ({Role(delegate.role).label}) cannot receive "
                                 "approval authority")

        d = Delegation(id=str(uuid.uuid4()), delegator_user_id=principal.user_id, delegate_user_id=delegate.id,
                       site_id=data.site_id, domains=domains, valid_from=valid_from, valid_until=valid_until,
                       reason=data.reason.strip(), created_at=at, created_by_user_id=principal.user_id)
        self.session.add(d)
        self.session.flush()
        self.audit.record_for(principal, action=AuditAction.DELEGATION_CREATED, entity_type=EntityType.DELEGATION,
                              entity_id=d.id, details={
                                  "delegate_user_id": delegate.id, "delegate": delegate.display_name,
                                  "site_id": d.site_id, "domains": domains, "valid_from": valid_from.isoformat(),
                                  "valid_until": valid_until.isoformat(), "reason": d.reason})
        self.session.commit()
        return self.to_delegation_out(d, catalog)

    def revoke_delegation(self, principal: Principal, delegation_id: str, reason: str) -> DelegationOut:
        d = self.session.get(Delegation, delegation_id)
        if d is None:
            raise NotFoundError(f"Delegation '{delegation_id}' not found")
        if principal.user_id != d.delegator_user_id and principal.role not in ADMIN_ROLES:
            raise ForbiddenError("Only the delegator or an administrator can revoke a delegation")
        if d.revoked_at is not None:
            raise ConflictError("Delegation is already revoked")
        d.revoked_at, d.revoked_by_user_id, d.revoke_reason = now_utc(), principal.user_id, reason.strip()
        self.audit.record_for(principal, action=AuditAction.DELEGATION_REVOKED, entity_type=EntityType.DELEGATION,
                              entity_id=d.id, details={"reason": d.revoke_reason})
        self.session.commit()
        return self.to_delegation_out(d)

    # -- crew rotation ---------------------------------------------------------------
    def crew(self, site_id: str) -> CrewOut:
        catalog = self.site_catalog()
        if site_id not in catalog:
            raise NotFoundError(f"Site '{site_id}' not found")
        at = now_utc()
        stmt = (select(User, UserSiteAssignment).join(UserSiteAssignment, UserSiteAssignment.user_id == User.id)
                .where(UserSiteAssignment.site_id == site_id, User.is_active.is_(True)))
        members = []
        for u, a in self.session.execute(stmt):
            status = period_status(a.valid_from, a.valid_until, at)
            if status == "ended":
                continue
            members.append(CrewMember(user_id=u.id, display_name=u.display_name, role=Role(u.role),
                                      role_label=Role(u.role).label, valid_from=a.valid_from,
                                      valid_until=a.valid_until, status=status))
        members.sort(key=lambda m: (m.role.value, m.status != "active",
                                    m.valid_from or datetime.min.replace(tzinfo=timezone.utc)))
        return CrewOut(site=catalog[site_id], crew=members)

    def crew_all(self) -> list[CrewOut]:
        return [self.crew(s.site_id) for s in self.site_catalog().values()]

    def handover(self, admin: Principal, site_id: str, req: HandoverRequest) -> CrewOut:
        if admin.role not in ADMIN_ROLES:
            raise ForbiddenError("Administrator role required")
        catalog = self.site_catalog()
        site = catalog.get(site_id)
        if site is None:
            raise NotFoundError(f"Site '{site_id}' not found")
        if site.site_type != SiteType.VESSEL or req.role not in SHIPBOARD_ROLES:
            raise InvalidPeriodError("Crew handover applies to Master or Chief Engineer on a vessel")
        at = now_utc()
        effective = as_utc(req.effective_at) or at
        if effective < at - CLOCK_SKEW:
            raise InvalidPeriodError("A handover cannot be back-dated")

        incoming = self._user(req.incoming_user_id)
        if not incoming.is_active or Role(incoming.role) != req.role:
            raise InvalidPeriodError(f"{incoming.display_name} is not an active {req.role.label}")

        # Outgoing: the same-role holder(s) whose assignment covers the effective moment.
        rows = self.session.execute(
            select(User, UserSiteAssignment).join(UserSiteAssignment, UserSiteAssignment.user_id == User.id)
            .where(UserSiteAssignment.site_id == site_id, User.role == req.role.value, User.id != incoming.id))
        outgoing = [(u, a) for u, a in rows if period_active(a.valid_from, a.valid_until, effective)]
        for _, a in outgoing:
            a.valid_until = effective
        self.session.flush()

        # Any other overlapping assignment after the handover (e.g. another scheduled officer) is a conflict.
        conflicts = shipboard_conflicts(self.session, req.role, site_id, effective, None, incoming.id)
        if conflicts:
            self.session.rollback()
            names = ", ".join(u.display_name for u in conflicts)
            raise ConflictError(f"{site.name} already has a {req.role.label} scheduled after the handover: {names}")

        row = self.session.get(UserSiteAssignment, (incoming.id, site_id))
        if row is None:
            self.session.add(UserSiteAssignment(user_id=incoming.id, site_id=site_id, assigned_at=at,
                                                valid_from=effective, valid_until=None))
        else:
            row.valid_from, row.valid_until, row.assigned_at = effective, None, at
        incoming.fleet_wide = False

        self.audit.record_for(admin, action=AuditAction.CREW_HANDOVER, entity_type=EntityType.SITE,
                              entity_id=site_id, details={
                                  "site": site.name, "role": req.role.value, "effective_at": effective.isoformat(),
                                  "outgoing": [u.display_name for u, _ in outgoing],
                                  "outgoing_user_ids": [u.id for u, _ in outgoing],
                                  "incoming": incoming.display_name, "incoming_user_id": incoming.id,
                                  "note": req.note})
        self.session.commit()
        return self.crew(site_id)
