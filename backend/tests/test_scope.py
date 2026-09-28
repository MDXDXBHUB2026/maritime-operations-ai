"""Per-vessel / per-site approval scope."""

from app.db.models import DecisionRecord, User

ADMIN_NEW = {"display_name": "Test User", "password": "Str0ng-Password"}


def _create(client, headers, domain, entity):
    return client.post(f"/api/v1/decisions/{domain}/{entity}", headers=headers)


def _approve(client, headers, did):
    return client.post(f"/api/v1/decisions/{did}/approve", json={}, headers=headers)


def test_master_can_only_approve_for_assigned_vessel(client, as_user):
    officer = as_user("duty.officer")
    meridian = _create(client, officer, "voyage", "VP-2603").json()
    assert meridian["site_id"] == "VES-003" and meridian["site_name"] == "MV Meridian"

    r = _approve(client, as_user("master"), meridian["recommendation_id"])
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "out_of_scope"
    assert "MV Meridian" in r.json()["error"]["message"] and "MV Horizon Star" in r.json()["error"]["message"]

    assert _approve(client, as_user("master.meridian"), meridian["recommendation_id"]).status_code == 200


def test_shipboard_roles_have_no_authority_over_terminals(client, as_user):
    d = _create(client, as_user("duty.officer"), "maintenance", "MA-006").json()  # South Container Terminal
    assert d["site_id"] == "TRM-SOUTH-CONTAINER-TERMINAL"
    assert _approve(client, as_user("chief.engineer"), d["recommendation_id"]).json()["error"]["code"] == \
        "out_of_scope"
    assert _approve(client, as_user("tech.super"), d["recommendation_id"]).status_code == 200


def test_scope_applies_to_every_write_action(client, as_user):
    master = as_user("master")
    assert _create(client, master, "voyage", "VP-2603").status_code == 403  # request outside scope
    did = _create(client, as_user("duty.officer"), "safety", "SE-0004").json()["recommendation_id"]  # Meridian
    for verb, body in (("review", {}), ("reject", {"reason": "not mine"}), ("cancel", {"reason": "not mine"})):
        r = client.post(f"/api/v1/decisions/{did}/{verb}", json=body, headers=master)
        assert r.status_code == 403, verb
    _approve(client, as_user("hse.manager"), did)
    r = client.post(f"/api/v1/decisions/{did}/execute", headers=master)
    assert r.json()["error"]["code"] == "out_of_scope"
    assert client.post(f"/api/v1/decisions/{did}/execute", headers=as_user("master.meridian")).status_code == 200


def test_reading_stays_fleet_wide(client, as_user):
    did = _create(client, as_user("duty.officer"), "voyage", "VP-2603").json()["recommendation_id"]
    assert client.get(f"/api/v1/decisions/{did}", headers=as_user("master")).status_code == 200
    assert len(client.get("/api/v1/vessels", headers=as_user("master")).json()) == 10


def test_sites_catalog_and_me_scope(client, as_user):
    sites = client.get("/api/v1/sites", headers=as_user("viewer")).json()
    assert len(sites) == 12
    assert {"site_id": "TRM-NORTH-CONTAINER-TERMINAL", "name": "North Container Terminal",
            "site_type": "terminal"} in sites
    me = client.get("/api/v1/auth/me", headers=as_user("hse.manager")).json()
    assert me["scope"]["fleet_wide"] is True and me["scope"]["sites"] == []


