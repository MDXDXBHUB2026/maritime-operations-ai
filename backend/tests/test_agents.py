import pytest

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.maintenance_agent import MaintenanceAgent, condition_severity
from app.agents.manager_agent import ManagerAgent
from app.agents.safety_agent import SafetyAgent
from app.agents.voyage_agent import VoyageAgent
from app.ai.deterministic_provider import DeterministicProvider
from app.ai.provider import AIProvider, FallbackProvider, NarrativeRequest, ProviderUnavailableError
from app.domain.enums import AgentName, ConfidenceBasis, EntityType, Severity
from app.domain.models import AgentContext, AgentRecommendation
from app.services.maritime_service import MaritimeService


@pytest.fixture()
def service(repository):
    return MaritimeService(repository)


def test_manager_routes_each_domain_to_correct_specialist():
    manager = ManagerAgent(DeterministicProvider())
    assert isinstance(manager.route(AgentName.ANOMALY), AnomalyAgent)
    assert isinstance(manager.route(AgentName.MAINTENANCE), MaintenanceAgent)
    assert isinstance(manager.route(AgentName.VOYAGE), VoyageAgent)
    assert isinstance(manager.route(AgentName.SAFETY), SafetyAgent)
    with pytest.raises(ValueError):
        manager.route(AgentName.MANAGER)


@pytest.mark.parametrize("agent,entity_id,entity_type", [
    (AgentName.ANOMALY, "ANM-0001", EntityType.ANOMALY),
    (AgentName.MAINTENANCE, "MA-001", EntityType.MAINTENANCE_ASSET),
    (AgentName.VOYAGE, "VP-2601", EntityType.VOYAGE_PLAN),
    (AgentName.SAFETY, "SE-0001", EntityType.SAFETY_EVENT),
])
def test_specialist_returns_structured_recommendation(service, agent, entity_id, entity_type):
    rec = ManagerAgent(DeterministicProvider()).recommend(service.build_context(agent, entity_id))
    assert isinstance(rec, AgentRecommendation)
    assert rec.agent == agent and rec.entity_type == entity_type and rec.entity_id == entity_id
    assert rec.summary and rec.rationale
    assert rec.evidence and all(e.reference == entity_id for e in rec.evidence)
    assert rec.recommended_actions
    assert rec.requires_human_approval is True


def test_specialist_refuses_foreign_context(service):
    ctx = service.build_context(AgentName.SAFETY, "SE-0001")
    with pytest.raises(ValueError):
        AnomalyAgent().analyse(ctx, DeterministicProvider())


def test_agents_do_not_mutate_context_or_source(service, repository):
    before = repository.get_anomaly("ANM-0001")
    ctx = service.build_context(AgentName.ANOMALY, "ANM-0001")
    snapshot = ctx.model_dump()
    AnomalyAgent().analyse(ctx, DeterministicProvider())
    assert ctx.model_dump() == snapshot
    assert repository.get_anomaly("ANM-0001") == before


def test_confidence_only_from_traceable_source(service):
    manager = ManagerAgent(DeterministicProvider())
    anomaly = manager.recommend(service.build_context(AgentName.ANOMALY, "ANM-0001"))
    assert anomaly.confidence == 87.9  # taken from the source detection record, not invented
    assert anomaly.confidence_basis == ConfidenceBasis.SOURCE_DETECTION_CONFIDENCE
    maint = manager.recommend(service.build_context(AgentName.MAINTENANCE, "MA-001"))
    assert maint.confidence is None and maint.confidence_basis == ConfidenceBasis.NOT_COMPUTED


def test_anomaly_threshold_breach_escalates_to_high():
    ctx = AgentContext(agent=AgentName.ANOMALY, entity_type=EntityType.ANOMALY, entity_id="X-1", record={
        "asset_name": "Pump", "parameter_name": "Pressure", "current_value": 12, "expected_value": 8,
        "lower_threshold": 5, "upper_threshold": 10, "deviation_percentage": 50, "severity": "Low", "status": "New"})
    rec = AnomalyAgent().analyse(ctx, DeterministicProvider())
    assert rec.severity == Severity.HIGH
    assert rec.safety_critical is True


def test_maintenance_condition_rules():
    assert condition_severity(90, 10, 5000) == Severity.LOW
    assert condition_severity(75, 10, 5000) == Severity.MEDIUM
    assert condition_severity(90, 55, 5000) == Severity.HIGH
    assert condition_severity(90, 10, 100) == Severity.CRITICAL


def test_safety_actions_are_always_safety_critical(service):
    for event in service.list_safety_events()[:10]:
        rec = ManagerAgent(DeterministicProvider()).recommend(service.build_context(AgentName.SAFETY, event["event_id"]))
        assert rec.safety_critical is True
        assert all(a.safety_critical for a in rec.recommended_actions)


def test_deterministic_provider_is_repeatable():
    req = NarrativeRequest(agent="anomaly", entity_id="A", severity="High", headline="h", facts=["f"], actions=["a"])
    p = DeterministicProvider()
    assert p.is_available() is True
    first, second = p.generate_narrative(req), p.generate_narrative(req)
    assert first == second
    assert first.provider == "deterministic"
    assert "requires human review" in first.rationale


def test_recommendation_is_identical_across_runs(service):
    manager = ManagerAgent(DeterministicProvider())
    a = manager.recommend(service.build_context(AgentName.VOYAGE, "VP-2601"))
    b = manager.recommend(service.build_context(AgentName.VOYAGE, "VP-2601"))
    assert a == b


class _BrokenProvider(AIProvider):
    name = "broken"

    def generate_narrative(self, request):
        raise ProviderUnavailableError("offline")

    def is_available(self):
        return False


def test_fallback_provider_degrades_to_deterministic(service):
    provider = FallbackProvider(_BrokenProvider(), DeterministicProvider())
    rec = ManagerAgent(provider).recommend(service.build_context(AgentName.ANOMALY, "ANM-0002"))
    assert rec.provider == "deterministic"


def test_ollama_provider_fails_gracefully_when_unreachable(service):
    from app.ai.ollama_provider import OllamaProvider

    ollama = OllamaProvider(base_url="http://127.0.0.1:9", model="none", timeout_seconds=0.5)
    assert ollama.is_available() is False
    with pytest.raises(ProviderUnavailableError):
        ollama.generate_narrative(NarrativeRequest(agent="a", entity_id="e", severity="Low", headline="h",
                                                   facts=[], actions=[]))
    rec = ManagerAgent(FallbackProvider(ollama, DeterministicProvider())).recommend(
        service.build_context(AgentName.SAFETY, "SE-0002"))
    assert rec.provider == "deterministic"
