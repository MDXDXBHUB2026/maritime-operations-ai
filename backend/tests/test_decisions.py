import pytest

APPROVER = {"approver": "Chief Engineer A. Rahman", "comment": "Reviewed trend data"}


def _create(client, domain="anomaly", entity="ANM-0001"):
    r = client.post(f"/api/v1/decisions/{domain}/{entity}", json={"requested_by": "Duty Officer"})
    assert r.status_code == 201, r.text
    return r.json()


def _audit(client, decision_id):
    return client.get("/api/v1/audit-events", params={"decision_id": decision_id}).json()


@pytest.mark.parametrize("domain,entity", [("anomaly", "ANM-0003"), ("maintenance", "MA-002"),
                                           ("voyage", "VP-2602"), ("safety", "SE-0003")])
def test_recommendation_creation_is_proposed(client, domain, entity):
    d = _create(client, domain, entity)
    assert d["status"] == "PROPOSED"
    assert d["agent"] == domain and d["entity_id"] == entity
    assert d["requires_human_approval"] is True
    assert d["execution_mode"] is None
    assert client.get(f"/api/v1/decisions/{d['recommendation_id']}").json() == d


def test_generate_for_unknown_entity_returns_404(client):
    r = client.post("/api/v1/decisions/anomaly/ANM-9999")
    assert r.status_code == 404


def test_approval_state_transition(client):
    d = _create(client)
    did = d["recommendation_id"]
    r = client.post(f"/api/v1/decisions/{did}/review", json={"reviewer": "Fleet Superintendent"})
    assert r.json()["status"] == "UNDER_REVIEW"
    r = client.post(f"/api/v1/decisions/{did}/approve", json=APPROVER)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "APPROVED"
    assert body["decided_by"] == APPROVER["approver"] and body["decided_at"]


def test_rejection_state_transition(client):
    did = _create(client, "maintenance", "MA-004")["recommendation_id"]
    r = client.post(f"/api/v1/decisions/{did}/reject", json={"approver": "Technical Manager", "reason": "Spare on order"})
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"
    # Terminal: cannot be approved afterwards.
    again = client.post(f"/api/v1/decisions/{did}/approve", json=APPROVER)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invalid_state_transition"


def test_reject_requires_reason(client):
    did = _create(client)["recommendation_id"]
    assert client.post(f"/api/v1/decisions/{did}/reject", json={"approver": "X Person"}).status_code == 422


def test_forbidden_automatic_execution(client):
    d = _create(client, "safety", "SE-0004")
    did = d["recommendation_id"]
    assert d["safety_critical"] is True
    r = client.post(f"/api/v1/decisions/{did}/execute", json={"actor": "Master"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "human_approval_required"
    assert client.get(f"/api/v1/decisions/{did}").json()["status"] == "PROPOSED"
    # Automated identities cannot approve on a human's behalf.
    for bot in ("system", "safety", "manager", "AI"):
        assert client.post(f"/api/v1/decisions/{did}/approve", json={"approver": bot}).status_code == 403
    assert client.get(f"/api/v1/decisions/{did}").json()["status"] == "PROPOSED"


def test_execution_only_after_human_approval_and_is_simulated(client):
    did = _create(client, "voyage", "VP-2604")["recommendation_id"]
    client.post(f"/api/v1/decisions/{did}/approve", json=APPROVER)
    r = client.post(f"/api/v1/decisions/{did}/execute", json={"actor": "Operations Controller"})
    assert r.status_code == 200
    assert r.json()["status"] == "EXECUTED" and r.json()["execution_mode"] == "simulated"
    assert client.post(f"/api/v1/decisions/{did}/cancel",
                       json={"actor": "Ops Lead", "reason": "late"}).status_code == 409


def test_audit_events_for_every_transition(client):
    did = _create(client)["recommendation_id"]
    client.post(f"/api/v1/decisions/{did}/review", json={"reviewer": "Fleet Superintendent"})
    client.post(f"/api/v1/decisions/{did}/approve", json=APPROVER)
    client.post(f"/api/v1/decisions/{did}/execute", json={"actor": "Operations Controller"})
    events = sorted(_audit(client, did), key=lambda e: e["timestamp"])
    assert [e["action"] for e in events] == ["RECOMMENDATION_CREATED", "REVIEW_STARTED", "APPROVED", "EXECUTED_SIMULATED"]
    assert [(e["previous_state"], e["new_state"]) for e in events] == [
        (None, "PROPOSED"), ("PROPOSED", "UNDER_REVIEW"), ("UNDER_REVIEW", "APPROVED"), ("APPROVED", "EXECUTED")]
    approved = events[2]
    assert approved["actor"] == APPROVER["approver"]
    assert approved["human_approval"]["approved"] is True
    assert approved["human_approval"]["approver"] == APPROVER["approver"]
    assert all(e["decision_id"] == did and e["event_id"] for e in events)


def test_failed_transition_writes_no_audit_event(client):
    did = _create(client)["recommendation_id"]
    client.post(f"/api/v1/decisions/{did}/execute", json={"actor": "Someone"})
    assert len(_audit(client, did)) == 1


def test_decisions_persist_across_app_instances(settings, client):
    from fastapi.testclient import TestClient

    from app.main import create_app

    did = _create(client)["recommendation_id"]
    fresh = TestClient(create_app(settings))
    assert fresh.get(f"/api/v1/decisions/{did}").json()["status"] == "PROPOSED"
    assert len(fresh.get("/api/v1/audit-events", params={"decision_id": did}).json()) == 1


def test_invalid_decision_id_is_validated(client):
    assert client.get("/api/v1/decisions/not-a-uuid").status_code == 422


def test_list_decisions_filters_by_entity_status_and_agent(client):
    a = _create(client, "anomaly", "ANM-0010")["recommendation_id"]
    _create(client, "safety", "SE-0011")
    client.post(f"/api/v1/decisions/{a}/approve", json=APPROVER)
    by_entity = client.get("/api/v1/decisions", params={"entity_id": "ANM-0010"}).json()
    assert [d["recommendation_id"] for d in by_entity] == [a]
    assert len(client.get("/api/v1/decisions", params={"status": "APPROVED"}).json()) == 1
    assert len(client.get("/api/v1/decisions", params={"agent": "safety"}).json()) == 1
    assert client.get("/api/v1/decisions", params={"entity_id": "bad id!"}).status_code == 422
