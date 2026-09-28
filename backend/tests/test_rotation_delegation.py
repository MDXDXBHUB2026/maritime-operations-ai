"""Crew rotation (time-bound assignments, handover) and delegation of approval authority."""

from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Delegation, UserSiteAssignment
from tests.conftest import login


def _iso(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) + delta).isoformat()


def advance_clock(app, hours: float) -> None:
    """Simulate time passing by moving every stored period back (equivalent to 'now' moving forward)."""
    shift = timedelta(hours=hours)
    with app.state.session_factory() as s:
        for a in s.query(UserSiteAssignment).all():
            a.valid_from = a.valid_from - shift if a.valid_from else None
            a.valid_until = a.valid_until - shift if a.valid_until else None
        for d in s.query(Delegation).all():
            d.valid_from -= shift
            d.valid_until -= shift
        s.commit()


@pytest.fixture()
def ids(client, as_user):
    users = client.get("/api/v1/users", headers=as_user("admin")).json()
    return {u["username"]: u["user_id"] for u in users}


def _decision(client, as_user, domain, entity, user="duty.officer"):
    r = client.post(f"/api/v1/decisions/{domain}/{entity}", headers=as_user(user))
    assert r.status_code == 201, r.text
    return r.json()["recommendation_id"]


def _approve(client, headers, did):
    return client.post(f"/api/v1/decisions/{did}/approve", json={}, headers=headers)


def _handover(client, as_user, ids, incoming, when=None, role="master", site="VES-001"):
    body = {"role": role, "incoming_user_id": ids[incoming], "note": "Crew change at Jebel Ali"}
    if when is not None:
        body["effective_at"] = when
    return client.post(f"/api/v1/sites/{site}/handover", json=body, headers=as_user("admin"))


def _delegate(client, headers, ids, delegate, site="VES-001", domains=("voyage",), hours=8, start=None, **extra):
    body = {"delegate_user_id": ids[delegate], "site_id": site, "domains": list(domains),
            "valid_until": _iso(timedelta(hours=hours)), "reason": "Master ashore for port state meeting", **extra}
    if start is not None:
        body["valid_from"] = start
    return client.post("/api/v1/delegations", json=body, headers=headers)


# ---------------------------------------------------------------------------
# Crew rotation
# ---------------------------------------------------------------------------
def test_crew_listing(client, as_user):
    crew = client.get("/api/v1/sites/VES-001/crew", headers=as_user("viewer")).json()
    roles = {(m["role"], m["display_name"], m["status"]) for m in crew["crew"]}
    assert ("master", "Master, MV Horizon Star (demo)", "active") in roles
    assert ("chief_engineer", "Chief Engineer, MV Horizon Star (demo)", "active") in roles
    assert len(client.get("/api/v1/crew", headers=as_user("viewer")).json()) == 12


def test_immediate_handover_moves_authority(client, as_user, ids):
    did = _decision(client, as_user, "voyage", "VP-2601")
    r = _handover(client, as_user, ids, "relief.master")
    assert r.status_code == 200, r.text
    statuses = {m["display_name"]: m["status"] for m in r.json()["crew"] if m["role"] == "master"}
    assert statuses == {"Relief Master (demo)": "active"}

    old = _approve(client, as_user("master"), did)  # same session: authority gone immediately
    assert old.status_code == 403 and "no current site assignment" in old.json()["error"]["message"]
    assert _approve(client, as_user("relief.master"), did).status_code == 200

    event = next(e for e in client.get("/api/v1/audit-events", headers=as_user("admin")).json()
                 if e["action"] == "CREW_HANDOVER")
    assert event["details"]["outgoing"] == ["Master, MV Horizon Star (demo)"]
    assert event["details"]["incoming"] == "Relief Master (demo)"
    assert event["actor_role"] == "admin"


def test_scheduled_handover_takes_effect_on_time(app, client, as_user, ids):
    r = _handover(client, as_user, ids, "relief.master", when=_iso(timedelta(hours=2)))
    assert r.status_code == 200
    statuses = {m["display_name"]: m["status"] for m in r.json()["crew"] if m["role"] == "master"}
    assert statuses == {"Master, MV Horizon Star (demo)": "active", "Relief Master (demo)": "scheduled"}
    me = client.get("/api/v1/auth/me", headers=as_user("relief.master")).json()
    assert me["scope"]["sites"] == [] and me["scope"]["assignments"][0]["status"] == "scheduled"

    before = _decision(client, as_user, "voyage", "VP-2601")
    assert _approve(client, as_user("relief.master"), before).status_code == 403
    assert _approve(client, as_user("master"), before).status_code == 200

    advance_clock(app, 3)
    after = _decision(client, as_user, "voyage", "VP-2601")
    assert _approve(client, as_user("master"), after).status_code == 403
    assert _approve(client, as_user("relief.master"), after).status_code == 200


