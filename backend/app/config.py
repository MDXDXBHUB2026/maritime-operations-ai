"""Application configuration loaded from environment variables (and optional backend/.env)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Maritime Operations AI - Decision Support API"
    api_prefix: str = "/api/v1"

    database_url: str = f"sqlite:///{BACKEND_DIR / 'maritime_ai.db'}"
    data_dir: Path = REPO_ROOT / "public" / "data"

    # Stored as a comma-separated string so it can be supplied as a plain env var.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"

    ai_provider: Literal["deterministic", "ollama"] = "deterministic"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_timeout_seconds: float = Field(default=20.0, gt=0, le=120)

    # Authentication
    session_ttl_minutes: int = Field(default=480, ge=5, le=7 * 24 * 60)
    password_hash_iterations: int = Field(default=600_000, ge=1_000)
    login_max_failures: int = Field(default=5, ge=1, le=50)
    login_lockout_minutes: int = Field(default=15, ge=1, le=24 * 60)
    # Longest period a delegation of approval authority may cover.
    max_delegation_days: int = Field(default=30, ge=1, le=180)
    # When set, the demo role accounts are created at startup with this password (never committed).
    demo_users_password: Optional[SecretStr] = None
    # Public demo: allows one-click sign-in to the non-admin demo accounts without a password.
    # Only for a synthetic-data showcase deployment; never enable where real data is held.
    public_demo: bool = False
    # Set on serverless hosts (e.g. Vercel) so database connections are not pooled per instance.
    serverless: bool = False

    @field_validator("data_dir")
    @classmethod
    def _resolve_data_dir(cls, value: Path) -> Path:
        return value if value.is_absolute() else (BACKEND_DIR / value).resolve()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip() and o.strip() != "*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
