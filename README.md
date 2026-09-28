# Maritime Operations AI Control Tower

[![Application Assurance CI Pipeline](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/assurance.yml/badge.svg)](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/assurance.yml)
[![Deploy to GitHub Pages](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/deploy.yml/badge.svg)](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/deploy.yml)

A high-performance, static React Single-Page Application (SPA) deployed to GitHub Pages, providing situational awareness and simulated decision support for commercial maritime operations.

- **Live Production URL**: [https://mdxdxbhub2026.github.io/maritime-operations-ai/](https://mdxdxbhub2026.github.io/maritime-operations-ai/)
- **Repository**: [https://github.com/MDXDXBHUB2026/maritime-operations-ai](https://github.com/MDXDXBHUB2026/maritime-operations-ai)

---

## Operational Modules

1. **Executive Dashboard** (`#/dashboard`) — Fleet readiness rate, active vessels, critical alerts, live SVG map, equipment health breakdown, and 7-day fuel variance.
2. **Fleet Overview** (`#/fleet`) — Global interactive vessel map, 5 multi-dimensional filters, health/delay/exposure breakdowns, vessel drill-down, and operational status simulator.
3. **Anomaly Detection** (`#/anomalies`) — Multi-parameter anomaly register, 24-hour telemetry trend chart with baseline/threshold markers, and 7 controlled operator actions.
4. **Predictive Maintenance** (`#/maintenance`) — Asset health status, RUL countdowns, failure exposure distribution, spare parts tracking, and work order generation.
5. **Voyage & Fuel Optimisation** (`#/voyage`) — Real-time voyage comparison, bunker consumption trends, and interactive 6-parameter scenario simulator with instant mathematical updates.
6. **Safety Monitoring** (`#/safety`) — Incident & hazard register, risk score calculations, CCTV sensor monitoring placeholders, and corrective action workflows.
7. **Automation Centre** (`#/automation`) — Human-in-the-loop task review, strict approval gate for high-risk operations, and simulated execution logs.
8. **AI Decision Centre** (`#/decisions`) — Backend decision register (API mode): agent recommendations, human approve/reject decisions, simulated execution and the audit trail. Anomaly, Maintenance, Voyage and Safety modules each include an **AI Decision Support** panel for the selected item.
9. **Application Assurance Centre** (`#/assurance`) — Continuous CI audit results, deterministic QA agent status, static security gates with mandatory secret redaction (`ghp_abcd********wxyz`), verified positive controls, and prioritized remediation roadmap.

---

## Target Technology Stack

- **Frontend**: React 18, TypeScript (strict mode enabled)
- **Tooling & Bundling**: Vite 6, React Router (HashRouter for zero-config GitHub Pages deep-link compatibility)
- **Data Layer**: Pre-compiled static JSON datasets in `public/data/*.json` with browser-local simulation state (`localStorage`)
- **Unit & Component Testing**: Vitest 3, React Testing Library, JSDOM
- **End-to-End Testing**: Playwright (27 tests across Desktop Chrome 1280x800, Tablet iPad 768x1024, and Mobile Chrome 375x667)
- **Static Quality & Security**: ESLint 9, Prettier, Non-invasive `npm audit`, Deterministic Secret Scanner with regex masking
- **Deployment**: GitHub Actions deploying to GitHub Pages via `./dist` artifact

---

## Quickstart & Local Development

### Prerequisites
- Node.js v20+ or v22+
- npm v10+

### Installation
```bash
# Clone the repository
git clone https://github.com/MDXDXBHUB2026/maritime-operations-ai.git
cd maritime-operations-ai

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```
Navigate to `http://localhost:5173/maritime-operations-ai/`.

### Data Modes: STATIC and API

The frontend supports two data modes, selected at build/dev time (see `.env.example`):

| Mode | Config | Data source |
|---|---|---|
| `static` (default) | `VITE_DATA_MODE=static` or unset | `public/data/*.json` - the GitHub Pages demo, no backend needed |
| `api` | `VITE_DATA_MODE=api`, `VITE_API_BASE_URL=http://localhost:8000/api/v1` | FastAPI backend in `backend/` |

**STATIC mode** (unchanged behaviour):
```bash
npm install
npm run dev
```

**API mode** - start the backend first (see [`backend/README.md`](backend/README.md) for Windows activation):
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Then in a second terminal at the repository root:
```bash
# Windows PowerShell
$env:VITE_DATA_MODE="api"; $env:VITE_API_BASE_URL="http://localhost:8000/api/v1"; npm run dev
# macOS/Linux
VITE_DATA_MODE=api VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```
Or copy `.env.example` to `.env.local` and set `VITE_DATA_MODE=api`.

In API mode the app opens with a **sign-in screen**. Create accounts first with
`python -m app.cli seed-demo-users` (in `backend/`). Approval authority depends on the signed-in user's role:
Chief Engineer / Technical Superintendent for anomaly and maintenance, Master / Marine Superintendent for voyage,
HSE Manager / Master for safety. Safety-critical decisions need a second person (four-eyes). Authority is also **per vessel/terminal**: a Master or Chief Engineer acts only for their assigned vessel(s). See
[`docs/architecture/auth-rbac.md`](docs/architecture/auth-rbac.md). The older browser-local operator actions
still use `localStorage`. See `docs/architecture/` for the current and target architecture.

### Building for Production
```bash
# Type check and build static bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Testing & Quality Assurance

```bash
# Run unit and component tests (Vitest)
npm test

# Run ESLint static analysis
npm run lint

# Check Prettier code formatting
npm run format:check

# Run full Playwright E2E suite across Desktop, Tablet, and Mobile
npm run test:e2e

# Run complete deterministic assurance platform locally
npm run assurance
```

---

## Application Assurance Platform

The repository includes a standalone, deterministic assurance pipeline executed in CI and accessible locally via `npm run assurance`:

1. **Deterministic QA Agent** (`tools/assurance/qa-agent/run-qa.js`):
   - Verifies lockfile integrity (`package-lock.json`)
   - Strict TypeScript compiler check (`tsc --noEmit`)
   - ESLint static rule enforcement (`--max-warnings 0`)
   - Vitest unit & RTL component test execution
   - Production Vite build verification
2. **Static Security Agent** (`tools/assurance/security-agent/run-security.js`):
   - Non-invasive dependency CVE audit (`npm audit --json`)
   - Secret scanner matching OpenAI, GitHub PAT, AWS, and generic tokens
   - **Mandatory Redaction**: Discovered tokens are masked (`ghp_1234********wxyz`) and NEVER output or stored in plaintext
   - Static client checks preventing `eval()`, `dangerouslySetInnerHTML`, and unsafe execution
3. **Finding Verifier** (`tools/assurance/verifier/verify-findings.js`):
   - Deduplicates findings across agents
   - Normalizes severity (`Critical`, `High`, `Medium`, `Low`, `Informational`)
   - Computes prioritized remediation roadmap
4. **Assurance Orchestrator** (`tools/assurance/orchestrator/run-assurance.js`):
   - Generates `public/assurance/latest.json` for live UI display
   - Generates `assurance-results/report.md` for GitHub Actions Step Summary

---

## Architecture & Legacy Archive

- **Backend & AI Decision-Support Foundation (Phase 1)**: `backend/` contains a FastAPI service with a repository layer over the existing datasets, a Manager Agent routing to Anomaly, Maintenance, Voyage and Safety agents (deterministic rules, optional local LLM via Ollama), a human-approval state machine, and a persistent audit trail (SQLite by default, PostgreSQL via `DATABASE_URL`). Execution is simulated. See [`docs/architecture/backend-ai-foundation.md`](docs/architecture/backend-ai-foundation.md).
- **Authentication & Role-Based Approvals** (API mode): session login, 8 operational roles, domain-based approval authority, four-eyes rule for safety-critical decisions, per-vessel/terminal approval scope, user administration, and identity-attributed audit trail. See [`docs/architecture/auth-rbac.md`](docs/architecture/auth-rbac.md).
- **Real-Time Operations Layer**: a simulation clock places the synthetic datasets on the current timeline, vessels send simulated telemetry every 30 s, and the dashboard shows a live operations event stream. The feed is labelled as simulated. See [`docs/architecture/realtime-simulation.md`](docs/architecture/realtime-simulation.md).
- **Static JSON Architecture**: Synthetic maritime datasets are converted to static fixtures in `public/data/` at build time. Operator actions (acknowledgments, status changes, work orders) are simulated locally in browser memory and `localStorage`.
- **Legacy Streamlit Archive**: The original prototype is preserved in `legacy/streamlit/` for historical reference and parity auditing.
