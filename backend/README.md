# Maritime Operations AI — Backend (Phase 1)

FastAPI service that gives the React control tower a real backend: an operational data
API, specialist decision-support agents, a human approval gate and a persistent audit
trail. It runs locally with **no API keys** and **no external services**.

> AI provides decision support. Humans retain authority for operational and
> safety-critical decisions. In this phase, execution is simulated.

## Quickstart (Windows)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # PowerShell
# .venv\Scripts\activate.bat          # cmd.exe
# source .venv/Scripts/activate       # Git Bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

macOS/Linux: `source .venv/bin/activate` instead.

- Health: <http://localhost:8000/api/v1/health>
- Interactive API docs (OpenAPI/Swagger): <http://localhost:8000/docs>
- OpenAPI schema: <http://localhost:8000/api/v1/openapi.json>

Configuration is optional. Override defaults with environment variables or a
git-ignored `backend/.env` file:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./maritime_ai.db` | SQLAlchemy URL; e.g. `postgresql+psycopg://user:<password>@host:5432/maritime_ai` (install the driver separately) |
| `DATA_DIR` | `<repo>/public/data` | Phase 1 operational dataset directory |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated browser origins; `*` is rejected |
| `AI_PROVIDER` | `deterministic` | `deterministic` or `ollama` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` / `OLLAMA_TIMEOUT_SECONDS` | `http://localhost:11434` / `llama3.1` / `20` | Optional local LLM |
| `ENVIRONMENT` | `development` | `development`, `test` or `production` |

## Tests and lint

```powershell
pip install -r requirements-dev.txt
pytest
ruff check app tests
ruff format --check app tests
```

## Endpoints (`/api/v1`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database, data source and AI provider status |
| GET | `/vessels`, `/vessels/{id}` | Vessels (`?operational_status=`) |
| GET | `/anomalies`, `/anomalies/{id}` | Anomalies (`?severity=&status=&vessel=`) |
| GET | `/anomalies/{id}/sensor-readings`, `/sensor-readings` | Sensor trends |
| GET | `/maintenance`, `/maintenance/{id}` | Maintenance assets (`?criticality=&vessel=`) |
| GET | `/maintenance/history`, `/maintenance/work-orders`, `/maintenance/equipment` | Maintenance context |
| GET | `/voyages`, `/voyages/plans`, `/voyages/plans/{id}` | Voyage summaries and plans |
| GET | `/safety`, `/safety/{id}` | Safety events (`?severity=&status=`) |
| GET | `/alerts`, `/automation-tasks` | Operational feeds used by the dashboard |
| POST | `/decisions/{anomaly\|maintenance\|voyage\|safety}/{entity_id}` | Generate a recommendation (status `PROPOSED`) |
| GET | `/decisions/{id}` | Read a decision |
| POST | `/decisions/{id}/review` | `PROPOSED → UNDER_REVIEW` |
| POST | `/decisions/{id}/approve` | `→ APPROVED` (named human actor) |
| POST | `/decisions/{id}/reject` | `→ REJECTED` (reason required) |
| POST | `/decisions/{id}/execute` | `APPROVED → EXECUTED` (simulated only) |
| POST | `/decisions/{id}/cancel` | `→ CANCELLED` |
| GET | `/audit-events` | Audit trail (`?decision_id=&entity_type=&entity_id=&limit=&offset=`) |

Example:

```bash
curl -X POST http://localhost:8000/api/v1/decisions/safety/SE-0004 \
  -H "Content-Type: application/json" -d '{"requested_by":"ops-analyst"}'
curl -X POST http://localhost:8000/api/v1/decisions/<id>/review \
  -H "Content-Type: application/json" -d '{"actor":"Master A. Smith"}'
curl -X POST http://localhost:8000/api/v1/decisions/<id>/approve \
  -H "Content-Type: application/json" -d '{"actor":"Master A. Smith","comment":"Agreed"}'
curl "http://localhost:8000/api/v1/audit-events?decision_id=<id>"
```

## Layout

```
app/
  main.py            FastAPI factory, CORS, error handlers, dependency container
  config.py          Settings from environment (.env)
  errors.py          Domain exceptions → structured JSON errors
  api/               Routers (thin; no business logic)
  domain/            Pydantic models and enums (agent/decision/audit contracts)
  repositories/      MaritimeRepository interface + JSON-file implementation
  services/          MaritimeService, DecisionService (state machine), AuditService
  agents/            ManagerAgent + anomaly / maintenance / voyage / safety specialists
  ai/                AIProvider interface, DeterministicProvider, OllamaProvider, factory
  db/                SQLAlchemy base, session, tables (decisions, audit_events)
tests/               pytest suite
```

## Using a local LLM (optional)

Install [Ollama](https://ollama.com), pull a model (`ollama pull llama3.1`), then set
`AI_PROVIDER=ollama`. The LLM only writes the recommendation's summary text; severity,
actions, evidence and approval flags always come from deterministic rules. If Ollama is
unreachable the deterministic provider is used automatically and `/health` reports it.

See [`../docs/architecture/backend-ai-foundation.md`](../docs/architecture/backend-ai-foundation.md)
for the design and safety rules.
