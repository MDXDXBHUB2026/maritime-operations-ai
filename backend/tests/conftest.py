from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_ROOT, Settings
from app.main import create_app

# Synthetic test-only credential (tests run against a temporary database).
TEST_PASSWORD = "Test-Passw0rd-Only"


@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        data_dir=REPO_ROOT / "public" / "data",
        ai_provider="deterministic",
        password_hash_iterations=1_000,  # fast hashing for tests only
        demo_users_password=TEST_PASSWORD,
        login_max_failures=3,
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


def login(client: TestClient, username: str, password: str = TEST_PASSWORD) -> dict[str, str]:
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def as_user(client):
    """Return auth headers for a demo account, caching one session per username."""
    cache: dict[str, dict[str, str]] = {}

    def _headers(username: str) -> dict[str, str]:
        if username not in cache:
            cache[username] = login(client, username)
        return cache[username]

    return _headers


@pytest.fixture()
def auth_client(client, as_user):
    """A client whose requests default to the duty officer's session."""
    client.headers.update(as_user("duty.officer"))
    return client
