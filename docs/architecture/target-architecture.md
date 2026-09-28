# Target Architecture

```
                         Operational Data
      (Phase 1: public/data JSON · later: PostgreSQL, telemetry, AIS, ERP, streams)
                                 |
                      Data / Repository Layer
                 MaritimeRepository (interface) → implementations
                                 |
                         Backend Services
                 MaritimeService · DecisionService · AuditService
                                 |
                           Manager Agent
                                 |
          +------------+---------+----------+------------+
          |            |                    |            |
       Anomaly    Maintenance            Voyage       Safety
        Agent        Agent                Agent        Agent
          |            |                    |            |
          +------------+---------+----------+------------+
                                 |
                          Decision Service
                  (PROPOSED → UNDER_REVIEW → APPROVED/REJECTED)
                                 |
                        Human Approval Gate
                                 |
                       Execution / Simulation
                                 |
                            Audit Trail
                                 |
                       React Control Tower
             (STATIC mode: bundled JSON · API mode: this backend)
```

Agents sit beside a pluggable **AIProvider** (Deterministic · Ollama · future OpenAI,
Anthropic, Azure OpenAI, Gemini). Providers produce narrative text only.

## Principles

1. **Agents decide; services and tools execute.** Agents receive a read-only context and
   return a typed recommendation. They cannot touch the database, repositories or any
   execution tool.
2. **Humans retain authority.** Nothing is executed without a named human approval;
   safety-critical recommendations additionally require an explicit review step.
3. **Everything is audited.** Each decision state change writes an audit event in the
   same database transaction.
4. **Deterministic first.** Severity, actions, evidence and approval requirements come
   from documented rules. LLM output can improve wording, never change the decision.
5. **Replaceable edges.** Data sources (repository) and AI models (provider) can change
   without rewriting agents, services or the UI.

## Status by component

| Component | Status | Notes |
| --- | --- | --- |
| React control tower (8 modules) | Implemented | Unchanged UI; data mode `static` or `api` |
| STATIC mode (GitHub Pages) | Implemented | Default; identical behaviour to baseline |
| API mode data loading | Implemented | All 12 datasets served by the backend |
| Repository layer | Implemented (JSON files) | PostgreSQL/telemetry/AIS/ERP adapters are future work |
| Backend services + REST API | Implemented | FastAPI, OpenAPI at `/docs` |
| Decision persistence | Implemented | SQLite by default; `DATABASE_URL` for PostgreSQL |
| Human approval gate | Implemented | Enforced server-side state machine |
| Audit trail | Implemented | Append-only table, `/audit-events` |
| Manager + 4 specialist agents | Implemented (rule-based) | Deterministic domain rules |
| Deterministic AI provider | Implemented | Template narratives; no network |
| Ollama AI provider | Implemented (optional) | Local LLM narrative with automatic fallback |
| Execution | **Simulated** | Records a simulated result; modifies nothing |
| Frontend decision/approval UI | Future | `src/services/decisionService.ts` client exists, not yet wired into modules |
| localStorage workflows | Unchanged | Still used by existing module actions |
| Authentication / RBAC | Future | Actor identity is currently self-declared |
| Cloud LLM providers | Future | Add an `AIProvider` subclass + factory entry |
| Live data (telemetry, AIS, ERP, events) | Future | Add `MaritimeRepository` implementations |
| Migrations (Alembic) | Future | Phase 1 uses `create_all` |

## What is — and is not — "AI" today

- **AI-enabled**: recommendation *narratives* can be produced by a local LLM (Ollama)
  when configured. Everything else is deterministic rules.
- **Not AI**: severity classification, recommended actions, approval requirements and
  evidence selection are explicit rules, deliberately so for safety and testability.
- **Confidence**: reported only where a measurable basis exists (the anomaly
  detector's score from the dataset, passed through unchanged). Otherwise `null` with
  an explanatory `confidence_basis`. No invented percentages.
