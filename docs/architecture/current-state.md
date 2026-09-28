# Current State (baseline before the backend foundation)

Baseline audited: `origin/main` @ `ba468662628cd0677a1529df22709011be8efa6c`.

## What exists

- **Frontend**: React 18 + TypeScript SPA built with Vite, deployed to GitHub Pages
  (`base: /maritime-operations-ai/`, HashRouter). Eight modules: Executive Dashboard,
  Fleet Overview, Anomaly Detection, Predictive Maintenance, Voyage & Fuel Optimisation,
  Safety Monitoring, Automation Centre, Application Assurance Centre.
- **Data**: synthetic demo datasets in `public/data/*.json` (vessels, anomalies,
  sensor readings, maintenance assets/history, work orders, equipment, voyages, voyage
  plans, safety events, alerts, automation tasks). Loaded by `src/services/dataService.ts`
  via `fetch`. CSV sources are kept in `data/`.
- **State**: operator actions (status changes, work orders, approvals, histories) are
  stored only in browser `localStorage` by `src/services/storageService.ts`
  (prefix `maritime_ai_state_`). Each browser has its own, unshared copy.
- **Calculations**: KPIs, risk scores and fuel/voyage scenarios are computed in the
  browser (`src/utils/*Calculations.ts`).
- **Quality**: Vitest unit tests, Playwright e2e (27 tests across 3 viewports), ESLint,
  Prettier, and a deterministic assurance tool (`tools/assurance`) run in CI before
  deployment.
- **Legacy**: an earlier Streamlit prototype is archived in `legacy/streamlit`.

## What does not exist (at baseline)

| Capability | Status at baseline |
| --- | --- |
| Backend API | None — the app is a static site |
| Central database | None — only per-browser `localStorage` |
| LLM / AI provider | None — "AI recommendations" are fields in the synthetic JSON |
| Agent runtime | None |
| Server-side audit trail | None — histories are per-browser and can be reset |
| Authentication / authorisation | None |

## Implications

- "AI" outputs shown in the UI (e.g. `confidence_score`, `AI_recommendation`) are
  pre-generated dataset values, not live inference.
- Approvals and audit histories are not authoritative: they can be cleared with
  "Reset Demo" and are invisible to other users.
- There is no seam where real telemetry, AIS, ERP or an AI model could be connected.

The Phase 1 backend foundation (see `backend-ai-foundation.md`) addresses the last three
points without changing the static demo.
