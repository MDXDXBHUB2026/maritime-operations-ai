# Real-Time Operations Layer (Phase 1b)

Goal: make the control tower behave like an operational system, not a static snapshot, **without
presenting synthetic data as real**. Everything shown is internally consistent and current-dated,
and the UI states clearly that the feed is simulated and the data synthetic.

## Before

- Header showed a hard-coded clock (`UTC 2026-07-23 14:00`) next to a "LIVE SYSTEM" label.
- Every timestamp was fixed in July 2026, so the data looked stale on any later day.
- Numbers never changed while the app was open.
- The backend decision workflow existed but no screen used it.

## Implemented

| Capability | How it works | Where |
|---|---|---|
| Simulation clock | Dataset timestamps are shifted by the whole number of hours between the dataset reference (2026-07-23 09:00 UTC) and now. Event order, ETA variance, due dates and overdue flags are preserved exactly. The offset is fixed per session so values do not jump. | `src/services/simulationClock.ts`, applied centrally in `DataService` (static and API mode) |
| Model reference times | Voyage scenario ETA base and maintenance "today" use the same clock instead of hard-coded July dates. | `VoyageOptimisationPage`, `PredictiveMaintenancePage` |
| Live status bar | Ticking UTC clock, "SIMULATED LIVE FEED" label, "Synthetic data · snapshot N ago", and in API mode a backend health indicator polled every 30 s. | `src/components/live/LiveStatusBar.tsx` |
| Live vessel telemetry | Each vessel reports every 30 s (staggered per vessel, like AIS/sensor feeds). Speed over ground, main-engine load and fuel rate vary within ±2-3 % of the dataset baseline; fuel follows the propeller law (cube of speed ratio). Stationary vessels do not move. Deterministic, so every viewer sees the same values. | `src/services/liveTelemetry.ts`, `LiveOperationsPanel` on Executive Dashboard and Fleet Overview |
| Operations event stream | Alerts, anomalies and safety events on the current timeline merged with live position reports, newest first, with relative times. | `LiveOperationsPanel` (dashboard) |
| AI Decision Support panel | On Anomaly, Maintenance, Voyage and Safety: generate a recommendation, review, approve, reject (reason required), simulated execute, view evidence and the audit trail. Previous recommendations for the same entity are reloaded from the backend. | `src/components/decisions/DecisionPanel.tsx` |
| AI Decision Centre | Fleet-wide decision register (filter by status), decision detail, and recent audit events. | `#/decisions`, `src/modules/decisions/DecisionCentrePage.tsx` |
| Mode indicator | Sidebar shows `Static GitHub Pages` or `API mode · FastAPI`. | `MainLayout.tsx` |

In STATIC mode (GitHub Pages) the live clock, rebased data, telemetry and event stream all work
without a backend. The decision panels and the Decision Centre explain that they need API mode.

## Deliberately not done

- No real vessel names, IMO numbers, companies or positions were introduced. The datasets remain synthetic.
- Vessel positions do not move on the map. Straight-line interpolation would cross land, and realistic
  movement needs route geometry (see next steps).
- "LIVE" badges on KPI tiles remain, because the tiles now recompute on current-timeline data. The status bar
  states that the feed is simulated.

## Next steps (recommended order)

1. **Backend telemetry service**: move the telemetry model to the backend and stream it (Server-Sent Events or
   WebSocket), so API mode shows one shared feed. Then add an ingestion endpoint so real feeds can replace it.
2. **Route-aware vessel movement**: dead-reckon positions along waypoint routes (sea-lane geometry) and move markers.
3. **Rolling sensor trends**: append live points to the anomaly trend chart; raise new anomalies when simulated
   values cross thresholds, then send them to the Anomaly Agent automatically (as a PROPOSED decision only).
4. **Notifications**: badge counts for decisions awaiting approval in the sidebar.
5. **Real data integration** (production path): AIS provider, vessel noon reports / sensor gateways, and CMMS/ERP work
   orders behind the existing `MaritimeRepository` interface, with authentication and role-based approvals first.