def test_handover_validation(client, as_user, ids):
    assert client.post("/api/v1/sites/VES-001/handover", headers=as_user("master"),
                       json={"role": "master", "incoming_user_id": ids["relief.master"]}).status_code == 403
    assert _handover(client, as_user, ids, "relief.master", site="TRM-NORTH-CONTAINER-TERMINAL").status_code == 422
    assert _handover(client, as_user, ids, "duty.officer").status_code == 422  # not a Master
    assert _handover(client, as_user, ids, "relief.master", when=_iso(-timedelta(hours=2))).status_code == 422
    # Two incoming Masters scheduled for the same vessel: the second handover must not overlap the first.
    assert _handover(client, as_user, ids, "relief.master", when=_iso(timedelta(hours=4))).status_code == 200
    clash = _handover(client, as_user, ids, "master.meridian", when=_iso(timedelta(hours=1)))
    assert clash.status_code == 409


def test_one_master_per_vessel_on_scope_edit(client, as_user, ids):
    r = client.patch(f"/api/v1/users/{ids['relief.master']}", headers=as_user("admin"),
                     json={"site_ids": ["VES-001"]})
    assert r.status_code == 409 and "crew handover" in r.json()["error"]["message"]


def test_scope_edit_preserves_scheduled_rotation(client, as_user, ids):
    _handover(client, as_user, ids, "relief.master", when=_iso(timedelta(hours=6)), site="VES-003")
    r = client.patch(f"/api/v1/users/{ids['relief.master']}", headers=as_user("admin"),
                     json={"display_name": "Relief Master A (demo)"})
    assert r.status_code == 200
    me = client.get("/api/v1/auth/me", headers=as_user("relief.master")).json()
    assert [a["status"] for a in me["scope"]["assignments"]] == ["scheduled"]


# ---------------------------------------------------------------------------
# Delegation
# ---------------------------------------------------------------------------
def test_delegate_acts_on_behalf_of_master_and_is_audited(client, as_user, ids):
    r = _delegate(client, as_user("master"), ids, "duty.officer")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "active" and r.json()["site"]["name"] == "MV Horizon Star"

    did = _decision(client, as_user, "voyage", "VP-2601")
    ok = _approve(client, as_user("duty.officer"), did)
    assert ok.status_code == 200
    assert ok.json()["decided_by"].startswith("Duty Officer (demo) on behalf of Master, MV Horizon Star")

    event = next(e for e in client.get("/api/v1/audit-events", params={"decision_id": did},
                                       headers=as_user("viewer")).json() if e["action"] == "APPROVED")
    assert event["actor_role"] == "operator"
    assert event["human_approval"]["delegated_from"]["on_behalf_of"] == "Master, MV Horizon Star (demo)"


def test_delegation_is_limited_to_its_site_and_domains(client, as_user, ids):
    _delegate(client, as_user("master"), ids, "duty.officer", domains=["voyage"])
    safety = _decision(client, as_user, "safety", "SE-0003", user="hse.manager")  # Horizon Star, not delegated
    assert _approve(client, as_user("duty.officer"), safety).json()["error"]["code"] == "forbidden"
    other_vessel = _decision(client, as_user, "voyage", "VP-2603")  # MV Meridian
    assert _approve(client, as_user("duty.officer"), other_vessel).json()["error"]["code"] == "forbidden"


def test_delegation_extends_request_scope_for_site_limited_users(client, as_user, ids):
    admin = as_user("admin")
    mate = client.post("/api/v1/users", headers=admin, json={
        "username": "chief.officer", "display_name": "Chief Officer, MV Meridian", "role": "operator",
        "password": "Str0ng-Password", "site_ids": ["VES-003"]}).json()
    ids["chief.officer"] = mate["user_id"]
    headers = login(client, "chief.officer", "Str0ng-Password")
    assert client.post("/api/v1/decisions/voyage/VP-2601", headers=headers).status_code == 403
    _delegate(client, as_user("master"), ids, "chief.officer")
    assert client.post("/api/v1/decisions/voyage/VP-2601", headers=headers).status_code == 201


