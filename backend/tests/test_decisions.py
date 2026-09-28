import pytest

# Demo accounts seeded by conftest (roles in brackets):
# duty.officer [operator], chief.engineer, tech.super [technical_superintendent], master,
# marine.super [marine_superintendent], hse.manager, viewer, admin

APPROVER_FOR = {
    "anomaly": "chief.engineer",
    "maintenance": "tech.super",
    "voyage": "master",
    "safety": "hse.manager",
}


def _create(client, as_user, domain="anomaly", entity="ANM-0001", user="duty.officer"):
    r = client.post(f"/api/v1/decisions/{domain}/{entity}", headers=as_user(user))
    assert r.status_code == 201, r.text
    return r.json()


def _post(client, as_user, user, decision_id, verb, body=None):
    return client.post(f"/api/v1/decisions/{decision_id}/{verb}", json=body, headers=as_user(user))


def _audit(client, as_user, decision_id):
    return client.get("/api/v1/audit-events", params={"decision_id": decision_id},
                      headers=as_user("viewer")).json()


@pytest.mark.parametrize("domain,entity", [("anomaly", "ANM-0003"), ("maintenance", "MA-002"),
                                           ("voyage", "VP-2602"), ("safety", "SE-0003")])
def test_recommendation_creation_is_proposed_and_attributed(client, as_user, domain, entity):
    d = _create(client, as_user, domain, entity)
    assert d["status"] == "PROPOSED"
    assert d["agent"] == domain and d["entity_id"] == entity
    assert d["requires_human_approval"] is True
    assert d["execution_mode"] is None
    assert d["created_by"] == "Duty Officer (demo)"
    assert d["created_by_role"] == "operator"
    fetched = client.get(f"/api/v1/decisions/{d['recommendation_id']}", headers=as_user("viewer")).json()
    assert fetched == d


def test_generate_for_unknown_entity_returns_404(client, as_user):
    assert client.post("/api/v1/decisions/anomaly/ANM-9999", headers=as_user("duty.officer")).status_code == 404


def test_identity_cannot_be_supplied_in_request_body(client, as_user):
    did = _create(client, as_user)["recommendation_id"]
    r = _post(client, as_user, "chief.engineer", did, "approve", {"approver": "Someone Else"})
    assert r.status_code == 422  # extra fields are forbidden; identity comes from the session


