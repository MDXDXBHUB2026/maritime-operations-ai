import pytest

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.maintenance_agent import MaintenanceAgent, classify
from app.agents.manager_agent import ManagerAgent
from app.agents.safety_agent import SafetyAgent
from app.agents.voyage_agent import VoyageAgent
from app.ai.deterministic_provider import DeterministicProvider
from app.config import DEFAULT_DATA_DIR
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, AgentRecommendation
from app.repositories.maritime_repository import JsonFileMaritimeRepository
from app.services.maritime_service import MaritimeService


@pytest.fixture(scope="module")
def maritime() -> MaritimeService:
    return MaritimeService(JsonFileMaritimeRepository(DEFAULT_DATA_DIR))


@pytest.fixture(scope="module")
def manager() -> ManagerAgent:
    return ManagerAgent(DeterministicProvider())


@pytest.mark.parametrize(
    ("kind", "entity_id", "agent_cls"),
    [
        (AgentKind.ANOMALY, "ANM-0001", AnomalyAgent),
        (AgentKind.MAINTENANCE, "MA-001", MaintenanceAgent),
        (AgentKind.VOYAGE, "VP-2601", VoyageAgent),
        (AgentKind.SAFETY, "SE-0001", SafetyAgent),
    ],
)
def test_manager_routes_to_matching_specialist(
    manager: ManagerAgent,
    maritime: MaritimeService,
    kind: AgentKind,
    entity_id: str,
    agent_cls: type,
) -> None:
    context = maritime.build_context(kind, entity_id)
    assert isinstance(manager.route(context), agent_cls)
    recommendation = manager.recommend(context)
    assert isinstance(recommendation, AgentRecommendation)
    assert recommendation.agent is kind
    assert recommendation.entity_id == entity_id
    assert recommendation.summary
    assert recommendation.rationale
    assert recommendation.evidence
    assert all(e.source and e.record_id for e in recommendation.evidence)
    assert recommendation.recommended_actions
    assert recommendation.confidence_basis


def test_specialist_refuses_foreign_context(maritime: MaritimeService) -> None:
    context = maritime.build_context(AgentKind.SAFETY, "SE-0001")
    with pytest.raises(ValueError):
        AnomalyAgent(DeterministicProvider()).analyse(context)


def test_anomaly_confidence_is_source_score_not_invented(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    rec = manager.recommend(maritime.build_context(AgentKind.ANOMALY, "ANM-0001"))
    source = maritime.get_anomaly("ANM-0001")["confidence_score"]
    assert rec.confidence == pytest.approx(source / 100)
    assert rec.confidence_basis.startswith("source_detector_score")


def test_rule_based_agents_report_null_confidence(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    for kind, entity_id in [
        (AgentKind.MAINTENANCE, "MA-001"),
        (AgentKind.VOYAGE, "VP-2601"),
        (AgentKind.SAFETY, "SE-0001"),
    ]:
        rec = manager.recommend(maritime.build_context(kind, entity_id))
        assert rec.confidence is None
        assert rec.confidence_basis.startswith("not_calculated")


def test_anomaly_without_detector_score_has_null_confidence() -> None:
    record = {
        "anomaly_id": "ANM-X",
        "severity": "Medium",
        "current_value": 10,
        "expected_value": 5,
        "lower_threshold": 0,
        "upper_threshold": 8,
        "deviation_percentage": 100,
        "asset_name": "Pump",
        "parameter_name": "Pressure",
        "anomaly_type": "Spike",
        "vessel_or_terminal": "MV Test",
    }
    context = AgentContext(
        agent=AgentKind.ANOMALY, entity_type="anomaly", entity_id="ANM-X", record=record
    )
    rec = AnomalyAgent(DeterministicProvider()).analyse(context)
    assert rec.confidence is None
    assert rec.confidence_basis.startswith("not_available")


def test_critical_anomaly_is_safety_critical_and_needs_approval(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    rec = manager.recommend(maritime.build_context(AgentKind.ANOMALY, "ANM-0004"))
    assert rec.severity is Severity.CRITICAL
    assert rec.safety_critical and rec.requires_human_approval
    assert any(a.safety_critical for a in rec.recommended_actions)


def test_low_anomaly_is_advisory_only(manager: ManagerAgent, maritime: MaritimeService) -> None:
    rec = manager.recommend(maritime.build_context(AgentKind.ANOMALY, "ANM-0001"))
    assert rec.severity is Severity.LOW
    assert all(a.category is ActionCategory.MONITOR for a in rec.recommended_actions)
    assert rec.requires_human_approval is False
    assert rec.safety_critical is False


def test_safety_agent_always_requires_human_approval(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    for event_id in ("SE-0001", "SE-0003", "SE-0004"):
        rec = manager.recommend(maritime.build_context(AgentKind.SAFETY, event_id))
        assert rec.safety_critical and rec.requires_human_approval


def test_maintenance_classification_thresholds() -> None:
    assert classify(70, 5000) is Severity.CRITICAL
    assert classify(10, 400) is Severity.CRITICAL
    assert classify(45, 5000) is Severity.HIGH
    assert classify(10, 900) is Severity.HIGH
    assert classify(25, 5000) is Severity.MEDIUM
    assert classify(5, 5000) is Severity.LOW


def test_maintenance_unavailable_spare_triggers_procurement(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    rec = manager.recommend(maritime.build_context(AgentKind.MAINTENANCE, "MA-045"))
    assert rec.severity is Severity.CRITICAL
    assert ActionCategory.PROCUREMENT in {a.category for a in rec.recommended_actions}


def test_voyage_high_weather_is_safety_critical(
    manager: ManagerAgent, maritime: MaritimeService
) -> None:
    rec = manager.recommend(maritime.build_context(AgentKind.VOYAGE, "VP-2604"))
    assert rec.severity is Severity.HIGH
    assert rec.safety_critical and rec.requires_human_approval


def test_agents_are_deterministic(manager: ManagerAgent, maritime: MaritimeService) -> None:
    context = maritime.build_context(AgentKind.MAINTENANCE, "MA-026")
    assert manager.recommend(context) == manager.recommend(context)
