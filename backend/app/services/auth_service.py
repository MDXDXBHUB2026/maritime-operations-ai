"""Authentication (login/logout/session validation) and user administration.

Sessions are opaque random bearer tokens; only their SHA-256 hash is stored, so a database
leak does not expose usable tokens. Failed logins are counted and lock the account for a
configured period. Every login, logout and account change is written to the audit trail.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import AuthSession, User, UserSiteAssignment
from app.domain.enums import AuditAction, EntityType, Role
from app.domain.errors import ConflictError, DomainError, ForbiddenError, NotFoundError, UnauthorizedError
from app.services.authority_service import AuthorityService, effective_site_ids, principal_for, shipboard_conflicts
from app.domain.models import (
    MeOut,
    PermissionsOut,
    Principal,
    ScopeOut,
    Site,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.security.passwords import hash_password, hash_token, new_token, validate_password_policy, verify_password
from app.security.permissions import (
    approval_matrix,
    default_fleet_wide,
    permission_summary,
    validate_scope,
)
from app.services.audit_service import AuditService

# Used to equalise timing when the username does not exist.
_DUMMY_HASH = "pbkdf2_sha256$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

GENERIC_LOGIN_ERROR = "Invalid username or password"


class PasswordPolicyError(DomainError):
    status_code = 422
    code = "password_policy"


class ScopeError(DomainError):
    status_code = 422
    code = "invalid_scope"


SiteCatalog = Callable[[], dict[str, Site]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _site_ids(session: Session, user_id: str) -> frozenset[str]:
    """Sites the user holds authority for right now (time-bound assignments respected)."""
    return effective_site_ids(session, user_id)


def to_principal(session: Session, user: User) -> Principal:
    return principal_for(session, user)


def _sites(site_ids: frozenset[str], catalog: dict[str, Site]) -> list[Site]:
    # Unknown ids (e.g. a vessel removed from the register) are still shown, marked by their id.
    return sorted((catalog.get(i) or Site(site_id=i, name=i, site_type="vessel") for i in site_ids),
                  key=lambda s: (s.site_type.value, s.name))


def to_me(principal: Principal, catalog: dict[str, Site]) -> MeOut:
    return MeOut(user_id=principal.user_id, username=principal.username, display_name=principal.display_name,
                 role=principal.role, role_label=principal.role.label,
                 permissions=PermissionsOut(**permission_summary(principal.role)),
                 scope=ScopeOut(fleet_wide=principal.fleet_wide, sites=_sites(principal.site_ids, catalog)),
                 approval_matrix=approval_matrix())


class AuthService:
    def __init__(self, session: Session, settings: Settings, site_catalog: SiteCatalog) -> None:
        self.session = session
        self.settings = settings
        self.site_catalog = site_catalog
        self.audit = AuditService(session)

    def me(self, principal: Principal) -> MeOut:
        catalog = self.site_catalog()
        me = to_me(principal, catalog)
        authority = AuthorityService(self.session, self.site_catalog, self.settings)
        me.scope.assignments = authority.assignments_for(principal.user_id, catalog)
        me.scope.delegations_received = authority.delegations_for(principal.user_id, given=False, catalog=catalog)
        me.scope.delegations_given = authority.delegations_for(principal.user_id, given=True, catalog=catalog)
        return me

    def to_user_out(self, user: User, catalog: Optional[dict[str, Site]] = None) -> UserOut:
        role = Role(user.role)
        catalog = catalog if catalog is not None else self.site_catalog()
        return UserOut(user_id=user.id, username=user.username, display_name=user.display_name, role=role,
                       role_label=role.label, is_active=user.is_active, fleet_wide=bool(user.fleet_wide),
                       sites=_sites(_site_ids(self.session, user.id), catalog),
                       last_login_at=user.last_login_at, created_at=user.created_at)

    def _apply_scope(self, user: User, role: Role, fleet_wide: bool, site_ids: list[str]) -> None:
        catalog = self.site_catalog()
        unique = sorted(set(site_ids))
        unknown = [i for i in unique if i not in catalog]
        if unknown:
            raise ScopeError(f"Unknown site(s): {', '.join(unknown)}")
        error = validate_scope(role, fleet_wide, [catalog[i].site_type for i in unique])
        if error:
            raise ScopeError(error)
        # Enforce one Master / one Chief Engineer per vessel before changing anything.
        for site_id in unique:
            conflicts = shipboard_conflicts(self.session, role, site_id, None, None, user.id)
            active = [u for u in conflicts]
            if active:
                names = ", ".join(u.display_name for u in active)
                raise ConflictError(f"{catalog[site_id].name} already has a {role.label} ({names}). "
                                    "Use a crew handover to rotate officers.")
        user.fleet_wide = fleet_wide
        now = _now()
        existing = {a.site_id: a for a in self.session.scalars(
            select(UserSiteAssignment).where(UserSiteAssignment.user_id == user.id))}
        for site_id, row in existing.items():
            if site_id not in unique:
                self.session.delete(row)
        for site_id in unique:
            row = existing.get(site_id)
            if row is None:
                self.session.add(UserSiteAssignment(user_id=user.id, site_id=site_id, assigned_at=now))
            elif row.valid_from is not None and row.valid_from > now:
                continue  # keep a scheduled (future) rotation untouched
            else:
                row.valid_from, row.valid_until = None, None
        self.session.flush()

    # -- login / logout ----------------------------------------------------
    def login(self, username: str, password: str) -> tuple[str, datetime, Principal]:
        username = username.strip().lower()
        user = self.session.scalar(select(User).where(User.username == username))
        now = _now()
        if user is None:
            verify_password(password, _DUMMY_HASH)
            self._audit_failure(username, "unknown_user")
            raise UnauthorizedError(GENERIC_LOGIN_ERROR)
        if user.locked_until and user.locked_until > now:
            self._audit_failure(username, "locked", user)
            raise UnauthorizedError("Account temporarily locked after repeated failed logins")
        if not verify_password(password, user.password_hash) or not user.is_active:
            reason = "inactive" if user.is_active is False else "bad_password"
            if reason == "bad_password":
                user.failed_logins += 1
                if user.failed_logins >= self.settings.login_max_failures:
                    user.locked_until = now + timedelta(minutes=self.settings.login_lockout_minutes)
                    user.failed_logins = 0
                    reason = "locked_after_failures"
            self._audit_failure(username, reason, user)
            raise UnauthorizedError(GENERIC_LOGIN_ERROR)

        return self._issue_session(user, now)

    def demo_accounts(self) -> list[dict]:
        """Demo accounts available for one-click sign-in (public demo deployments only)."""
        if not self.settings.public_demo:
            return []
        users = {u.username: u for u in self.session.scalars(
            select(User).where(User.username.in_(PUBLIC_DEMO_USERNAMES)))}
        accounts = []
        for username, display_name, role, _ in DEMO_USERS:
            user = users.get(username)
            if username in PUBLIC_DEMO_USERNAMES and user is not None and user.is_active:
                accounts.append({"username": username, "display_name": user.display_name,
                                 "role": role.value, "role_label": role.label})
        return accounts

    def demo_login(self, username: str) -> tuple[str, datetime, Principal]:
        """Password-less sign-in to a non-admin demo account, only when PUBLIC_DEMO is enabled.
        Administrator accounts and user-created accounts are never reachable this way."""
        username = username.strip().lower()
        if not self.settings.public_demo:
            raise ForbiddenError("Demo sign-in is disabled on this deployment")
        user = self.session.scalar(select(User).where(User.username == username))
        if username not in PUBLIC_DEMO_USERNAMES or user is None or not user.is_active:
            raise UnauthorizedError("Unknown demo account")
        return self._issue_session(user, _now(), details={"method": "public_demo"})

    def _issue_session(self, user: User, now: datetime,
                       details: Optional[dict] = None) -> tuple[str, datetime, Principal]:
        user.failed_logins = 0
        user.locked_until = None
        user.last_login_at = now
        token = new_token()
        expires = now + timedelta(minutes=self.settings.session_ttl_minutes)
        self.session.add(AuthSession(id=str(uuid.uuid4()), token_hash=hash_token(token), user_id=user.id,
                                     created_at=now, expires_at=expires))
        principal = to_principal(self.session, user)
        self.audit.record_for(principal, action=AuditAction.LOGIN_SUCCEEDED, entity_type=EntityType.USER,
                              entity_id=user.id, details=details)
        self.session.commit()
        return token, expires, principal

    def _audit_failure(self, username: str, reason: str, user: Optional[User] = None) -> None:
        self.audit.record(actor=username[:80] or "unknown", action=AuditAction.LOGIN_FAILED,
                          entity_type=EntityType.USER, entity_id=(user.id if user else "unknown"),
                          details={"reason": reason})
        self.session.commit()

    def authenticate(self, token: str) -> Principal:
        record = self.session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        now = _now()
        if record is None or record.revoked_at is not None or record.expires_at <= now:
            raise UnauthorizedError("Session is invalid or has expired")
        user = self.session.get(User, record.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Account is not active")
        # Scope is loaded per request, so assignment changes take effect immediately.
        return to_principal(self.session, user)

    def logout(self, token: str, principal: Principal) -> None:
        record = self.session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if record and record.revoked_at is None:
            record.revoked_at = _now()
            self.audit.record_for(principal, action=AuditAction.LOGOUT, entity_type=EntityType.USER,
                                  entity_id=principal.user_id)
            self.session.commit()

    def _revoke_all(self, user_id: str) -> None:
        now = _now()
        for rec in self.session.scalars(select(AuthSession).where(AuthSession.user_id == user_id,
                                                                  AuthSession.revoked_at.is_(None))):
            rec.revoked_at = now

    # -- user administration ------------------------------------------------
    def list_users(self) -> list[UserOut]:
        catalog = self.site_catalog()
        return [self.to_user_out(u, catalog) for u in self.session.scalars(select(User).order_by(User.username))]

    def create_user(self, data: UserCreate, actor: Optional[Principal] = None, commit: bool = True) -> UserOut:
        username = data.username.strip().lower()
        if self.session.scalar(select(User).where(User.username == username)):
            raise ConflictError(f"User '{username}' already exists")
        try:
            validate_password_policy(data.password)
        except ValueError as exc:
            raise PasswordPolicyError(str(exc)) from exc
        now = _now()
        user = User(id=str(uuid.uuid4()), username=username, display_name=data.display_name.strip(),
                    role=data.role.value, password_hash=hash_password(data.password,
                                                                      self.settings.password_hash_iterations),
                    is_active=True, failed_logins=0, created_at=now, updated_at=now)
        self.session.add(user)
        self.session.flush()
        fleet_wide = default_fleet_wide(data.role) and not data.site_ids if data.fleet_wide is None else data.fleet_wide
        self._apply_scope(user, data.role, fleet_wide, data.site_ids)
        details = {"username": username, "role": data.role.value, "fleet_wide": fleet_wide,
                   "site_ids": sorted(set(data.site_ids))}
        if actor:
            self.audit.record_for(actor, action=AuditAction.USER_CREATED, entity_type=EntityType.USER,
                                  entity_id=user.id, details=details)
        else:
            self.audit.record(actor="system (provisioning)", action=AuditAction.USER_CREATED,
                              entity_type=EntityType.USER, entity_id=user.id, details=details)
        if commit:
            self.session.commit()
        return self.to_user_out(user)

    def update_user(self, user_id: str, data: UserUpdate, actor: Principal) -> UserOut:
        user = self.session.get(User, user_id)
        if user is None:
            raise NotFoundError(f"User '{user_id}' not found")
        if user.id == actor.user_id and (data.role not in (None, Role(user.role)) or data.is_active is False):
            raise ForbiddenError("Administrators cannot change their own role or deactivate themselves")
        changes: dict = {}
        if data.display_name is not None and data.display_name != user.display_name:
            changes["display_name"] = [user.display_name, data.display_name]
            user.display_name = data.display_name.strip()
        if data.role is not None and data.role.value != user.role:
            changes["role"] = [user.role, data.role.value]
            user.role = data.role.value
        if data.is_active is not None and data.is_active != user.is_active:
            changes["is_active"] = [user.is_active, data.is_active]
            user.is_active = data.is_active
        new_role = Role(user.role)
        role_changed = "role" in changes
        if data.fleet_wide is not None or data.site_ids is not None or role_changed:
            old_ids = sorted(a.site_id for a in self.session.scalars(
                select(UserSiteAssignment).where(UserSiteAssignment.user_id == user.id)))
            old_fleet = bool(user.fleet_wide)
            site_ids = data.site_ids if data.site_ids is not None else old_ids
            if data.fleet_wide is not None:
                fleet_wide = data.fleet_wide
            elif data.site_ids:
                fleet_wide = False  # assigning specific sites means "limit to these sites"
            else:
                fleet_wide = default_fleet_wide(new_role) if role_changed else old_fleet
            if role_changed and data.fleet_wide is None and data.site_ids is None:
                # Keep the scope only if it is still valid for the new role; otherwise apply the role default.
                catalog = self.site_catalog()
                valid = validate_scope(new_role, fleet_wide,
                                       [catalog[i].site_type for i in site_ids if i in catalog]) is None
                if not valid:
                    fleet_wide, site_ids = default_fleet_wide(new_role), []
            self._apply_scope(user, new_role, fleet_wide, site_ids)
            new_ids = sorted(set(site_ids))
            if fleet_wide != old_fleet:
                changes["fleet_wide"] = [old_fleet, fleet_wide]
            if new_ids != old_ids:
                changes["site_ids"] = [old_ids, new_ids]
        if data.password is not None:
            try:
                validate_password_policy(data.password)
            except ValueError as exc:
                raise PasswordPolicyError(str(exc)) from exc
            user.password_hash = hash_password(data.password, self.settings.password_hash_iterations)
            user.failed_logins, user.locked_until = 0, None
            changes["password"] = "reset"
        if changes:
            user.updated_at = _now()
            # Role, status or credential changes end existing sessions.
            if {"role", "is_active", "password"} & changes.keys():
                self._revoke_all(user.id)
            self.audit.record_for(actor, action=AuditAction.USER_UPDATED, entity_type=EntityType.USER,
                                  entity_id=user.id, details={"changes": changes})
            self.session.commit()
        return self.to_user_out(user)


# (username, display name, role, assigned sites; empty = fleet-wide shore role)
DEMO_USERS: list[tuple[str, str, Role, list[str]]] = [
    ("admin", "System Administrator (demo)", Role.ADMIN, []),
    ("duty.officer", "Duty Officer (demo)", Role.OPERATOR, []),
    ("chief.engineer", "Chief Engineer, MV Horizon Star (demo)", Role.CHIEF_ENGINEER, ["VES-001"]),
    ("master", "Master, MV Horizon Star (demo)", Role.MASTER, ["VES-001"]),
    ("chief.meridian", "Chief Engineer, MV Meridian (demo)", Role.CHIEF_ENGINEER, ["VES-003"]),
    ("master.meridian", "Master, MV Meridian (demo)", Role.MASTER, ["VES-003"]),
    ("relief.master", "Relief Master (demo)", Role.MASTER, []),  # standby: no vessel until handover
    ("tech.super", "Technical Superintendent (demo)", Role.TECHNICAL_SUPERINTENDENT, []),
    ("marine.super", "Marine Superintendent (demo)", Role.MARINE_SUPERINTENDENT, []),
    ("hse.manager", "HSE Manager (demo)", Role.HSE_MANAGER, []),
    ("viewer", "Viewer (demo)", Role.VIEWER, []),
]

# Accounts offered for password-less sign-in on a public demo. Administrator is deliberately excluded.
PUBLIC_DEMO_USERNAMES: frozenset[str] = frozenset(u for u, _, r, _ in DEMO_USERS if r != Role.ADMIN)


def seed_demo_users(session: Session, settings: Settings, password: str, site_catalog: SiteCatalog) -> list[str]:
    """Create missing demo accounts. Existing demo accounts without any scope (created before site
    scoping existed) receive their default demo scope; other existing accounts are untouched."""
    service = AuthService(session, settings, site_catalog)
    created = []
    for username, display_name, role, sites in DEMO_USERS:
        user = session.scalar(select(User).where(User.username == username))
        if user is None:
            service.create_user(UserCreate(username=username, display_name=display_name, role=role,
                                           password=password, site_ids=sites), commit=False)
            created.append(username)
        elif user.fleet_wide is None and not _site_ids(session, user.id) and Role(user.role) == role:
            service._apply_scope(user, role, default_fleet_wide(role) and not sites, sites)
            if user.display_name != display_name and role in (Role.MASTER, Role.CHIEF_ENGINEER):
                user.display_name = display_name
    session.commit()
    return created
