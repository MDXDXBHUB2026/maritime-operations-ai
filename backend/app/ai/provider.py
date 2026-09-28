"""Model-agnostic AI provider interface.

Agents talk only to ``AIProvider``. Adding OpenAI, Anthropic, Azure OpenAI or Gemini
means adding a new subclass and a factory entry; business logic does not change.

Guardrail: providers only produce *narrative text* for a recommendation. Severity,
recommended actions, evidence and approval requirements are always computed by the
deterministic agent rules and are never taken from model output.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ProviderUnavailableError(RuntimeError):
    """Raised when a provider cannot serve a request (network, timeout, bad response)."""


class AIRequest(BaseModel):
    task: str = Field(description="Logical task name, e.g. 'recommendation_summary'.")
    facts: dict[str, Any] = Field(
        description="Structured, verified facts the text must be based on."
    )
    max_words: int = Field(default=80, ge=10, le=400)


class AIResponse(BaseModel):
    text: str
    provider: str
    model: str | None = None
    fallback_used: bool = False


class AIProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def is_available(self) -> bool: ...

    @abstractmethod
    def complete(self, request: AIRequest) -> AIResponse: ...


class FallbackProvider(AIProvider):
    """Tries ``primary``; on any provider failure uses ``fallback`` (normally deterministic)."""

    def __init__(self, primary: AIProvider, fallback: AIProvider) -> None:
        self.primary = primary
        self.fallback = fallback
        self.name = primary.name

    def is_available(self) -> bool:
        return self.primary.is_available() or self.fallback.is_available()

    def complete(self, request: AIRequest) -> AIResponse:
        try:
            return self.primary.complete(request)
        except ProviderUnavailableError as exc:
            logger.warning("AI provider %s unavailable, using fallback: %s", self.primary.name, exc)
            response = self.fallback.complete(request)
            return response.model_copy(update={"fallback_used": True})
