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
(`DATABASE_URL`, `DATA_DIR`, `CORS_ORIGINS`, `AI_PROVIDER`, `OLLAMA_*`).

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
# 1. Generate (status PROPOSED)
curl -X POST http://localhost:8000/api/v1/decisions/anomaly/ANM-0001 \
  -H "Content-Type: application/json" -d '{"requested_by": "Duty Officer"}'

# 2. Approve / reject with a named human
curl -X POST http://localhost:8000/api/v1/decisions/<id>/approve \
  -H "Content-Type: application/json" -d '{"approver": "Chief Engineer", "comment": "Agreed"}'

# 3. Audit trail
curl "http://localhost:8000/api/v1/audit-events?decision_id=<id>"
```
