from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import HUMAN

API = "/api/v1"


def _create(client: TestClient, kind: str, entity_id: str) -> dict[str, Any]:
    response = client.post(
        f"{API}/decisions/{kind}/{entity_id}", json={"requested_by": "ops-analyst"}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _audit(client: TestClient, decision_id: str) -> list[dict[str, Any]]:
    events = client.get(f"{API}/audit-events", params={"decision_id": decision_id}).json()
    return sorted(events, key=lambda e: e["timestamp"])


def test_recommendation_creation_is_proposed_and_persisted(client: TestClient) -> None:
    decision = _create(client, "anomaly", "ANM-0004")
    assert decision["status"] == "PROPOSED"
    assert decision["recommendation"]["agent"] == "anomaly"
    assert decision["execution_result"] is None

    fetched = client.get(f"{API}/decisions/{decision['recommendation_id']}").json()
    assert fetched["recommendation_id"] == decision["recommendation_id"]
    assert fetched["recommendation"] == decision["recommendation"]

    events = _audit(client, decision["recommendation_id"])
    assert [e["action"] for e in events] == ["decision.proposed"]
    assert events[0]["actor"] == "agent:anomaly"
    assert events[0]["previous_state"] is None and events[0]["new_state"] == "PROPOSED"
    assert events[0]["details"]["requested_by"] == "ops-analyst"


def test_generate_without_body_uses_default_requester(client: TestClient) -> None:
    assert client.post(f"{API}/decisions/voyage/VP-2601").status_code == 201


def test_generate_for_unknown_entity_returns_404(client: TestClient) -> None:
    response = client.post(f"{API}/decisions/maintenance/MA-999")
    assert response.status_code == 404
    assert client.get(f"{API}/audit-events").json() == []


def test_approval_transition_for_non_safety_critical(client: TestClient) -> None:
    decision = _create(client, "maintenance", "MA-001")
    assert decision["safety_critical"] is False
    response = client.post(
        f"{API}/decisions/{decision['recommendation_id']}/approve",
        json={**HUMAN, "comment": "Proceed at next port call"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "APPROVED"
    assert body["decided_by"] == HUMAN["actor"]

    events = _audit(client, decision["recommendation_id"])
    assert [e["action"] for e in events] == ["decision.proposed", "decision.approved"]
    approved = events[-1]
    assert (approved["previous_state"], approved["new_state"]) == ("PROPOSED", "APPROVED")
    assert approved["actor"] == HUMAN["actor"]
    assert approved["human_approval"]["approved"] is True
    assert approved["human_approval"]["approved_by"] == HUMAN["actor"]


def test_safety_critical_requires_review_before_approval(client: TestClient) -> None:
    decision = _create(client, "safety", "SE-0004")
    decision_id = decision["recommendation_id"]
    assert decision["safety_critical"] is True

    direct = client.post(f"{API}/decisions/{decision_id}/approve", json=HUMAN)
    assert direct.status_code == 409
    assert direct.json()["error"]["code"] == "invalid_state_transition"

    review = client.post(
        f"{API}/decisions/{decision_id}/review", json={**HUMAN, "comment": "Checking CCTV"}
    )
    assert review.json()["status"] == "UNDER_REVIEW"
    approve = client.post(f"{API}/decisions/{decision_id}/approve", json=HUMAN)
    assert approve.json()["status"] == "APPROVED"

    actions = [e["action"] for e in _audit(client, decision_id)]
    assert actions == ["decision.proposed", "decision.review_started", "decision.approved"]


def test_rejection_transition(client: TestClient) -> None:
    decision_id = _create(client, "voyage", "VP-2602")["recommendation_id"]
    response = client.post(
        f"{API}/decisions/{decision_id}/reject",
        json={**HUMAN, "reason": "Berth window already confirmed by agent"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"

    rejected = _audit(client, decision_id)[-1]
    assert rejected["action"] == "decision.rejected"
    assert (rejected["previous_state"], rejected["new_state"]) == ("PROPOSED", "REJECTED")
    assert rejected["human_approval"]["approved"] is False
    assert rejected["human_approval"]["reason"].startswith("Berth window")

    # Terminal state: no further transitions.
    assert client.post(f"{API}/decisions/{decision_id}/approve", json=HUMAN).status_code == 409


def test_reject_requires_reason(client: TestClient) -> None:
    decision_id = _create(client, "voyage", "VP-2602")["recommendation_id"]
    assert client.post(f"{API}/decisions/{decision_id}/reject", json=HUMAN).status_code == 422


def test_proposed_cannot_be_executed(client: TestClient) -> None:
    for kind, entity_id in [
        ("safety", "SE-0003"),
        ("anomaly", "ANM-0001"),
        ("maintenance", "MA-001"),
    ]:
        decision_id = _create(client, kind, entity_id)["recommendation_id"]
        response = client.post(f"{API}/decisions/{decision_id}/execute", json=HUMAN)
        assert response.status_code == 409, kind
        assert client.get(f"{API}/decisions/{decision_id}").json()["status"] == "PROPOSED"
        assert [e["action"] for e in _audit(client, decision_id)] == ["decision.proposed"]


def test_under_review_cannot_be_executed(client: TestClient) -> None:
    decision_id = _create(client, "safety", "SE-0003")["recommendation_id"]
    client.post(f"{API}/decisions/{decision_id}/review", json=HUMAN)
    assert client.post(f"{API}/decisions/{decision_id}/execute", json=HUMAN).status_code == 409


def test_non_human_actor_cannot_approve(client: TestClient) -> None:
    decision_id = _create(client, "maintenance", "MA-001")["recommendation_id"]
    for actor in ("agent:maintenance", "system", "automation-bot"):
        response = client.post(f"{API}/decisions/{decision_id}/approve", json={"actor": actor})
        assert response.status_code == 403, actor
    assert client.get(f"{API}/decisions/{decision_id}").json()["status"] == "PROPOSED"


def test_invalid_actor_format_rejected(client: TestClient) -> None:
    decision_id = _create(client, "maintenance", "MA-001")["recommendation_id"]
    response = client.post(f"{API}/decisions/{decision_id}/approve", json={"actor": "<script>"})
    assert response.status_code == 422


def test_unexpected_fields_rejected(client: TestClient) -> None:
    decision_id = _create(client, "maintenance", "MA-001")["recommendation_id"]
    response = client.post(
        f"{API}/decisions/{decision_id}/approve", json={**HUMAN, "status": "EXECUTED"}
    )
    assert response.status_code == 422


def test_approved_decision_executes_in_simulation_only(client: TestClient) -> None:
    decision_id = _create(client, "maintenance", "MA-001")["recommendation_id"]
    client.post(f"{API}/decisions/{decision_id}/approve", json=HUMAN)
    before = client.get(f"{API}/maintenance/MA-001").json()

    executed = client.post(f"{API}/decisions/{decision_id}/execute", json=HUMAN).json()
    assert executed["status"] == "EXECUTED"
    assert executed["execution_result"]["mode"] == "simulated"
    # Operational data is untouched by simulated execution.
    assert client.get(f"{API}/maintenance/MA-001").json() == before

    actions = [e["action"] for e in _audit(client, decision_id)]
    assert actions == ["decision.proposed", "decision.approved", "decision.executed"]


def test_cancel_transition_is_audited(client: TestClient) -> None:
    decision_id = _create(client, "voyage", "VP-2601")["recommendation_id"]
    response = client.post(
        f"{API}/decisions/{decision_id}/cancel", json={**HUMAN, "reason": "Voyage re-planned"}
    )
    assert response.json()["status"] == "CANCELLED"
    assert _audit(client, decision_id)[-1]["new_state"] == "CANCELLED"


def test_unknown_decision_returns_404(client: TestClient) -> None:
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"{API}/decisions/{missing}").status_code == 404
    assert client.post(f"{API}/decisions/{missing}/approve", json=HUMAN).status_code == 404


def test_audit_events_filterable_by_entity(client: TestClient) -> None:
    _create(client, "anomaly", "ANM-0004")
    _create(client, "safety", "SE-0001")
    events = client.get(f"{API}/audit-events", params={"entity_type": "safety_event"}).json()
    assert len(events) == 1 and events[0]["entity_id"] == "SE-0001"
    assert client.get(f"{API}/audit-events", params={"limit": 0}).status_code == 422
