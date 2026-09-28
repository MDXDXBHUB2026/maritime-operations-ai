import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Radio } from 'lucide-react';
import type { Alert, Anomaly, SafetyEvent, Vessel } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { liveTelemetry, REPORT_INTERVAL_MS, useNow } from '../../services/liveTelemetry';
import { relativeTime, SimulationClock } from '../../services/simulationClock';

interface StreamItem {
  key: string;
  timeMs: number;
  source: 'Telemetry' | 'Alert' | 'Anomaly' | 'Safety';
  severity?: string;
  text: string;
}

interface LiveOperationsPanelProps {
  /** Include the operations event stream (dashboard) or only the telemetry grid (fleet). */
  showEventStream?: boolean;
}

/**
 * Live operations view: per-vessel simulated telemetry that refreshes on each report cycle,
 * and a merged event stream of dataset events (on the current timeline) plus position reports.
 */
export const LiveOperationsPanel: React.FC<LiveOperationsPanelProps> = ({
  showEventStream = true,
}) => {
  const now = useNow(1000);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [events, setEvents] = useState<StreamItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [v, alerts, anomalies, safety] = await Promise.all([
          DataService.getVessels(),
          showEventStream ? DataService.getAlerts() : Promise.resolve([] as Alert[]),
          showEventStream ? DataService.getAnomalies() : Promise.resolve([] as Anomaly[]),
          showEventStream ? DataService.getSafetyEvents() : Promise.resolve([] as SafetyEvent[]),
        ]);
        if (cancelled) return;
        const overrides = StorageService.getVesselOverrides();
        setVessels(v.map((x) => ({ ...x, ...overrides[x.vessel_id] })));
        setEvents([
          ...alerts.map((a) => ({
            key: `alert-${a.alert_id}`,
            timeMs: SimulationClock.parseUtc(a.created_at),
            source: 'Alert' as const,
            severity: a.severity,
            text: `${a.asset}: ${a.description}`,
          })),
          ...anomalies.map((a) => ({
            key: `anomaly-${a.anomaly_id}`,
            timeMs: SimulationClock.parseUtc(a.detected_timestamp),
            source: 'Anomaly' as const,
            severity: a.severity,
            text: `${a.vessel_or_terminal}: ${a.parameter_name} ${a.current_value} (expected ${a.expected_value})`,
          })),
          ...safety.map((s) => ({
            key: `safety-${s.event_id}`,
            timeMs: SimulationClock.parseUtc(s.timestamp),
            source: 'Safety' as const,
            severity: s.severity,
            text: `${s.vessel_or_terminal} / ${s.location}: ${s.event_type}`,
          })),
        ]);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load live feed');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [showEventStream]);

  const telemetry = useMemo(() => vessels.map((v) => liveTelemetry(v, now)), [vessels, now]);

  const stream = useMemo(() => {
    const reports: StreamItem[] = telemetry
      .filter((t) => t.underway)
      .map((t) => ({
        key: `tel-${t.vessel_id}-${t.last_report_ms}`,
        timeMs: t.last_report_ms,
        source: 'Telemetry' as const,
        text: `${t.vessel_name} position report ${t.latitude.toFixed(2)}, ${t.longitude.toFixed(2)} · ${t.speed_knots} kn · ME load ${t.engine_load_percentage}%`,
      }));
    return [...reports, ...events.filter((e) => e.timeMs <= now)]
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, 12);
  }, [telemetry, events, now]);

  if (error) {
    return (
      <div className="card-panel">
        <div className="decision-msg-err">Live feed unavailable: {error}</div>
      </div>
    );
  }

  return (
    <div className="card-panel live-panel" data-testid="live-operations">
      <div className="live-panel-head">
        <h3>
          <Radio size={16} /> Live Vessel Telemetry
        </h3>
        <span className="live-muted">
          Simulated feed · report cycle {REPORT_INTERVAL_MS / 1000}s per vessel
        </span>
      </div>
      <div className="telemetry-grid" data-testid="telemetry-grid">
        {telemetry.map((t) => (
          <div
            key={t.vessel_id}
            className={`telemetry-card ${t.underway ? 'underway' : 'stationary'}`}
            data-testid="telemetry-card"
          >
            <div className="telemetry-title">
              <strong>{t.vessel_name}</strong>
              <span className="live-muted">{t.operational_status}</span>
            </div>
            <div className="telemetry-values">
              <div>
                <label>SOG</label>
                <span>{t.speed_knots.toFixed(1)} kn</span>
              </div>
              <div>
                <label>ME load</label>
                <span>{t.engine_load_percentage}%</span>
              </div>
              <div>
                <label>Fuel</label>
                <span>{t.fuel_consumption_tonnes_day.toFixed(1)} t/d</span>
              </div>
            </div>
            <div className="live-muted">
              Last report {relativeTime(t.last_report_ms, now)} · next{' '}
              {relativeTime(t.next_report_ms, now)}
            </div>
          </div>
        ))}
      </div>

      {showEventStream && (
        <>
          <div className="live-panel-head" style={{ marginTop: '1rem' }}>
            <h3>
              <Activity size={16} /> Operations Event Stream
            </h3>
            <span className="live-muted">Newest first · synthetic events on current timeline</span>
          </div>
          <ul className="event-stream" data-testid="event-stream">
            {stream.map((e) => (
              <li key={e.key}>
                <span className={`stream-source ${e.source.toLowerCase()}`}>{e.source}</span>
                {e.severity && (
                  <span className={`pill ${e.severity.toLowerCase()}`}>{e.severity}</span>
                )}
                <span className="stream-text">{e.text}</span>
                <span className="live-muted stream-time">{relativeTime(e.timeMs, now)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
