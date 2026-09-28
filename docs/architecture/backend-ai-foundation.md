# Backend and AI Decision-Support Foundation (Phase 1)

Code: `backend/` · Tests: `backend/tests` · Frontend integration: `src/services/`.

## 1. Request flow

```
POST /api/v1/decisions/safety/SE-0004
  → DecisionService.generate
      → MaritimeService.build_context(SAFETY, "SE-0004")      # repository read, related records
      → ManagerAgent.recommend(context)                      # routes to SafetyAgent
          → SafetyAgent.assess(context)                      # deterministic rules
          → AIProvider.complete(facts)                       # narrative text only
          → AgentRecommendation (typed, status-free)
      → persist DecisionRecord(status=PROPOSED)
      → AuditService.record("decision.proposed", actor="agent:safety")
      → single commit
```

## 2. Agent contract

Input `AgentContext` (immutable): `agent`, `entity_type`, `entity_id`, `record`,
`related` (e.g. sensor readings, work orders, maintenance history).

Output `AgentRecommendation`:

| Field | Meaning |
| --- | --- |
| `severity` | Critical / High / Medium / Low from documented rules |
| `summary` | Narrative from the AI provider (deterministic template by default) |
| `rationale[]` | Human-readable findings behind the severity |
| `evidence[]` | `{source, record_id, field, value, note}` references to the data used |
| `recommended_actions[]` | `{action, category, safety_critical}`; categories: monitor, inspect, work_order, operational_change, procurement, escalation, assignment |
| `requires_human_approval` | True if safety-critical or any action is not monitor-only |
| `safety_critical` | Drives the mandatory review step |
| `confidence` / `confidence_basis` | Only from measurable sources, else `null` + reason |
| `provider`, `provider_fallback_used` | Which provider wrote the summary |

Specialist rules (all thresholds are constants in the agent modules):

- **Anomaly**: severity from the detector record; checks the value against its band and
  counts sensor-history breaches. High/Critical → safety-critical inspection.
  Confidence = dataset `confidence_score / 100` (source detector), labelled as such.
- **Maintenance**: failure probability ≥ 60 % or RUL < 500 h → Critical; ≥ 40 % or
  < 1000 h → High; ≥ 20 % → Medium. Adds work order / procurement / owner actions from
  open work orders and spare availability. Confidence `null`.
- **Voyage**: High weather risk → High (safety-critical); ETA slip ≥ 6 h or fuel
  overrun ≥ 5 % → Medium. Speed changes are proposed "for the Master's consideration".
  Confidence `null`.
- **Safety**: always safety-critical and approval-required; escalation when overdue or
  High/Critical; owner assignment when unassigned. Confidence `null`.

The **ManagerAgent** routes by `AgentKind` and re-asserts that safety-critical output
requires human approval.

## 3. AI provider abstraction

```python
class AIProvider(ABC):
    name: str
    def is_available(self) -> bool: ...
    def complete(self, request: AIRequest) -> AIResponse: ...
```

- `DeterministicProvider` — always available, reproducible templates, used in tests.
- `OllamaProvider` — local HTTP call (`/api/generate`, temperature 0, constrained system
  prompt). Any network/HTTP/parse/empty failure raises `ProviderUnavailableError`.
- `FallbackProvider(primary, fallback)` — used when `AI_PROVIDER=ollama`; falls back to
  deterministic and flags `provider_fallback_used`.
- New providers (OpenAI, Anthropic, Azure OpenAI, Gemini): implement `AIProvider`, add a
  branch in `app/ai/factory.py`, read credentials from backend environment only.
  Agents and services do not change.

**Guardrail:** providers receive already-decided facts and return text. Tests assert that
an LLM response cannot change severity, actions, evidence or approval flags.

## 4. Human-in-the-loop state machine

```
PROPOSED ──review──▶ UNDER_REVIEW ──approve──▶ APPROVED ──execute──▶ EXECUTED
   │  ╲                  │    ╲                    │
   │   approve*          │     reject              cancel
   │                     cancel                    ▼
   ├─reject──▶ REJECTED                         CANCELLED
   └─cancel──▶ CANCELLED
* PROPOSED → APPROVED only when the recommendation is NOT safety-critical.
```

Enforced in `DecisionService` (server-side, independent of the UI):

- `PROPOSED → EXECUTED` and `UNDER_REVIEW → EXECUTED` are never allowed (HTTP 409).
- Safety-critical decisions must be `UNDER_REVIEW` before approval.
- Review/approve/reject/execute/cancel require a human `actor`; identities starting with
  `agent:`, `system`, `ai:`, `automation` are refused (HTTP 403).
- Rejection and cancellation require a reason.
- Terminal states (`REJECTED`, `EXECUTED`, `CANCELLED`) accept no transitions.
- Execution is **simulated**: it stores `execution_result.mode = "simulated"` and changes
  no operational data (verified by test).

## 5. Persistence and audit

Tables (SQLAlchemy, `create_all` in Phase 1):

- `decisions` — id (UUID), agent, entity, severity, summary, status, approval flags,
  full recommendation JSON, reviewer/decider/timestamps, execution result.
- `audit_events` — id, timestamp (UTC), actor, action, entity type/id, previous/new
  state, decision id (FK), `human_approval` JSON (who/when/comment/reason), details.

Each state change and its audit event are committed in one transaction. The audit
service only inserts. The backend database is authoritative for decisions made through
the API; existing `localStorage` workflows in the UI are unchanged in this phase.

`DATABASE_URL` switches to PostgreSQL (e.g. `postgresql+psycopg://…`, driver installed
separately). Introduce Alembic migrations before any shared deployment.

## 6. Frontend integration

- `src/services/config.ts` — resolves `VITE_DATA_MODE` (`static` default, `api`) and
  `VITE_API_BASE_URL`.
- `src/services/dataService.ts` — same public methods as before; loads bundled JSON in
  static mode or backend endpoints in API mode. Components are unchanged.
- `src/services/apiClient.ts` — fetch wrapper with structured `ApiError`.
- `src/services/decisionService.ts` — typed client for decisions and audit events
  (API mode only; not yet wired into module UIs).

## 7. Security and safety controls

| Control | Implementation |
| --- | --- |
| No secrets in source | No keys needed; `.env` files and `.venv` git-ignored; variables documented in the READMEs with placeholders only |
| No frontend API keys | Browser only knows the backend URL; providers are server-side |
| CORS | Explicit origin list (`CORS_ORIGINS`); `*` rejected at startup; GET/POST only; no credentials |
| Input validation | Path IDs `^[A-Za-z0-9_-]{1,64}$`, decision IDs UUID-shaped, enum query params, actor pattern, `extra="forbid"` bodies, length limits |
| Structured errors | `{"error": {"code", "message", "details?"}}`; unhandled errors return a generic 500 without stack traces |
| No code execution | No eval/exec/shell; LLM output is treated as plain text |
| Auditability | Transactional, append-only audit events for every transition |
| Human authority | Server-enforced approval gate; simulated execution only |
| Deterministic fallback | Default provider; automatic fallback when Ollama fails |

## 8. Known limitations (Phase 1)

- Actor identity is self-declared — there is no authentication yet; add OIDC/RBAC before
  any real use.
- Operational data is the synthetic demo dataset, read-only.
- Decision UI is not yet integrated into the React modules.
- SQLite is single-node; `create_all` instead of migrations.
