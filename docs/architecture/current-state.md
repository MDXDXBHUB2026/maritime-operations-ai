# Current State (baseline before backend foundation)

Baseline commit: `ba468662628cd0677a1529df22709011be8efa6c` (`main`).

## What exists

| Area | Implementation | Status |
|---|---|---|
| Frontend | React 18 + TypeScript SPA (Vite, HashRouter) deployed to GitHub Pages | Working demo |
| Modules | Executive Dashboard, Fleet Overview, Anomaly Detection, Predictive Maintenance, Voyage & Fuel Optimisation, Safety Monitoring, Automation Centre, Application Assurance Centre | Working |
| Operational data | Synthetic datasets in `public/data/*.json`, generated from `data/*.csv` via `scripts/export_to_json.py` | Static, synthetic |
| Data access | `src/services/dataService.ts` fetches JSON files relative to `BASE_URL` | Static only |
| State | `src/services/storageService.ts` stores operator overrides, history and work-order counter in browser `localStorage` (`maritime_ai_state_*`) | Per-browser, not shared, not authoritative |
| Calculations | `src/utils/*Calculations.ts` (KPIs, health bands, voyage scenario maths) | Frontend only |
| CI | `.github/workflows/assurance.yml` (typecheck, lint, unit, assurance, build, Playwright) and `deploy.yml` (same gates, then Pages deploy) | Working |
| Assurance tooling | `tools/assurance/*` deterministic QA agent, static security agent, finding verifier, orchestrator | Deterministic scripts, not LLM agents |
| Legacy | `legacy/streamlit/` original Streamlit prototype with SQLite helpers | Archived, not deployed |

## Confirmed answers (audit)

| Question | Finding |
|---|---|
| Does frontend data come from `public/data` JSON? | **Yes** - every module loads via `DataService` -> `/data/*.json`. The map basemap (`world_land.json`) and assurance report (`assurance/*.json`) are also static assets. |
| Is browser state stored in `localStorage`? | **Yes** - all operator actions (status changes, acknowledgements, work orders, approvals) are `localStorage` overrides. |
| Is there a backend API? | **No.** |
| Is there a database? | **No** for the deployed app. `legacy/streamlit` contains an archived SQLite layer that is not used by the React app. |
| Is there a real LLM / AI provider? | **No.** "AI recommendations" and confidence scores are fields in the synthetic datasets. |
| Is there an agent runtime? | **No.** "Agents" in the Automation Centre and Assurance tooling are simulated workflows or deterministic scripts. |

## Constraints carried forward

- The GitHub Pages demo must keep working with no backend (static hosting only).
- `localStorage` workflows remain in place until modules are migrated one by one.
- All data is synthetic; nothing in the repository represents real vessels or live telemetry.
