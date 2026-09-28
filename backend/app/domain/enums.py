"""Domain enumerations shared across agents, services and the API."""

from __future__ import annotations

from enum import Enum


class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

    @property
    def rank(self) -> int:
        return {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}[self.value]

    @classmethod
    def from_value(cls, value: object) -> "Severity":
        """Parse a source severity label; unknown labels fall back to MEDIUM (never silently LOW)."""
        for member in cls:
            if isinstance(value, str) and member.value.lower() == value.strip().lower():
                return member
        return cls.MEDIUM

    @staticmethod
    def max(*values: "Severity") -> "Severity":
        return max(values, key=lambda s: s.rank)


class AgentName(str, Enum):
    MANAGER = "manager"
    ANOMALY = "anomaly"
    MAINTENANCE = "maintenance"
    VOYAGE = "voyage"
    SAFETY = "safety"


class EntityType(str, Enum):
    VESSEL = "vessel"
    ANOMALY = "anomaly"
    MAINTENANCE_ASSET = "maintenance_asset"
    VOYAGE_PLAN = "voyage_plan"
    SAFETY_EVENT = "safety_event"
    DECISION = "decision"
    USER = "user"


class DecisionStatus(str, Enum):
    PROPOSED = "PROPOSED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"


class AuditAction(str, Enum):
    RECOMMENDATION_CREATED = "RECOMMENDATION_CREATED"
    REVIEW_STARTED = "REVIEW_STARTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED_SIMULATED = "EXECUTED_SIMULATED"
    CANCELLED = "CANCELLED"
    LOGIN_SUCCEEDED = "LOGIN_SUCCEEDED"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"


class Role(str, Enum):
    """Operational roles. Approval authority per decision domain is defined in app.security.permissions."""

    VIEWER = "viewer"
    OPERATOR = "operator"
    CHIEF_ENGINEER = "chief_engineer"
    MASTER = "master"
    TECHNICAL_SUPERINTENDENT = "technical_superintendent"
    MARINE_SUPERINTENDENT = "marine_superintendent"
    HSE_MANAGER = "hse_manager"
    ADMIN = "admin"

    @property
    def label(self) -> str:
        return {
            "viewer": "Viewer",
            "operator": "Duty Officer",
            "chief_engineer": "Chief Engineer",
            "master": "Master",
            "technical_superintendent": "Technical Superintendent",
            "marine_superintendent": "Marine Superintendent",
            "hse_manager": "HSE Manager",
            "admin": "Administrator",
        }[self.value]


class ConfidenceBasis(str, Enum):
    """Explains where a confidence value comes from, so no number is presented without provenance."""

    SOURCE_DETECTION_CONFIDENCE = "source_detection_confidence"
    NOT_COMPUTED = "not_computed"
