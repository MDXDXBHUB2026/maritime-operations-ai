"""Typed domain and API models.

Operational record models declare the fields the backend relies on and allow extra
fields, so the API returns records in exactly the shape the React frontend expects.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import ActionCategory, AgentKind, DecisionStatus, Severity

# Actor identifiers: letters, digits, spaces and a few separators. Validated on every
# human-initiated state transition so audit records stay clean and injection-free.
ACTOR_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9 ._@:\-]{0,99}$"
ENTITY_ID_PATTERN = r"^[A-Za-z0-9_\-]{1,64}$"


# --------------------------------------------------------------------------------------
# Operational records (read models over the Phase 1 JSON datasets)
# --------------------------------------------------------------------------------------
class _Record(BaseModel):
    model_config = ConfigDict(extra="allow")


class Vessel(_Record):
    vessel_id: str
    vessel_name: str
    vessel_type: str
    operational_status: str
    latitude: float
    longitude: float
    safety_risk_level: Severity


class Anomaly(_Record):
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
    severity: Severity
    status: str


class MaintenanceAsset(_Record):
    asset_id: str
    asset_name: str
    vessel_or_terminal: str
    health_score: float
    failure_probability_percentage: float
    remaining_useful_life_hours: float
    criticality: Severity
    maintenance_status: str


class VoyagePlan(_Record):
    voyage_id: str
    vessel_id: str
    vessel_name: str
    planned_speed_knots: float
    current_speed_knots: float
    recommended_speed_knots: float
    planned_fuel_tonnes: float
    predicted_fuel_tonnes: float
    weather_risk: str
    optimisation_status: str


class SafetyEvent(_Record):
    event_id: str
    event_type: str
    vessel_or_terminal: str
    severity: Severity
    risk_score: float
    status: str


# --------------------------------------------------------------------------------------
# Agent contracts
# --------------------------------------------------------------------------------------
class AgentContext(BaseModel):
    """Structured, read-only context handed to a specialist agent."""

    model_config = ConfigDict(frozen=True)

    agent: AgentKind
    entity_type: str
    entity_id: str
    record: dict[str, Any]
    related: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)


class Evidence(BaseModel):
    source: str = Field(description="Dataset or system the value was read from.")
    record_id: str
    field: str
    value: Any
    note: str | None = None


class RecommendedAction(BaseModel):
    action: str
    category: ActionCategory
    safety_critical: bool = False


class AgentRecommendation(BaseModel):
    """Structured output of a specialist agent. A proposal only; never an instruction."""

    agent: AgentKind
    entity_type: str
    entity_id: str
    severity: Severity
    summary: str
    rationale: list[str]
    evidence: list[Evidence]
    recommended_actions: list[RecommendedAction]
    requires_human_approval: bool
    safety_critical: bool
    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Only populated when derived from a measurable source; otherwise null.",
    )
    confidence_basis: str
    provider: str
    provider_fallback_used: bool = False


# --------------------------------------------------------------------------------------
# Decisions and audit
# --------------------------------------------------------------------------------------
class Decision(BaseModel):
    recommendation_id: str
    status: DecisionStatus
    agent: AgentKind
    entity_type: str
    entity_id: str
    severity: Severity
    summary: str
    requires_human_approval: bool
    safety_critical: bool
    recommendation: AgentRecommendation
    created_at: datetime
    updated_at: datetime
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    decided_by: str | None = None
    decided_at: datetime | None = None
    decision_comment: str | None = None
    executed_at: datetime | None = None
    execution_result: dict[str, Any] | None = None


class GenerateDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requested_by: str = Field(default="control-tower-user", pattern=ACTOR_PATTERN)


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str = Field(pattern=ACTOR_PATTERN)
    comment: str | None = Field(default=None, max_length=1000)


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str = Field(pattern=ACTOR_PATTERN)
    comment: str | None = Field(default=None, max_length=1000)


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str = Field(pattern=ACTOR_PATTERN)
    reason: str = Field(min_length=3, max_length=1000)


class ExecuteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str = Field(pattern=ACTOR_PATTERN)


class CancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str = Field(pattern=ACTOR_PATTERN)
    reason: str = Field(min_length=3, max_length=1000)


class AuditEvent(BaseModel):
    event_id: str
    timestamp: datetime
    actor: str
    action: str
    entity_type: str
    entity_id: str
    previous_state: str | None
    new_state: str | None
    decision_id: str | None
    human_approval: dict[str, Any] | None
    details: dict[str, Any] | None


class ProviderStatus(BaseModel):
    configured: str
    active: str
    available: bool
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str
    data_source: str
    ai_provider: ProviderStatus
