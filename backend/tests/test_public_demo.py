from fastapi.testclient import TestClient

from app.db.session import normalize_database_url
from app.main import create_app


def test_demo_login_is_disabled_by_default(client):
    assert client.get("/api/v1/auth/demo-accounts").json() == []
    r = client.post("/api/v1/auth/demo-login", json={"username": "master"})
    assert r.status_code == 403


def _public_client(settings) -> TestClient:
    return TestClient(create_app(settings.model_copy(update={"public_demo": True})))


def test_public_demo_lists_non_admin_accounts(settings):
    client = _public_client(settings)
    accounts = client.get("/api/v1/auth/demo-accounts").json()
    names = {a["username"] for a in accounts}
    assert {"duty.officer", "master", "hse.manager", "viewer"} <= names
    assert "admin" not in names


def test_public_demo_login_issues_a_normal_session(settings):
    client = _public_client(settings)
    r = client.post("/api/v1/auth/demo-login", json={"username": "Master"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "master"
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["username"] == "master"


def test_public_demo_never_signs_in_admin_or_unknown_accounts(settings):
    client = _public_client(settings)
    for username in ("admin", "nobody"):
        r = client.post("/api/v1/auth/demo-login", json={"username": username})
        assert r.status_code == 401


def test_postgres_urls_use_psycopg_driver():
    assert normalize_database_url("postgres://u:p@h:5432/db") == "postgresql+psycopg://u:p@h:5432/db"
    assert normalize_database_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_database_url("sqlite:///x.db") == "sqlite:///x.db"
