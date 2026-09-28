# Maritime Operations AI - Backend (Phase 1)

FastAPI decision-support backend. Agents propose recommendations; named humans approve or reject;
execution is simulated; every transition is audited. No API keys are required.

Architecture: [`docs/architecture/backend-ai-foundation.md`](../docs/architecture/backend-ai-foundation.md)

## Run locally

Requires Python 3.10+.

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
# (if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)
```

```bat
:: Windows cmd.exe
.venv\Scripts\activate.bat
```

```bash
# macOS / Linux
source .venv/bin/activate
```

Install and start:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/api/v1/health
- OpenAPI docs: http://localhost:8000/docs

Configuration is optional; copy `.env.example` to `.env` to override defaults
(`DATABASE_URL`, `DATA_DIR`, `CORS_ORIGINS`, `AI_PROVIDER`, `OLLAMA_*`, session/lockout settings).

## Accounts and sign-in

All endpoints except `/health` and `/auth/login` require a signed-in user. Create accounts first
(no password is stored in the repository):

```bash
python -m app.cli seed-demo-users     # demo role accounts, prompts for one shared password
python -m app.cli list-sites           # vessels and terminals that can be assigned
python -m app.cli create-user --username j.smith --display-name "J. Smith" --role chief_engineer --sites VES-001
python -m app.cli list-users
```

For a quick local demo you can instead set `DEMO_USERS_PASSWORD` in `backend/.env`
(min. 10 characters, upper/lower case and a digit). Demo accounts: `admin`, `duty.officer`,
`chief.engineer` + `master` (MV Horizon Star), `chief.meridian` + `master.meridian` (MV Meridian),
`tech.super`, `marine.super`, `hse.manager` (fleet-wide), `viewer`.

Authority is **per site**: Masters and Chief Engineers act only for their assigned vessels; shore roles
are fleet-wide or limited to chosen vessels and terminals.

Roles and approval authority: [`docs/architecture/auth-rbac.md`](../docs/architecture/auth-rbac.md).

## Tests

```bash
cd backend
pytest
```

## Optional local LLM (Ollama)

```bash
ollama pull llama3.1
# backend/.env
AI_PROVIDER=ollama
```

If Ollama is not running or returns an invalid response, the backend falls back to the deterministic
provider automatically; the recommendation's `provider` field shows which one produced the text.

## Example decision flow

```bash
# 1. Sign in (returns access_token)
curl -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"username": "duty.officer", "password": "<password>"}'

# 2. Generate a recommendation as the duty officer (status PROPOSED)
curl -X POST http://localhost:8000/api/v1/decisions/anomaly/ANM-0001 -H "Authorization: Bearer <officer-token>"

# 3. Approve as a Chief Engineer (identity comes from the token, never from the body)
curl -X POST http://localhost:8000/api/v1/decisions/<id>/approve -H "Authorization: Bearer <chief-token>" \
  -H "Content-Type: application/json" -d '{"comment": "Agreed"}'

# 4. Audit trail
curl "http://localhost:8000/api/v1/audit-events?decision_id=<id>" -H "Authorization: Bearer <token>"
```
