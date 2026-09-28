from datetime import datetime, timedelta, timezone

from app.db.models import AuthSession, User
from app.security.passwords import hash_password, hash_token, verify_password
from tests.conftest import TEST_PASSWORD, login


def test_login_returns_session_and_permissions(client):
    r = client.post("/api/v1/auth/login", json={"username": "chief.engineer", "password": TEST_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and len(body["access_token"]) >= 40
    user = body["user"]
    assert user["role"] == "chief_engineer" and user["role_label"] == "Chief Engineer"
    assert user["permissions"]["approve_domains"] == ["anomaly", "maintenance"]
    assert user["permissions"]["can_manage_users"] is False
    assert "password" not in r.text.lower().replace("password_", "")


def test_username_is_case_insensitive(client):
    assert client.post("/api/v1/auth/login",
                       json={"username": "Chief.Engineer", "password": TEST_PASSWORD}).status_code == 200


def test_bad_credentials_are_rejected_with_generic_message(client):
    for username in ("chief.engineer", "nobody"):
        r = client.post("/api/v1/auth/login", json={"username": username, "password": "wrong-password"})
        assert r.status_code == 401
        assert r.json()["error"]["message"] == "Invalid username or password"


def test_account_locks_after_repeated_failures(client):
    for _ in range(3):  # conftest sets login_max_failures=3
        client.post("/api/v1/auth/login", json={"username": "master", "password": "wrong-password"})
    r = client.post("/api/v1/auth/login", json={"username": "master", "password": TEST_PASSWORD})
    assert r.status_code == 401
    assert "locked" in r.json()["error"]["message"]


def test_me_and_logout_revokes_session(client):
    headers = login(client, "hse.manager")
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["username"] == "hse.manager" and me["permissions"]["approve_domains"] == ["safety"]
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_expired_session_is_rejected(app, client):
    headers = login(client, "viewer")
    token = headers["Authorization"].split()[1]
    with app.state.session_factory() as s:
        rec = s.query(AuthSession).filter_by(token_hash=hash_token(token)).one()
        rec.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        s.commit()
    assert client.get("/api/v1/vessels", headers=headers).status_code == 401


def test_tokens_and_passwords_are_stored_hashed(app, client):
    headers = login(client, "viewer")
    token = headers["Authorization"].split()[1]
    with app.state.session_factory() as s:
        assert s.query(AuthSession).filter_by(token_hash=token).count() == 0
        user = s.query(User).filter_by(username="viewer").one()
        assert TEST_PASSWORD not in user.password_hash
        assert user.password_hash.startswith("pbkdf2_sha256$")


def test_password_hashing_roundtrip():
    stored = hash_password("Correct-Horse-9", 1_000)
    assert verify_password("Correct-Horse-9", stored)
    assert not verify_password("correct-horse-9", stored)
    assert not verify_password("anything", "malformed")


def test_login_events_are_audited(client, as_user):
    client.post("/api/v1/auth/login", json={"username": "master", "password": "wrong-password"})
    login(client, "master")
    events = client.get("/api/v1/audit-events", headers=as_user("viewer")).json()
    actions = [e["action"] for e in events]
    assert "LOGIN_FAILED" in actions and "LOGIN_SUCCEEDED" in actions
    failed = next(e for e in events if e["action"] == "LOGIN_FAILED")
    assert failed["details"]["reason"] == "bad_password"
    assert TEST_PASSWORD not in str(events)


def test_admin_manages_users_and_changes_are_audited(client, as_user):
    admin = as_user("admin")
    r = client.post("/api/v1/users", headers=admin, json={
        "username": "c.officer", "display_name": "Chief Officer", "role": "operator",
        "password": "Str0ng-Password"})
    assert r.status_code == 201, r.text
    new_id = r.json()["user_id"]
    user_headers = login(client, "c.officer", "Str0ng-Password")

    # Role change revokes existing sessions.
    r = client.patch(f"/api/v1/users/{new_id}", headers=admin, json={"role": "master"})
    assert r.json()["role"] == "master"
    assert client.get("/api/v1/auth/me", headers=user_headers).status_code == 401

    # Deactivated users cannot log in.
    client.patch(f"/api/v1/users/{new_id}", headers=admin, json={"is_active": False})
    assert client.post("/api/v1/auth/login",
                       json={"username": "c.officer", "password": "Str0ng-Password"}).status_code == 401

    actions = [e["action"] for e in client.get("/api/v1/audit-events", headers=admin).json()]
    assert actions.count("USER_UPDATED") == 2 and "USER_CREATED" in actions
    listing = client.get("/api/v1/users", headers=admin).json()
    assert all("password" not in u and "password_hash" not in u for u in listing)


def test_user_admin_rules(client, as_user):
    assert client.get("/api/v1/users", headers=as_user("master")).status_code == 403
    admin = as_user("admin")
    weak = client.post("/api/v1/users", headers=admin, json={
        "username": "weak.user", "display_name": "Weak", "role": "viewer", "password": "alllowercase1"})
    assert weak.status_code == 422 and weak.json()["error"]["code"] == "password_policy"
    dup = client.post("/api/v1/users", headers=admin, json={
        "username": "master", "display_name": "Dup", "role": "viewer", "password": "Str0ng-Password"})
    assert dup.status_code == 409
    me = client.get("/api/v1/auth/me", headers=admin).json()
    r = client.patch(f"/api/v1/users/{me['user_id']}", headers=admin, json={"role": "master"})
    assert r.status_code == 403


def test_demo_users_not_created_without_configured_password(tmp_path):
    from fastapi.testclient import TestClient

    from app.config import REPO_ROOT, Settings
    from app.main import create_app

    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'x.db'}", data_dir=REPO_ROOT / "public" / "data"))
    c = TestClient(app)
    assert c.post("/api/v1/auth/login", json={"username": "admin", "password": TEST_PASSWORD}).status_code == 401


def test_actor_label_includes_role_unless_already_stated():
    from app.domain.enums import Role
    from app.domain.models import Principal

    assert Principal(user_id="1", username="a", display_name="J. Smith", role=Role.MASTER).actor_label == \
        "J. Smith (Master)"
    assert Principal(user_id="1", username="a", display_name="Master (demo)", role=Role.MASTER).actor_label == \
        "Master (demo)"
