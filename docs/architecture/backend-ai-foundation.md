# Backend & AI Decision-Support Foundation (Phase 1)

Phase 1 adds a Python backend beside the unchanged React frontend. It is a **prototype foundation**,
not a production system: there is no authentication, all data is synthetic, and execution is simulated.

## Layout

```
backend/
  app/
    main.py            FastAPI factory, CORS, structured error handlers
    config.py          Environment settings (DATABASE_URL, DATA_DIR, CORS_ORIGINS, AI_PROVIDER, OLLAMA_*)
    api/               router.py, deps.py, routes/{health,vessels,anomalies,maintenance,voyages,safety,datasets,decisions,audit}.py
    domain/            enums.py, models.py (Pydantic contracts), errors.py
    repositories/      base.py (MaritimeRepository interface), maritime_repository.py (reads public/data)
    services/          maritime_service.py, decision_service.py, audit_service.py
    agents/            base_agent.py, manager_agent.py, anomaly/maintenance/voyage/safety agents
    ai/                provider.py (AIProvider, FallbackProvider, factory), deterministic_provider.py, ollama_provider.py
    db/                base.py, session.py, models.py (decision_records, audit_events)
  tests/               pytest suite
```

## Data flow for a recommendation

1. `POST /api/v1/decisions/{domain}/{id}` - the route calls `DecisionService.generate`.
2. `MaritimeService.build_context` reads the record (and related sensor readings / maintenance history) through the repository and builds an `AgentContext`.
3. `ManagerAgent.recommend` routes to the specialist. The specialist applies deterministic rules and asks the `AIProvider` only for summary/rationale text.
4. The typed `AgentRecommendation` is persisted as a `DecisionRecord` with status `PROPOSED`, and a `RECOMMENDATION_CREATED` audit event is written in the same transaction.
5. A named human reviews / approves / rejects. Each transition is validated against the state machine and audited.
6. `execute` is only possible from `APPROVED` and is recorded as `EXECUTED_SIMULATED`.

Agents never receive a DB session or repository and cannot modify state.

## Specialist rules (deterministic)

| Agent | Inputs | Severity logic | Safety-critical actions |
|---|---|---|---|
| Anomaly | value, thresholds, deviation, source severity, sensor readings | Source severity; escalated to at least High when the value is outside the threshold band | Inspection work-order request when High/Critical |
| Maintenance | health score, failure probability, RUL, criticality, spares | Max of condition severity (RUL/failure probability/health bands) and asset criticality | Corrective work order when Critical |
| Voyage | planned vs predicted ETA, berth waiting, fuel, speeds, weather | High weather or >=12 h delay -> High; >=4 h delay, >=6 h waiting or >5 % fuel overrun -> Medium | Master's weather-routing review under High weather risk |
| Safety | severity, risk score, overdue flag, owner, exposure | Risk score >=70 -> at least High; overdue escalates one level | All safety actions |

**Confidence**: only populated when traceable to source data (anomaly detection confidence from the source record,
`confidence_basis = source_detection_confidence`). Otherwise `null` with `confidence_basis = not_computed`. No confidence
values are generated.

## Persistence

- `decision_records` - authoritative record for backend decisions (status, recommendation payload, approver, timestamps).
- `audit_events` - event ID, timestamp, actor, action, entity type/ID, previous/new state, decision reference, human-approval details.
- SQLite file `backend/maritime_ai.db` by default (git-ignored). Set `DATABASE_URL` for PostgreSQL (install a driver such as `psycopg`). Tables are created with `create_all`; introduce Alembic before the first shared deployment.
- Operational datasets are **read** from `public/data` (not duplicated). Frontend `localStorage` state is unchanged and is not synchronised with the backend yet.

## API (prefix `/api/v1`, OpenAPI at `/docs` and `/api/v1/openapi.json`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | DB, data source and AI provider status |
| GET | `/vessels`, `/vessels/{id}` | Vessels |
| GET | `/anomalies`, `/anomalies/{id}` | Anomalies |
| GET | `/maintenance` | Maintenance assets |
| GET | `/voyages` | Voyage plans |
| GET | `/safety` | Safety events |
| GET | `/datasets`, `/datasets/{name}` | Allow-listed supporting datasets for API mode (alerts, equipment, sensor readings, ...) |
| POST | `/decisions/{anomaly,maintenance,voyage,safety}/{id}` | Generate recommendation (201, `PROPOSED`) |
| GET | `/decisions`, `/decisions/{id}` | Query decisions (filters: `status`, `agent`, `entity_id`) |
| POST | `/decisions/{id}/review` | `PROPOSED -> UNDER_REVIEW` |
| POST | `/decisions/{id}/approve` | Human approval -> `APPROVED` |
| POST | `/decisions/{id}/reject` | Human rejection (reason required) -> `REJECTED` |
| POST | `/decisions/{id}/execute` | Simulated execution, only from `APPROVED` |
| POST | `/decisions/{id}/cancel` | Cancel open/approved decision |
| GET | `/audit-events` | Audit trail (filter by `decision_id`, `entity_id`) |

Errors are returned as `{"error": {"code", "message", "details?"}}` (404 `not_found`, 409 `invalid_state_transition`,
403 `human_approval_required`, 422 `validation_error`, 500 `internal_error` without internals).

## Security controls in Phase 1

- No secrets in source; `.env` files are git-ignored; `.env.example` files contain placeholders only.
- No API keys required; no keys in the frontend (all `VITE_*` values are public by design).
- CORS restricted to `CORS_ORIGINS` (wildcard ignored), methods `GET`/`POST`, header `Content-Type`, no credentials.
- Path/query/body validation (ID patterns, actor patterns, length limits); datasets served only from an allow-list.
- No dynamic code execution; LLM output is used only as text and truncated.
- Every state change audited in the same DB transaction; failed transitions write nothing.

## Known limitations

- **No authentication**: actor/approver names are self-declared. Role-based approval authority is the next priority.
- Frontend decision UI (AI Decision Support panels, AI Decision Centre) runs in API mode; the older `localStorage` operator workflows still run alongside it and are not synchronised with backend decisions.
- SQLite is single-node; use PostgreSQL for shared environments.
