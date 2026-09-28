from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_ROOT, Settings
from app.main import create_app


@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        data_dir=REPO_ROOT / "public" / "data",
        ai_provider="deterministic",
    )


@pytest.fixture()
def app(settings):
    return create_app(settings)


@pytest.fixture()
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture()
def repository(app):
    return app.state.repository
