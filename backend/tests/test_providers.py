from collections.abc import Callable

import httpx
import pytest

from app.agents.manager_agent import ManagerAgent
from app.ai.deterministic_provider import DeterministicProvider
from app.ai.factory import build_provider
from app.ai.ollama_provider import OllamaProvider
from app.ai.provider import AIRequest, FallbackProvider, ProviderUnavailableError
from app.config import DEFAULT_DATA_DIR, Settings
from app.domain.enums import AgentKind
from app.repositories.maritime_repository import JsonFileMaritimeRepository
from app.services.maritime_service import MaritimeService

Handler = Callable[[httpx.Request], httpx.Response]

REQUEST = AIRequest(
    task="recommendation_summary",
    facts={
        "severity": "High",
        "entity_label": "ANM-0003 / MV Test",
        "headline": "Vibration spike",
        "actions": ["Inspect pump"],
        "requires_human_approval": True,
    },
)


def _ollama(handler: Handler) -> OllamaProvider:
    return OllamaProvider(
        base_url="http://ollama.test",
        model="test-model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def _refuse(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("refused", request=request)


def test_deterministic_provider_is_available_and_reproducible() -> None:
    provider = DeterministicProvider()
    assert provider.is_available()
    first, second = provider.complete(REQUEST), provider.complete(REQUEST)
    assert first == second
    assert first.provider == "deterministic"
    assert first.text == (
        "[High] ANM-0003 / MV Test: Vibration spike Proposed next step: Inspect pump. "
        "Human approval is required before any action is taken."
    )


def test_deterministic_provider_advisory_wording() -> None:
    advisory = REQUEST.model_copy(
        update={"facts": {**REQUEST.facts, "requires_human_approval": False}}
    )
    assert (
        DeterministicProvider()
        .complete(advisory)
        .text.endswith("Advisory only; no operational change is proposed.")
    )


def test_deterministic_provider_respects_word_limit() -> None:
    long = AIRequest(task="other", facts={f"k{i}": "word " * 20 for i in range(10)}, max_words=10)
    assert len(DeterministicProvider().complete(long).text.split()) == 11  # 10 words + ellipsis


def test_ollama_provider_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/generate"
        return httpx.Response(200, json={"response": "LLM summary"})

    response = _ollama(handler).complete(REQUEST)
    assert (response.text, response.provider, response.model) == (
        "LLM summary",
        "ollama",
        "test-model",
    )


@pytest.mark.parametrize(
    "handler",
    [
        lambda r: httpx.Response(500, json={"error": "boom"}),
        lambda r: httpx.Response(200, json={"response": "   "}),
        lambda r: httpx.Response(200, content=b"not json"),
        _refuse,
    ],
)
def test_ollama_provider_failures_raise_unavailable(handler: Handler) -> None:
    with pytest.raises(ProviderUnavailableError):
        _ollama(handler).complete(REQUEST)


def test_ollama_unreachable_reports_unavailable() -> None:
    assert _ollama(_refuse).is_available() is False


def test_fallback_provider_uses_deterministic_when_ollama_down() -> None:
    response = FallbackProvider(_ollama(_refuse), DeterministicProvider()).complete(REQUEST)
    assert response.provider == "deterministic"
    assert response.fallback_used is True


def test_agent_output_unaffected_by_llm_except_summary() -> None:
    """The LLM only narrates: severity, actions and approval flags come from rules."""
    maritime = MaritimeService(JsonFileMaritimeRepository(DEFAULT_DATA_DIR))
    context = maritime.build_context(AgentKind.ANOMALY, "ANM-0004")

    llm = _ollama(lambda r: httpx.Response(200, json={"response": "Everything is fine."}))
    with_llm = ManagerAgent(llm).recommend(context)
    deterministic = ManagerAgent(DeterministicProvider()).recommend(context)

    assert with_llm.summary == "Everything is fine."
    assert with_llm.provider == "ollama"
    for field in (
        "severity",
        "recommended_actions",
        "requires_human_approval",
        "safety_critical",
        "evidence",
    ):
        assert getattr(with_llm, field) == getattr(deterministic, field)


def test_agent_survives_provider_failure_without_fallback_wrapper() -> None:
    maritime = MaritimeService(JsonFileMaritimeRepository(DEFAULT_DATA_DIR))
    context = maritime.build_context(AgentKind.SAFETY, "SE-0001")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    rec = ManagerAgent(_ollama(handler)).recommend(context)
    assert rec.provider_fallback_used is True
    assert rec.requires_human_approval is True


def test_factory_selects_provider() -> None:
    assert isinstance(build_provider(Settings(ai_provider="deterministic")), DeterministicProvider)
    provider = build_provider(Settings(ai_provider="ollama"))
    assert isinstance(provider, FallbackProvider)
    assert isinstance(provider.primary, OllamaProvider)
