# Target Architecture

Principle: **AI provides decision support. Humans retain authority for operational and safety-critical decisions.**
Rule: **Agents decide (propose). Services and tools execute - only after human approval.**

```
                         Operational Data
      (Phase 1: public/data JSON  ->  later: PostgreSQL, telemetry,
             AIS, ERP / fleet-management systems, event streams)
                                 |
                     Data / Repository Layer
                 (MaritimeRepository interface)
                                 |
                         Backend Services
             (MaritimeService: read models + agent context)
                                 |
                          Manager Agent
                     (routes by decision domain)
                                 |
        +---------------+--------+--------+---------------+
        |               |                 |               |
     Anomaly       Maintenance          Voyage          Safety
      Agent           Agent             Agent           Agent
        |               |                 |               |
        +---------------+--------+--------+---------------+
                                 |
                  Structured recommendation (PROPOSED)
                                 |
                          Decision Service
                 (state machine, only writer of state)
                                 |
                       Human Approval Gate
            (named human approver; automated identities refused)
                                 |
                       Execution / Simulation
                 (Phase 1: simulated, no system changed)
                                 |
                            Audit Trail
            (append-only event per transition, same transaction)
                                 |
                       React Control Tower
                (STATIC mode demo | API mode via services)
```

## AI provider layer

Agents call a provider-neutral `AIProvider` only to phrase narrative text from facts they have already
determined. Severity, evidence, recommended actions and approval requirements are deterministic and
never depend on the model.

| Provider | Status |
|---|---|
| `DeterministicProvider` | Implemented. Default. No keys, no network, repeatable output. |
| `OllamaProvider` | Implemented, optional, local LLM. Wrapped in `FallbackProvider` so any failure degrades to deterministic output. |
| OpenAI / Anthropic / Azure OpenAI / Gemini | Future. Add a class implementing `AIProvider` and register it in `build_provider()`; no agent or service changes. |

## Decision lifecycle

```
PROPOSED --> UNDER_REVIEW --> APPROVED --> EXECUTED (simulated)
    |              |              |
    +--> REJECTED  +--> REJECTED  +--> CANCELLED
    +--> APPROVED  +--> CANCELLED
    +--> CANCELLED
```

- `PROPOSED -> EXECUTED` is impossible; execution requires `APPROVED` with a recorded human approver.
- `REJECTED`, `EXECUTED` and `CANCELLED` are terminal.
- The approver is the authenticated user; approval authority depends on role and domain, and safety-critical
  decisions require a second person (see `auth-rbac.md`).

## Status classification

| Capability | Classification |
|---|---|
| Static JSON demo on GitHub Pages | Implemented |
| FastAPI read API over existing datasets | Implemented (Phase 1) |
| Persistent decisions + audit trail (SQLite; PostgreSQL via `DATABASE_URL`) | Implemented (Phase 1) |
| Manager + four specialist agents (rule-based) | Implemented (Phase 1) |
| Human approval gate and state machine | Implemented (Phase 1) |
| Execution of approved decisions | **Simulated** - no operational system is changed |
| LLM narrative via Ollama | AI-enabled, optional, local |
| Frontend decision UI (panels + AI Decision Centre) | Implemented (API mode) |
| Simulation clock, live telemetry, event stream | Implemented, **simulated** (see `realtime-simulation.md`) |
| Frontend `localStorage` workflows | Still active alongside backend decisions |
| Authentication / role-based approval authority | Implemented (Phase 2, local accounts; SSO/MFA future) |
| Live telemetry, AIS, ERP/fleet systems, event streams | Future integration |
| Commercial LLM providers | Future integration |
| ML models for anomaly/failure prediction | Future (current values come from synthetic data) |