def test_scope_validation_rules(client, as_user):
    admin = as_user("admin")

    def create(username, **extra):
        return client.post("/api/v1/users", headers=admin, json={"username": username, **ADMIN_NEW, **extra})

    standby = create("m.one", role="master")  # no vessel = standby / on leave: allowed, but no authority
    assert standby.status_code == 201 and standby.json()["sites"] == [] and standby.json()["fleet_wide"] is False
    # One Master per vessel: MV Horizon Star already has one.
    taken = create("m.five", role="master", site_ids=["VES-001"])
    assert taken.status_code == 409 and "crew handover" in taken.json()["error"]["message"]
    assert create("m.two", role="master", fleet_wide=True).status_code == 422
    assert "terminals" in create("m.three", role="master",
                                 site_ids=["TRM-NORTH-CONTAINER-TERMINAL"]).json()["error"]["message"]
    assert "Unknown site" in create("m.four", role="master", site_ids=["VES-999"]).json()["error"]["message"]
    assert create("s.one", role="hse_manager", fleet_wide=False).status_code == 422
    assert create("v.one", role="viewer", site_ids=["VES-001"]).status_code == 422
    ok = create("hse.north", role="hse_manager", site_ids=["TRM-NORTH-CONTAINER-TERMINAL"])
    assert ok.status_code == 201 and ok.json()["fleet_wide"] is False
    shore = create("tech.two", role="technical_superintendent")
    assert shore.json()["fleet_wide"] is True  # shore roles default to fleet-wide


def test_site_limited_shore_role(client, as_user):
    from tests.conftest import login

    admin = as_user("admin")
    client.post("/api/v1/users", headers=admin, json={
        "username": "hse.north", "role": "hse_manager", "site_ids": ["TRM-NORTH-CONTAINER-TERMINAL"], **ADMIN_NEW})
    headers = login(client, "hse.north", "Str0ng-Password")
    officer = as_user("duty.officer")
    north = _create(client, officer, "safety", "SE-0001").json()["recommendation_id"]
    south = _create(client, officer, "safety", "SE-0002").json()["recommendation_id"]
    assert _approve(client, headers, north).status_code == 200
    assert _approve(client, headers, south).json()["error"]["code"] == "out_of_scope"


def test_scope_change_takes_effect_immediately_and_is_audited(client, as_user):
    admin = as_user("admin")
    master = as_user("master")
    did = _create(client, as_user("duty.officer"), "voyage", "VP-2602").json()["recommendation_id"]  # Ocean Crest
    assert _approve(client, master, did).status_code == 403
    users = {u["username"]: u for u in client.get("/api/v1/users", headers=admin).json()}
    r = client.patch(f"/api/v1/users/{users['master']['user_id']}", headers=admin,
                     json={"site_ids": ["VES-001", "VES-002"]})
    assert r.status_code == 200
    assert _approve(client, master, did).status_code == 200  # same session, new scope
    events = client.get("/api/v1/audit-events", headers=admin).json()
    update = next(e for e in events if e["action"] == "USER_UPDATED")
    assert update["details"]["changes"]["site_ids"] == [["VES-001"], ["VES-001", "VES-002"]]


def test_accounts_without_scope_fail_closed(app, client, as_user):
    headers = as_user("tech.super")
    with app.state.session_factory() as s:
        user = s.query(User).filter_by(username="tech.super").one()
        user.fleet_wide = None  # legacy account created before site scoping
        s.commit()
    r = _create(client, headers, "anomaly", "ANM-0001")
    assert r.status_code == 403 and "no current site assignment" in r.json()["error"]["message"]


def test_legacy_decision_without_site_is_resolved(app, client, as_user):
    did = _create(client, as_user("duty.officer"), "voyage", "VP-2603").json()["recommendation_id"]
    with app.state.session_factory() as s:
        rec = s.get(DecisionRecord, did)
        rec.site_id = rec.site_name = None
        s.commit()
    assert _approve(client, as_user("master"), did).json()["error"]["code"] == "out_of_scope"
    r = _approve(client, as_user("master.meridian"), did)
    assert r.status_code == 200 and r.json()["site_id"] == "VES-003"


def test_assigning_sites_to_fleet_wide_user_limits_scope(client, as_user):
    admin = as_user("admin")
    users = {u["username"]: u for u in client.get("/api/v1/users", headers=admin).json()}
    r = client.patch(f"/api/v1/users/{users['marine.super']['user_id']}", headers=admin,
                     json={"site_ids": ["VES-003"]})
    assert r.json()["fleet_wide"] is False and [s["site_id"] for s in r.json()["sites"]] == ["VES-003"]
    r = client.patch(f"/api/v1/users/{users['marine.super']['user_id']}", headers=admin,
                     json={"fleet_wide": True, "site_ids": []})
    assert r.json()["fleet_wide"] is True and r.json()["sites"] == []
