"""Optional local-LLM provider using an Ollama server (https://ollama.com).

Only the narrative text comes from the model; severity, evidence and actions stay
deterministic. Any failure raises ProviderUnavailableError so callers fall back.
"""

from __future__ import annotations

import json

import httpx

from app.ai.provider import AIProvider, NarrativeRequest, NarrativeResponse, ProviderUnavailableError

_PROMPT = """You are a maritime operations decision-support assistant.
Write a concise operational summary (one sentence) and rationale (max three sentences)
using ONLY the facts below. Do not invent values. State that human approval is required.
Respond as JSON: {{"summary": "...", "rationale": "..."}}

Agent: {agent}
Entity: {entity_id}
Severity: {severity}
Finding: {headline}
Facts:
{facts}
Proposed actions:
{actions}
"""


class OllamaProvider(AIProvider):
    def __init__(self, base_url: str, model: str, timeout_seconds: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.name = f"ollama:{model}"

    def _prompt(self, request: NarrativeRequest) -> str:
        return _PROMPT.format(
            agent=request.agent,
            entity_id=request.entity_id,
            severity=request.severity,
            headline=request.headline,
            facts="\n".join(f"- {f}" for f in request.facts),
            actions="\n".join(f"- {a}" for a in request.actions),
        )

    def generate_narrative(self, request: NarrativeRequest) -> NarrativeResponse:
        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": self._prompt(request), "stream": False, "format": "json"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            body = json.loads(response.json()["response"])
            summary = str(body["summary"]).strip()
            rationale = str(body["rationale"]).strip()
        except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
            raise ProviderUnavailableError(f"Ollama request failed: {exc}") from exc
        if not summary or not rationale:
            raise ProviderUnavailableError("Ollama returned an empty narrative")
        return NarrativeResponse(summary=summary[:500], rationale=rationale[:2000], provider=self.name)

    def is_available(self) -> bool:
        try:
            return httpx.get(f"{self.base_url}/api/tags", timeout=2.0).status_code == 200
        except httpx.HTTPError:
            return False
