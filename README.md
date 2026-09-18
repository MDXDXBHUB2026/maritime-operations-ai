# Maritime Operations AI Control Tower

[![Application Assurance CI Pipeline](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/assurance.yml/badge.svg)](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/assurance.yml)
[![Deploy to GitHub Pages](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/deploy.yml/badge.svg)](https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions/workflows/deploy.yml)

A high-performance, static React Single-Page Application (SPA) deployed to GitHub Pages, providing situational awareness and simulated decision support for commercial maritime operations, extended with a corporate-grade **AI Enterprise Control Tower** modeling autonomous agent governance and executive supervision.

- **Live Production URL**: [https://mdxdxbhub2026.github.io/maritime-operations-ai/](https://mdxdxbhub2026.github.io/maritime-operations-ai/)
- **Repository**: [https://github.com/MDXDXBHUB2026/maritime-operations-ai](https://github.com/MDXDXBHUB2026/maritime-operations-ai)
- **Enterprise Architecture Guide**: [`docs/enterprise-control-tower.md`](docs/enterprise-control-tower.md)

---

## Phase 2: AI Corporate Hierarchy & Enterprise Control Tower

The AI Enterprise Control Tower provides a corporate operating model that governs how executive leadership and department heads supervise a multi-tier hierarchy of autonomous AI agents.

### Core Architectural Principle
> *"Management has visibility across the organization and authority to intervene, while operational work remains delegated through the organizational hierarchy."*

### Key Enterprise Concepts
- **Human vs. AI Distinction**: Explicit entity types distinguish operational humans (`HUMAN` — CEO, Directors, Managers), staff advisory intelligence (`AI_ADVISOR` — Executive AI Advisor), and autonomous workers (`AI_AGENT` — 16 specialized agents).
- **Separation of Reporting vs. Authority**: Reporting lines define managerial supervision, while an explicit authority model (`EXECUTIVE`, `DIRECTOR`, `MANAGER`, `LEAD`, `AGENT`, `OBSERVER`) controls task assignment and approval permissions.
- **Deterministic Risk & Approval Governance**: High and Critical risk tasks are halted by deterministic policy gates (`WAITING_APPROVAL`) requiring human sign-off; Critical tasks mandate secondary audit by the `Independent Verification Agent`.
- **Capability Registry & Graceful Degradation**: Agents declare business capability requirements; simulated capability outages gracefully degrade agent operational modes (`FULL`, `LIMITED`, `DEGRADED`, `UNAVAILABLE`) rather than failing the platform.
- **Centralized Event Layer & Immutable Audit Trail**: All agent actions, policy evaluations, and managerial decisions publish structured events to an enterprise event store and immutable audit log.
- **Simulated Prototype Boundary**: All agent operations are client-side simulated demonstration controls with no live backend credentials or destructive OT actions, labeled: *"Simulated prototype control — no external system action executed."*

---

## Enterprise Control Tower Modules

1. **Executive Command Centre** (`#/command-centre`) — High-level workforce KPIs, active exceptions, "Needs Attention" triage, departmental health matrix, and executive event stream.
2. **Corporate Organization** (`#/organization`) — Interactive multi-level corporate hierarchy tree mapping CEO, advisory staff, Directors, Managers, and Agents with entity drill-down.
3. **AI Workforce Directory** (`#/workforce`) — Complete directory of human leaders and AI agents with search, status filters, and interactive **Agent Profile** drawer with supervisory controls (Pause, Resume, Reassign, Verify).
4. **Task Operations** (`#/tasks`) — Enterprise task register with multi-criteria filtering, lifecycle tracking (`CREATED` to `COMPLETED`), and interactive **Task Detail** drawer.
5. **Decision & Approval Inbox** (`#/approvals`) — Management approval queue with tabbed views (*Awaiting My Approval*, *Escalations*, *Verification Required*), and high-risk confirmation modals.
6. **Live Activity Stream** (`#/activity`) — Centralized multi-actor chronological event timeline with department and actor filters.
7. **Performance Analytics** (`#/performance`) — Aggregate SLA, quality score, pass rate, and task completion analytics at enterprise, department, and agent levels.
8. **Governance & Audit** (`#/governance`) — Interactive Policy Register, Capability Registry with live capability status toggling, and immutable audit trail.

---

## Maritime Operational Modules

1. **Executive Dashboard** (`#/dashboard`) — Fleet readiness rate, active vessels, critical alerts, live SVG map, equipment health breakdown, and 7-day fuel variance.
2. **Fleet Overview** (`#/fleet`) — Global interactive vessel map, 5 multi-dimensional filters, health/delay/exposure breakdowns, vessel drill-down, and operational status simulator.
3. **Anomaly Detection** (`#/anomalies`) — Multi-parameter anomaly register, 24-hour telemetry trend chart with baseline/threshold markers, and 7 controlled operator actions.
4. **Predictive Maintenance** (`#/maintenance`) — Asset health status, RUL countdowns, failure exposure distribution, spare parts tracking, and work order generation.
5. **Voyage & Fuel Optimisation** (`#/voyage`) — Real-time voyage comparison, bunker consumption trends, and interactive 6-parameter scenario simulator with instant mathematical updates.
6. **Safety Monitoring** (`#/safety`) — Incident & hazard register, risk score calculations, CCTV sensor monitoring placeholders, and corrective action workflows.
7. **Automation Centre** (`#/automation`) — Human-in-the-loop task review, strict approval gate for high-risk operations, and simulated execution logs.
8. **Application Assurance Centre** (`#/assurance`) — Continuous CI audit results, deterministic QA agent status, static security gates with mandatory secret redaction (`ghp_abcd********wxyz`), verified positive controls, and prioritized remediation roadmap.

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

- **Static JSON Architecture**: Synthetic maritime datasets are converted to static fixtures in `public/data/` at build time. Operator actions (acknowledgments, status changes, work orders) are simulated locally in browser memory and `localStorage`.
- **Legacy Streamlit Archive**: The original prototype is preserved in `legacy/streamlit/` for historical reference and parity auditing.