def test_delegation_creation_rules(client, as_user, ids):
    master = as_user("master")
    assert _delegate(client, master, ids, "duty.officer", domains=["anomaly"]).status_code == 403  # not held
    assert _delegate(client, master, ids, "duty.officer", site="VES-003").json()["error"]["code"] == "out_of_scope"
    assert _delegate(client, master, ids, "viewer").status_code == 403
    assert _delegate(client, master, ids, "admin").status_code == 403
    assert _delegate(client, master, ids, "master").status_code == 422  # self
    assert _delegate(client, master, ids, "duty.officer", hours=24 * 31).json()["error"]["code"] == "invalid_period"
    assert _delegate(client, master, ids, "duty.officer", start=_iso(-timedelta(hours=3))).status_code == 422
    # No re-delegation: the delegate cannot pass on authority they only hold by delegation.
    _delegate(client, master, ids, "duty.officer")
    assert _delegate(client, as_user("duty.officer"), ids, "marine.super").status_code == 403


def test_revocation(client, as_user, ids):
    d = _delegate(client, as_user("master"), ids, "duty.officer").json()
    assert client.post(f"/api/v1/delegations/{d['delegation_id']}/revoke", json={"reason": "not mine"},
                       headers=as_user("hse.manager")).status_code == 403
    r = client.post(f"/api/v1/delegations/{d['delegation_id']}/revoke", json={"reason": "Master back on board"},
                    headers=as_user("master"))
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    did = _decision(client, as_user, "voyage", "VP-2601")
    assert _approve(client, as_user("duty.officer"), did).status_code == 403
    actions = [e["action"] for e in client.get("/api/v1/audit-events", headers=as_user("admin")).json()]
    assert "DELEGATION_CREATED" in actions and "DELEGATION_REVOKED" in actions


def test_delegation_lapses_when_delegator_rotates_off(client, as_user, ids):
    _delegate(client, as_user("master"), ids, "duty.officer")
    _handover(client, as_user, ids, "relief.master")
    did = _decision(client, as_user, "voyage", "VP-2601")
    assert _approve(client, as_user("duty.officer"), did).status_code == 403
    listed = client.get("/api/v1/delegations", headers=as_user("duty.officer")).json()
    assert listed[0]["status"] == "suspended" and "no longer assigned" in listed[0]["status_note"]


def test_four_eyes_applies_to_delegates(client, as_user, ids):
    _delegate(client, as_user("master"), ids, "duty.officer", domains=["safety"])
    did = _decision(client, as_user, "safety", "SE-0003")  # requested by duty.officer, safety-critical
    r = _approve(client, as_user("duty.officer"), did)
    assert r.json()["error"]["code"] == "separation_of_duties"


def test_scheduled_delegation_starts_on_time(app, client, as_user, ids):
    d = _delegate(client, as_user("master"), ids, "duty.officer", start=_iso(timedelta(hours=1)), hours=5).json()
    assert d["status"] == "scheduled"
    did = _decision(client, as_user, "voyage", "VP-2601")
    assert _approve(client, as_user("duty.officer"), did).status_code == 403
    advance_clock(app, 2)
    assert _approve(client, as_user("duty.officer"), did).status_code == 200


def test_delegation_visibility(client, as_user, ids):
    _delegate(client, as_user("master"), ids, "duty.officer")
    assert len(client.get("/api/v1/delegations", headers=as_user("master")).json()) == 1
    assert len(client.get("/api/v1/delegations", headers=as_user("duty.officer")).json()) == 1
    assert client.get("/api/v1/delegations", headers=as_user("hse.manager")).json() == []
    assert len(client.get("/api/v1/delegations", headers=as_user("admin")).json()) == 1
    me = client.get("/api/v1/auth/me", headers=as_user("duty.officer")).json()
    assert me["scope"]["delegations_received"][0]["delegator"] == "Master, MV Horizon Star (demo)"
    eligible = client.get("/api/v1/delegations/eligible-delegates", headers=as_user("master")).json()
    names = {e["role"] for e in eligible}
    assert "viewer" not in names and "admin" not in names
