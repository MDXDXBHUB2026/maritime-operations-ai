"""Persistent tables: decision records (authoritative for backend decisions) and audit events."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.db.base import Base


class UTCDateTime(TypeDecorator):
    """Stores UTC and always returns timezone-aware values (SQLite drops tzinfo otherwise)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; use UTC-aware values")
        return value.astimezone(timezone.utc) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class DecisionRecord(Base):
    __tablename__ = "decision_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    agent: Mapped[str] = mapped_column(String(32), index=True)
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    severity: Mapped[str] = mapped_column(String(16))
    summary: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    recommended_actions: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_basis: Mapped[str] = mapped_column(String(48))
    requires_human_approval: Mapped[bool] = mapped_column(Boolean)
    safety_critical: Mapped[bool] = mapped_column(Boolean)
    provider: Mapped[str] = mapped_column(String(128))
    site_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    site_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_by: Mapped[str] = mapped_column(String(80))
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    created_by_role: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime())
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    decided_by: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    decided_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    decided_by_role: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)
    decision_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    execution_mode: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    actor: Mapped[str] = mapped_column(String(80))
    actor_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    actor_role: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    action: Mapped[str] = mapped_column(String(32))
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str] = mapped_column(String(64))
    previous_state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    new_state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    decision_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("decision_records.id"), nullable=True, index=True
    )
    human_approval: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # NULL (legacy accounts) is treated as not fleet-wide: authority fails closed until scoped.
    fleet_wide: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    failed_logins: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime())


class AuthSession(Base):
    """Server-side session. Only the SHA-256 hash of the bearer token is stored."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    revoked_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)


class UserSiteAssignment(Base):
    """Sites (vessels or terminals) a user may act on when not fleet-wide."""

    __tablename__ = "user_site_assignments"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(UTCDateTime())
