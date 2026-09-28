"""Application configuration.

All settings are read from environment variables (or a local ``.env`` file in the
``backend/`` directory). No secrets are required to run the backend.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPO_ROOT / "public" / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Maritime Operations AI Backend"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "production"] = "development"

    # SQLite by default for zero-configuration local development.
    # PostgreSQL example: postgresql+psycopg://user:password@host:5432/maritime_ai
    database_url: str = "sqlite:///./maritime_ai.db"

    # Phase 1 operational data source: the same JSON datasets the static frontend uses.
    data_dir: Path = DEFAULT_DATA_DIR

    # Comma-separated list of allowed browser origins. Never "*" in production.
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:4173"]
    )

    # AI provider: "deterministic" (default, no network, no keys) or "ollama" (optional local LLM).
    ai_provider: Literal["deterministic", "ollama"] = "deterministic"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_timeout_seconds: float = Field(default=20.0, gt=0, le=120)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            if value.strip().startswith("["):
                return value  # JSON list, let pydantic parse it
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _reject_wildcard(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("Wildcard CORS origin is not permitted; list explicit origins.")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
