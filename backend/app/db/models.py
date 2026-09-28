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
    created_by: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime())
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    decided_by: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)
    decision_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    execution_mode: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    actor: Mapped[str] = mapped_column(String(80))
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
