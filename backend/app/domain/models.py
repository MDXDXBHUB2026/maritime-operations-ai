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
    Role,
    Severity,
    SiteType,
)

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$"
ACTOR_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9 .,'_@()\-]{0,79}$"


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
# The acting person is always the authenticated user; request bodies never carry identity.
class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: Optional[str] = Field(default=None, max_length=1000)


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: Optional[str] = Field(default=None, max_length=1000)


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=3, max_length=1000)


class CancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=3, max_length=1000)


# ---------------------------------------------------------------------------
# Authentication & users
# ---------------------------------------------------------------------------
USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._\-]{2,63}$"


class Site(BaseModel):
    """An operational site that owns decisions: a vessel or a terminal."""

    site_id: str
    name: str
    site_type: SiteType


class Principal(BaseModel):
    """The authenticated person acting on a request, with their site scope."""

    user_id: str
    username: str
    display_name: str
    role: Role
    fleet_wide: bool = False
    site_ids: frozenset[str] = frozenset()

    @property
    def actor_label(self) -> str:
        # Avoid "Master (demo) (Master)" when the display name already states the role.
        if self.role.label.lower() in self.display_name.lower():
            return self.display_name
        return f"{self.display_name} ({self.role.label})"


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class PermissionsOut(BaseModel):
    can_generate: bool
    can_review: bool
    approve_domains: list[str]
    can_manage_users: bool


class AssignmentOut(BaseModel):
    site: Site
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    status: str = Field(description="active | scheduled | ended")


class DelegationOut(BaseModel):
    delegation_id: str
    delegator_user_id: str
    delegator: str
    delegator_role: Role
    delegate_user_id: str
    delegate: str
    delegate_role: Role
    site: Site
    domains: list[AgentName]
    valid_from: datetime
    valid_until: datetime
    reason: str
    status: str = Field(description="active | scheduled | expired | revoked | suspended")
    status_note: Optional[str] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None
    revoke_reason: Optional[str] = None


class ScopeOut(BaseModel):
    fleet_wide: bool
    sites: list[Site] = Field(description="Sites the user holds authority for right now")
    assignments: list[AssignmentOut] = Field(default_factory=list, description="Active and scheduled assignments")
    delegations_received: list[DelegationOut] = Field(default_factory=list)
    delegations_given: list[DelegationOut] = Field(default_factory=list)


class MeOut(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: Role
    role_label: str
    permissions: PermissionsOut
    scope: ScopeOut
    approval_matrix: dict[str, list[dict[str, str]]]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: MeOut


class UserOut(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: Role
    role_label: str
    is_active: bool
    fleet_wide: bool
    sites: list[Site]
    last_login_at: Optional[datetime]
    created_at: datetime


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(pattern=USERNAME_PATTERN)
    display_name: str = Field(pattern=ACTOR_PATTERN)
    role: Role
    password: str = Field(min_length=10, max_length=256)
    # Site scope. Shipboard roles need explicit vessels; shore roles default to fleet-wide.
    fleet_wide: Optional[bool] = None
    site_ids: list[str] = Field(default_factory=list, max_length=100)


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: Optional[str] = Field(default=None, pattern=ACTOR_PATTERN)
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=10, max_length=256)
    fleet_wide: Optional[bool] = None
    site_ids: Optional[list[str]] = Field(default=None, max_length=100)


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
    site_id: Optional[str] = None
    site_name: Optional[str] = None
    created_by: str
    created_by_role: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reviewed_by: Optional[str] = None
    decided_by: Optional[str] = None
    decided_by_role: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_comment: Optional[str] = None
    execution_mode: Optional[str] = Field(
        default=None, description="'simulated' in Phase 1 - no operational system is changed"
    )


class AuditEventOut(BaseModel):
    event_id: str
    timestamp: datetime
    actor: str
    actor_user_id: Optional[str] = None
    actor_role: Optional[str] = None
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


class DelegationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    delegate_user_id: str = Field(pattern=r"^[0-9a-fA-F\-]{36}$")
    site_id: str = Field(pattern=ID_PATTERN)
    domains: list[AgentName] = Field(min_length=1, max_length=4)
    valid_from: Optional[datetime] = None  # default: now
    valid_until: datetime
    reason: str = Field(min_length=5, max_length=500)


class DelegationRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=3, max_length=500)


class EligibleDelegate(BaseModel):
    user_id: str
    display_name: str
    role: Role
    role_label: str


class HandoverRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Role
    incoming_user_id: str = Field(pattern=r"^[0-9a-fA-F\-]{36}$")
    effective_at: Optional[datetime] = None  # default: now
    note: Optional[str] = Field(default=None, max_length=500)


class CrewMember(BaseModel):
    user_id: str
    display_name: str
    role: Role
    role_label: str
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    status: str


class CrewOut(BaseModel):
    site: Site
    crew: list[CrewMember]
