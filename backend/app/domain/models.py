"""Typed domain models (Pydantic) used by agents, services and the API contract."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import (
    AgentName,
    AuditAction,
    ConfidenceBasis,
    DecisionStatus,
    EntityType,
    Severity,
)

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$"
ACTOR_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9 .'_@\-]{0,79}$"


# ---------------------------------------------------------------------------
# Operational records (read models). Core fields are validated; additional
# source fields are passed through unchanged so the frontend keeps its shape.
# ---------------------------------------------------------------------------
class _Record(BaseModel):
    model_config = ConfigDict(extra="allow")


class VesselRecord(_Record):
    vessel_id: str
    vessel_name: str
    vessel_type: str
    operational_status: str
    latitude: float
    longitude: float
    technical_health_score: float
    safety_risk_level: str


class AnomalyRecord(_Record):
    anomaly_id: str
    asset_id: str
    asset_name: str
    vessel_or_terminal: str
    parameter_name: str
    current_value: float
    expected_value: float
    lower_threshold: float
    upper_threshold: float
    deviation_percentage: float
    severity: str
    status: str


class MaintenanceAssetRecord(_Record):
    asset_id: str
    asset_name: str
    vessel_or_terminal: str
    health_score: float
    failure_probability_percentage: float
    remaining_useful_life_hours: float
    criticality: str
    spare_part_availability: str
    maintenance_status: str


class VoyagePlanRecord(_Record):
    voyage_id: str
    vessel_id: str
    vessel_name: str
    planned_eta: str
    predicted_eta: str
    planned_speed_knots: float
    current_speed_knots: float
    recommended_speed_knots: float
    planned_fuel_tonnes: float
    predicted_fuel_tonnes: float
    weather_risk: str
    estimated_waiting_hours: float
    optimisation_status: str


class SafetyEventRecord(_Record):
    event_id: str
    event_type: str
    vessel_or_terminal: str
    severity: str
    persons_exposed: int
    status: str
    risk_score: float
    overdue_flag: bool


# ---------------------------------------------------------------------------
# Agent input / output
# ---------------------------------------------------------------------------
class AgentContext(BaseModel):
    """Structured context handed to a specialist agent. Agents never fetch or mutate state."""

    agent: AgentName
    entity_type: EntityType
    entity_id: str
    record: dict[str, Any]
    related: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)


class Evidence(BaseModel):
    source: str = Field(description="Dataset or system the value came from")
    reference: str = Field(description="Record identifier within the source")
    field: str
    value: Any
    note: Optional[str] = None


class RecommendedAction(BaseModel):
    action: str
    rationale: str
    safety_critical: bool = Field(
        description="Safety-critical actions can only be executed after explicit human approval"
    )


class AgentRecommendation(BaseModel):
    agent: AgentName
    entity_type: EntityType
    entity_id: str
    severity: Severity
    summary: str
    rationale: str
    evidence: list[Evidence]
    recommended_actions: list[RecommendedAction]
    confidence: Optional[float] = Field(
        default=None, ge=0, le=100, description="Only populated when traceable to source data"
    )
    confidence_basis: ConfidenceBasis
    requires_human_approval: bool
    safety_critical: bool
    provider: str = Field(description="AI provider that produced the narrative text")
    model_config = ConfigDict(use_enum_values=False)


# ---------------------------------------------------------------------------
# Decisions & audit
# ---------------------------------------------------------------------------
class GenerateDecisionRequest(BaseModel):
    requested_by: str = Field(default="operator", pattern=ACTOR_PATTERN)


class ReviewRequest(BaseModel):
    reviewer: str = Field(pattern=ACTOR_PATTERN)
    comment: Optional[str] = Field(default=None, max_length=1000)


class ApproveRequest(BaseModel):
    approver: str = Field(pattern=ACTOR_PATTERN)
    comment: Optional[str] = Field(default=None, max_length=1000)


class RejectRequest(BaseModel):
    approver: str = Field(pattern=ACTOR_PATTERN)
    reason: str = Field(min_length=3, max_length=1000)


class ExecuteRequest(BaseModel):
    actor: str = Field(pattern=ACTOR_PATTERN)


class CancelRequest(BaseModel):
    actor: str = Field(pattern=ACTOR_PATTERN)
    reason: str = Field(min_length=3, max_length=1000)


class DecisionOut(BaseModel):
    recommendation_id: str
    agent: AgentName
    entity_type: EntityType
    entity_id: str
    status: DecisionStatus
    severity: Severity
    summary: str
    rationale: str
    evidence: list[Evidence]
    recommended_actions: list[RecommendedAction]
    confidence: Optional[float]
    confidence_basis: ConfidenceBasis
    requires_human_approval: bool
    safety_critical: bool
    provider: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    reviewed_by: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_comment: Optional[str] = None
    execution_mode: Optional[str] = Field(
        default=None, description="'simulated' in Phase 1 - no operational system is changed"
    )


class AuditEventOut(BaseModel):
    event_id: str
    timestamp: datetime
    actor: str
    action: AuditAction
    entity_type: EntityType
    entity_id: str
    previous_state: Optional[DecisionStatus]
    new_state: Optional[DecisionStatus]
    decision_id: Optional[str]
    human_approval: Optional[dict[str, Any]]
    details: Optional[dict[str, Any]]


class HealthOut(BaseModel):
    status: str
    version: str
    database: str
    data_source: str
    ai_provider: str
    ai_provider_available: bool
