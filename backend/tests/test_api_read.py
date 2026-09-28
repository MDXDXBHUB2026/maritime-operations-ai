def test_health_endpoint(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"].startswith("ok")
    assert body["ai_provider"] == "deterministic"
    assert body["ai_provider_available"] is True


def test_openapi_and_docs_available(client):
    assert client.get("/docs").status_code == 200
    spec = client.get("/api/v1/openapi.json").json()
    for path in ("/api/v1/vessels", "/api/v1/decisions/anomaly/{entity_id}", "/api/v1/decisions/{decision_id}/approve",
                 "/api/v1/audit-events"):
        assert path in spec["paths"]


def test_list_vessels_matches_source_dataset(auth_client, repository):
    r = auth_client.get("/api/v1/vessels")
    assert r.status_code == 200
    vessels = r.json()
    assert len(vessels) == len(repository.list_vessels()) == 10
    # Extra source fields are preserved so the frontend receives the same shape.
    assert "planned_eta" in vessels[0] and "imo_identifier" in vessels[0]


def test_get_vessel_by_id_and_not_found(auth_client):
    assert auth_client.get("/api/v1/vessels/VES-001").json()["vessel_name"] == "MV Horizon Star"
    r = auth_client.get("/api/v1/vessels/VES-999")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_anomaly_retrieval(auth_client):
    anomalies = auth_client.get("/api/v1/anomalies").json()
    assert len(anomalies) == 32
    one = auth_client.get("/api/v1/anomalies/ANM-0001").json()
    assert one["anomaly_id"] == "ANM-0001"
    assert auth_client.get("/api/v1/anomalies/NOPE").status_code == 404


def test_other_collections(auth_client):
    assert len(auth_client.get("/api/v1/maintenance").json()) == 48
    assert len(auth_client.get("/api/v1/voyages").json()) == 8
    assert len(auth_client.get("/api/v1/safety").json()) == 48
    assert len(auth_client.get("/api/v1/datasets/alerts").json()) > 0


def test_input_validation_rejects_bad_ids_and_unknown_datasets(auth_client):
    assert auth_client.get("/api/v1/vessels/bad id!").status_code == 422
    assert auth_client.get("/api/v1/datasets/world_land").status_code == 404  # not on the allow-list
    assert auth_client.get("/api/v1/datasets/..%2F..%2Fetc").status_code in (404, 422)


def test_cors_only_allows_configured_origins(client):
    ok = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in bad.headers


def test_read_endpoints_require_authentication(client):
    for path in ("/api/v1/vessels", "/api/v1/anomalies", "/api/v1/datasets/alerts", "/api/v1/decisions",
                 "/api/v1/audit-events"):
        r = client.get(path)
        assert r.status_code == 401, path
        assert r.json()["error"]["code"] == "unauthorized"
        assert r.headers.get("www-authenticate") == "Bearer"
    assert client.get("/api/v1/vessels", headers={"Authorization": "Bearer not-a-real-token"}).status_code == 401
