from enum import StrEnum


class Severity(StrEnum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

    @property
    def rank(self) -> int:
        return {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}[self.value]


class AgentKind(StrEnum):
    ANOMALY = "anomaly"
    MAINTENANCE = "maintenance"
    VOYAGE = "voyage"
    SAFETY = "safety"


class DecisionStatus(StrEnum):
    PROPOSED = "PROPOSED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"


class ActionCategory(StrEnum):
    MONITOR = "monitor"  # advisory only, no operational change
    INSPECT = "inspect"
    WORK_ORDER = "work_order"
    OPERATIONAL_CHANGE = "operational_change"
    PROCUREMENT = "procurement"
    ESCALATION = "escalation"
    ASSIGNMENT = "assignment"
