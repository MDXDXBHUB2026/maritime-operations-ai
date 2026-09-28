import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings

API = "/api/v1"


def test_health_reports_ok(client: TestClient) -> None:
    body = client.get(f"{API}/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["data_source"] == "json_files:ok"
    assert body["ai_provider"] == {
        "configured": "deterministic",
        "active": "deterministic",
        "available": True,
        "detail": None,
    }


def test_openapi_and_docs_available(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    spec = client.get(f"{API}/openapi.json").json()
    for path in (
        "/api/v1/health",
        "/api/v1/vessels",
        "/api/v1/vessels/{vessel_id}",
        "/api/v1/anomalies/{anomaly_id}",
        "/api/v1/decisions/anomaly/{entity_id}",
        "/api/v1/decisions/{decision_id}/approve",
        "/api/v1/decisions/{decision_id}/reject",
        "/api/v1/audit-events",
    ):
        assert path in spec["paths"], path


def test_list_and_get_vessels_preserves_frontend_shape(client: TestClient) -> None:
    vessels = client.get(f"{API}/vessels").json()
    assert len(vessels) == 10
    # Extra dataset fields used by the React UI must survive the response model.
    assert {"fuel_consumption_tonnes_day", "predicted_eta", "technical_health_score"} <= set(
        vessels[0]
    )
    vessel = client.get(f"{API}/vessels/VES-001").json()
    assert vessel["vessel_name"] == "MV Horizon Star"


def test_unknown_vessel_returns_structured_404(client: TestClient) -> None:
    response = client.get(f"{API}/vessels/VES-999")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Vessel 'VES-999' not found"}
    }


def test_invalid_identifier_is_rejected(client: TestClient) -> None:
    response = client.get(f"{API}/vessels/bad%20id;drop")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_anomaly_retrieval_and_filters(client: TestClient) -> None:
    anomalies = client.get(f"{API}/anomalies").json()
    assert len(anomalies) == 32
    critical = client.get(f"{API}/anomalies", params={"severity": "Critical"}).json()
    assert critical and all(a["severity"] == "Critical" for a in critical)
    assert client.get(f"{API}/anomalies", params={"severity": "Extreme"}).status_code == 422

    anomaly = client.get(f"{API}/anomalies/ANM-0001").json()
    assert anomaly["anomaly_id"] == "ANM-0001"
    readings = client.get(f"{API}/anomalies/ANM-0001/sensor-readings").json()
    assert readings and all(r["anomaly_id"] == "ANM-0001" for r in readings)


def test_other_operational_endpoints(client: TestClient) -> None:
    assert len(client.get(f"{API}/maintenance").json()) == 48
    assert client.get(f"{API}/maintenance/MA-001").json()["asset_id"] == "MA-001"
    assert len(client.get(f"{API}/maintenance/history").json()) == 80
    assert len(client.get(f"{API}/maintenance/work-orders").json()) == 12
    assert len(client.get(f"{API}/maintenance/equipment").json()) == 40
    assert len(client.get(f"{API}/voyages").json()) == 6
    assert len(client.get(f"{API}/voyages/plans").json()) == 8
    assert client.get(f"{API}/voyages/plans/VP-2601").json()["vessel_id"] == "VES-001"
    assert len(client.get(f"{API}/safety").json()) == 48
    assert client.get(f"{API}/safety/SE-0001").json()["event_id"] == "SE-0001"
    assert len(client.get(f"{API}/alerts").json()) == 8
    assert len(client.get(f"{API}/automation-tasks").json()) == 30
    assert len(client.get(f"{API}/sensor-readings").json()) == 800


def test_cors_allows_only_configured_origins(client: TestClient) -> None:
    allowed = client.get(f"{API}/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.get(f"{API}/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in blocked.headers


def test_wildcard_cors_configuration_is_refused() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_origins="*")


def test_cors_origins_parse_from_comma_separated_string() -> None:
    settings = Settings(cors_origins="http://a.test, http://b.test")
    assert settings.cors_origins == ["http://a.test", "http://b.test"]
