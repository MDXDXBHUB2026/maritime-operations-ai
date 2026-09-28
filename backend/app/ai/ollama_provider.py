"""Optional local LLM provider using an Ollama server (https://ollama.com).

No API key is involved. Every failure is converted into ``ProviderUnavailableError`` so
callers can fall back to the deterministic provider.
"""

import json

import httpx

from app.ai.provider import AIProvider, AIRequest, AIResponse, ProviderUnavailableError

_SYSTEM_PROMPT = (
    "You are a maritime operations decision-support assistant. Write a short, factual "
    "summary for a human operator using ONLY the facts provided. Do not invent values, "
    "do not add actions that are not listed, do not state that anything has been done, "
    "and do not give instructions to crew. Plain text only."
)


class OllamaProvider(AIProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float = 20.0,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = client or httpx.Client(timeout=timeout_seconds)

    def is_available(self) -> bool:
        try:
            response = self._client.get(f"{self.base_url}/api/tags", timeout=2.0)
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    def complete(self, request: AIRequest) -> AIResponse:
        prompt = (
            f"Task: {request.task}\n"
            f"Maximum length: {request.max_words} words.\n"
            f"Facts (JSON):\n{json.dumps(request.facts, default=str, sort_keys=True)}"
        )
        payload = {
            "model": self.model,
            "system": _SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0},
        }
        try:
            response = self._client.post(f"{self.base_url}/api/generate", json=payload)
            response.raise_for_status()
            text = str(response.json().get("response", "")).strip()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailableError(f"Ollama request failed: {exc}") from exc
        if not text:
            raise ProviderUnavailableError("Ollama returned an empty response")
        return AIResponse(text=text, provider=self.name, model=self.model)
