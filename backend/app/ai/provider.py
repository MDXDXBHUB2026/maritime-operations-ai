"""Provider-neutral AI interface.

Agents build a structured :class:`NarrativeRequest` from deterministic facts and ask an
``AIProvider`` only for the human-readable narrative. Business rules (severity,
evidence, actions, approval requirements) never depend on the provider, so new
providers (OpenAI, Anthropic, Azure OpenAI, Gemini, ...) can be added by
implementing this interface and registering them in :func:`build_provider`.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ProviderUnavailableError(RuntimeError):
    """Raised when a provider cannot serve a request (network, timeout, bad response)."""


class NarrativeRequest(BaseModel):
    agent: str
    entity_id: str
    severity: str
    headline: str = Field(description="Deterministic one-line finding")
    facts: list[str] = Field(description="Verified facts drawn from evidence")
    actions: list[str]
    extra: dict[str, Any] = Field(default_factory=dict)


class NarrativeResponse(BaseModel):
    summary: str
    rationale: str
    provider: str


class AIProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def generate_narrative(self, request: NarrativeRequest) -> NarrativeResponse: ...

    @abstractmethod
    def is_available(self) -> bool: ...


class FallbackProvider(AIProvider):
    """Tries ``primary`` and degrades to ``fallback`` (deterministic) on any provider failure."""

    def __init__(self, primary: AIProvider, fallback: AIProvider) -> None:
        self.primary = primary
        self.fallback = fallback
        self.name = f"{primary.name}+fallback:{fallback.name}"

    def generate_narrative(self, request: NarrativeRequest) -> NarrativeResponse:
        try:
            return self.primary.generate_narrative(request)
        except ProviderUnavailableError as exc:
            logger.warning("AI provider %s unavailable, using %s: %s", self.primary.name, self.fallback.name, exc)
            return self.fallback.generate_narrative(request)

    def is_available(self) -> bool:
        # The deterministic fallback is always available; avoid a network probe on every call.
        return self.fallback.is_available() or self.primary.is_available()


def build_provider(settings: Any) -> AIProvider:
    """Factory: the only place that knows which concrete providers exist."""
    from app.ai.deterministic_provider import DeterministicProvider

    deterministic = DeterministicProvider()
    if settings.ai_provider == "ollama":
        from app.ai.ollama_provider import OllamaProvider

        return FallbackProvider(
            OllamaProvider(
                base_url=settings.ollama_base_url,
                model=settings.ollama_model,
                timeout_seconds=settings.ollama_timeout_seconds,
            ),
            deterministic,
        )
    return deterministic
