from app.ai.deterministic_provider import DeterministicProvider
from app.ai.ollama_provider import OllamaProvider
from app.ai.provider import AIProvider, FallbackProvider
from app.config import Settings


def build_provider(settings: Settings) -> AIProvider:
    deterministic = DeterministicProvider()
    if settings.ai_provider == "ollama":
        ollama = OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )
        return FallbackProvider(primary=ollama, fallback=deterministic)
    return deterministic
