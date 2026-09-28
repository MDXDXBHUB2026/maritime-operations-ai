"""Authentication (login/logout/session validation) and user administration.

Sessions are opaque random bearer tokens; only their SHA-256 hash is stored, so a database
leak does not expose usable tokens. Failed logins are counted and lock the account for a
configured period. Every login, logout and account change is written to the audit trail.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import AuthSession, User
from app.domain.enums import AuditAction, EntityType, Role
from app.domain.errors import ConflictError, DomainError, ForbiddenError, NotFoundError, UnauthorizedError
from app.domain.models import MeOut, PermissionsOut, Principal, UserCreate, UserOut, UserUpdate
from app.security.passwords import hash_password, hash_token, new_token, validate_password_policy, verify_password
from app.security.permissions import approval_matrix, permission_summary
from app.services.audit_service import AuditService

# Used to equalise timing when the username does not exist.
_DUMMY_HASH = "pbkdf2_sha256$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

GENERIC_LOGIN_ERROR = "Invalid username or password"


class PasswordPolicyError(DomainError):
    status_code = 422
    code = "password_policy"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_principal(user: User) -> Principal:
    return Principal(user_id=user.id, username=user.username, display_name=user.display_name, role=Role(user.role))


def to_user_out(user: User) -> UserOut:
    role = Role(user.role)
    return UserOut(user_id=user.id, username=user.username, display_name=user.display_name, role=role,
                   role_label=role.label, is_active=user.is_active, last_login_at=user.last_login_at,
                   created_at=user.created_at)


def to_me(principal: Principal) -> MeOut:
    return MeOut(user_id=principal.user_id, username=principal.username, display_name=principal.display_name,
                 role=principal.role, role_label=principal.role.label,
                 permissions=PermissionsOut(**permission_summary(principal.role)),
                 approval_matrix=approval_matrix())


class AuthService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.audit = AuditService(session)

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

        user.failed_logins = 0
        user.locked_until = None
        user.last_login_at = now
        token = new_token()
        expires = now + timedelta(minutes=self.settings.session_ttl_minutes)
        self.session.add(AuthSession(id=str(uuid.uuid4()), token_hash=hash_token(token), user_id=user.id,
                                     created_at=now, expires_at=expires))
        principal = to_principal(user)
        self.audit.record_for(principal, action=AuditAction.LOGIN_SUCCEEDED, entity_type=EntityType.USER,
                              entity_id=user.id)
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
        return to_principal(user)

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
        return [to_user_out(u) for u in self.session.scalars(select(User).order_by(User.username))]

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
        details = {"username": username, "role": data.role.value}
        if actor:
            self.audit.record_for(actor, action=AuditAction.USER_CREATED, entity_type=EntityType.USER,
                                  entity_id=user.id, details=details)
        else:
            self.audit.record(actor="system (provisioning)", action=AuditAction.USER_CREATED,
                              entity_type=EntityType.USER, entity_id=user.id, details=details)
        if commit:
            self.session.commit()
        return to_user_out(user)

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
        return to_user_out(user)


DEMO_USERS: list[tuple[str, str, Role]] = [
    ("admin", "System Administrator (demo)", Role.ADMIN),
    ("duty.officer", "Duty Officer (demo)", Role.OPERATOR),
    ("chief.engineer", "Chief Engineer (demo)", Role.CHIEF_ENGINEER),
    ("master", "Master (demo)", Role.MASTER),
    ("tech.super", "Technical Superintendent (demo)", Role.TECHNICAL_SUPERINTENDENT),
    ("marine.super", "Marine Superintendent (demo)", Role.MARINE_SUPERINTENDENT),
    ("hse.manager", "HSE Manager (demo)", Role.HSE_MANAGER),
    ("viewer", "Viewer (demo)", Role.VIEWER),
]


def seed_demo_users(session: Session, settings: Settings, password: str) -> list[str]:
    """Create any missing demo role accounts with the given password. Existing accounts are untouched."""
    service = AuthService(session, settings)
    created = []
    for username, display_name, role in DEMO_USERS:
        if session.scalar(select(User).where(User.username == username)) is None:
            service.create_user(UserCreate(username=username, display_name=display_name, role=role,
                                           password=password), commit=False)
            created.append(username)
    session.commit()
    return created