def test_approval_state_transition(client, as_user):
    did = _create(client, as_user)["recommendation_id"]
    r = _post(client, as_user, "duty.officer", did, "review", {"comment": "Checked trend"})
    assert r.json()["status"] == "UNDER_REVIEW"
    r = _post(client, as_user, "chief.engineer", did, "approve", {"comment": "Agreed"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "APPROVED"
    assert body["decided_by"] == "Chief Engineer (demo)"
    assert body["decided_by_role"] == "chief_engineer" and body["decided_at"]


def test_rejection_state_transition(client, as_user):
    did = _create(client, as_user, "maintenance", "MA-004")["recommendation_id"]
    r = _post(client, as_user, "tech.super", did, "reject", {"reason": "Spare on order"})
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"
    again = _post(client, as_user, "tech.super", did, "approve", {})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invalid_state_transition"


def test_reject_requires_reason(client, as_user):
    did = _create(client, as_user)["recommendation_id"]
    assert _post(client, as_user, "chief.engineer", did, "reject", {}).status_code == 422


@pytest.mark.parametrize("domain,entity,allowed,denied", [
    ("anomaly", "ANM-0004", ["chief.engineer", "tech.super"], ["master", "hse.manager", "duty.officer"]),
    ("maintenance", "MA-005", ["chief.engineer", "tech.super"], ["master", "marine.super"]),
    ("voyage", "VP-2603", ["master", "marine.super"], ["chief.engineer", "hse.manager"]),
    ("safety", "SE-0005", ["hse.manager", "master"], ["chief.engineer", "tech.super", "marine.super"]),
])
def test_approval_authority_follows_domain(client, as_user, domain, entity, allowed, denied):
    for user in denied + ["viewer", "admin"]:
        did = _create(client, as_user, domain, entity)["recommendation_id"]
        r = _post(client, as_user, user, did, "approve", {})
        assert r.status_code == 403, (user, r.text)
        assert r.json()["error"]["code"] == "forbidden"
        assert "requires" in r.json()["error"]["message"] or user in ("viewer", "admin")
    for user in allowed:
        did = _create(client, as_user, domain, entity)["recommendation_id"]
        assert _post(client, as_user, user, did, "approve", {}).status_code == 200, user


def test_viewer_and_admin_cannot_generate_or_review(client, as_user):
    for user in ("viewer", "admin"):
        r = client.post("/api/v1/decisions/anomaly/ANM-0001", headers=as_user(user))
        assert r.status_code == 403
    did = _create(client, as_user)["recommendation_id"]
    assert _post(client, as_user, "viewer", did, "review", {}).status_code == 403


def test_four_eyes_for_safety_critical_decisions(client, as_user):
    d = _create(client, as_user, "safety", "SE-0006", user="hse.manager")
    assert d["safety_critical"] is True
    r = _post(client, as_user, "hse.manager", d["recommendation_id"], "approve", {})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "separation_of_duties"
    # A different authorised person can approve it.
    assert _post(client, as_user, "master", d["recommendation_id"], "approve", {}).status_code == 200


def test_requester_may_approve_non_safety_critical(client, as_user):
    d = _create(client, as_user, "anomaly", "ANM-0001", user="chief.engineer")
    assert d["safety_critical"] is False
    assert _post(client, as_user, "chief.engineer", d["recommendation_id"], "approve", {}).status_code == 200


def test_forbidden_automatic_execution(client, as_user):
    d = _create(client, as_user, "safety", "SE-0004")
    did = d["recommendation_id"]
    r = _post(client, as_user, "hse.manager", did, "execute")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "human_approval_required"
    viewer_get = client.get(f"/api/v1/decisions/{did}", headers=as_user("viewer")).json()
    assert viewer_get["status"] == "PROPOSED"


def test_execution_only_after_approval_by_authorised_role(client, as_user):
    did = _create(client, as_user, "voyage", "VP-2604")["recommendation_id"]
    _post(client, as_user, "master", did, "approve", {"comment": "Proceed"})
    assert _post(client, as_user, "duty.officer", did, "execute").status_code == 403
    r = _post(client, as_user, "marine.super", did, "execute")
    assert r.status_code == 200
    assert r.json()["status"] == "EXECUTED" and r.json()["execution_mode"] == "simulated"
    assert _post(client, as_user, "master", did, "cancel", {"reason": "late"}).status_code == 409


def test_audit_events_record_authenticated_identity_and_role(client, as_user):
    did = _create(client, as_user)["recommendation_id"]
    _post(client, as_user, "duty.officer", did, "review", {})
    _post(client, as_user, "chief.engineer", did, "approve", {"comment": "Reviewed trend data"})
    _post(client, as_user, "tech.super", did, "execute")
    events = sorted(_audit(client, as_user, did), key=lambda e: e["timestamp"])
    assert [e["action"] for e in events] == ["RECOMMENDATION_CREATED", "REVIEW_STARTED", "APPROVED",
                                             "EXECUTED_SIMULATED"]
    assert [(e["previous_state"], e["new_state"]) for e in events] == [
        (None, "PROPOSED"), ("PROPOSED", "UNDER_REVIEW"), ("UNDER_REVIEW", "APPROVED"), ("APPROVED", "EXECUTED")]
    assert [e["actor_role"] for e in events] == ["operator", "operator", "chief_engineer",
                                                 "technical_superintendent"]
    assert all(e["actor_user_id"] for e in events)
    approval = events[2]["human_approval"]
    assert approval["approved"] is True and approval["approver_role"] == "chief_engineer"
    assert approval["comment"] == "Reviewed trend data"


def test_failed_transition_writes_no_audit_event(client, as_user):
    did = _create(client, as_user)["recommendation_id"]
    _post(client, as_user, "chief.engineer", did, "execute")
    _post(client, as_user, "master", did, "approve", {})
    assert len(_audit(client, as_user, did)) == 1


def test_decisions_persist_across_app_instances(settings, client, as_user):
    from fastapi.testclient import TestClient

    from app.main import create_app

    did = _create(client, as_user)["recommendation_id"]
    fresh = TestClient(create_app(settings))
    headers = as_user("viewer")  # sessions are persistent too
    assert fresh.get(f"/api/v1/decisions/{did}", headers=headers).json()["status"] == "PROPOSED"


def test_invalid_decision_id_is_validated(client, as_user):
    assert client.get("/api/v1/decisions/not-a-uuid", headers=as_user("viewer")).status_code == 422


def test_list_decisions_filters_by_entity_status_and_agent(client, as_user):
    a = _create(client, as_user, "anomaly", "ANM-0010")["recommendation_id"]
    _create(client, as_user, "safety", "SE-0011")
    _post(client, as_user, "chief.engineer", a, "approve", {})
    h = as_user("viewer")
    by_entity = client.get("/api/v1/decisions", params={"entity_id": "ANM-0010"}, headers=h).json()
    assert [d["recommendation_id"] for d in by_entity] == [a]
    assert len(client.get("/api/v1/decisions", params={"status": "APPROVED"}, headers=h).json()) == 1
    assert len(client.get("/api/v1/decisions", params={"agent": "safety"}, headers=h).json()) == 1
    assert client.get("/api/v1/decisions", params={"entity_id": "bad id!"}, headers=h).status_code == 422
