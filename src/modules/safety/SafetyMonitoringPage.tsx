import React, { useEffect, useState } from 'react';
import { ActionHistoryEntry, SafetyEvent } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { safetyKpis } from '../../utils/safetyCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { BarChart } from '../../components/charts/BarChart';
import { Check, AlertTriangle } from 'lucide-react';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const OWNERS = [
  'Unassigned',
  'HSE Manager',
  'Terminal Safety Lead',
  'Marine Superintendent',
  'Shift Supervisor',
  'Investigation Lead',
];

export const SafetyMonitoringPage: React.FC = () => {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [history, setHistory] = useState<ActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedSite, setSelectedSite] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedSource, setSelectedSource] = useState<string>('All');

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [immediateActionInput, setImmediateActionInput] = useState<string>('');
  const [assignedOwner, setAssignedOwner] = useState<string>('Unassigned');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await DataService.getSafetyEvents();
        const overrides = StorageService.getSafetyOverrides();
        const merged: SafetyEvent[] = data.map((ev) => {
          const ov = overrides[ev.event_id];
          return ov ? ({ ...ev, ...ov } as SafetyEvent) : ev;
        });

        setEvents(merged);
        setHistory(StorageService.getSafetyHistory());

        if (merged.length > 0) {
          setSelectedEventId(merged[0].event_id);
          setImmediateActionInput(merged[0].immediate_action || '');
          setAssignedOwner(merged[0].responsible_owner || 'Unassigned');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load safety data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAction = (
    actionName: string,
    newStatus: string,
    extras: { owner?: string; immediate?: string; escalate?: boolean } = {}
  ) => {
    if (!selectedEventId) return;
    const current = events.find((e) => e.event_id === selectedEventId);
    if (!current) return;

    const previousStatus = current.status;
    let finalOwner = current.responsible_owner;
    let finalImmediate = current.immediate_action;
    let finalSeverity = current.severity;
    let finalRisk = current.risk_score;

    if (extras.owner !== undefined) finalOwner = extras.owner;
    if (extras.immediate !== undefined) finalImmediate = extras.immediate;
    if (extras.escalate) {
      finalSeverity = 'Critical';
      finalRisk = 100;
    }

    const updates: Partial<SafetyEvent> = {
      status: newStatus,
      responsible_owner: finalOwner,
      immediate_action: finalImmediate,
      severity: finalSeverity as SafetyEvent['severity'],
      risk_score: finalRisk,
    };

    setEvents((prev) =>
      prev.map((e) => (e.event_id === selectedEventId ? { ...e, ...updates } : e))
    );
    StorageService.saveSafetyOverride(selectedEventId, updates);

    const historyEntry: ActionHistoryEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      event: selectedEventId,
      action: actionName,
      previous_status: previousStatus,
      new_status: newStatus,
      owner: finalOwner,
      comment: comment.trim() || '—',
    };

    StorageService.addSafetyHistory(historyEntry);
    setHistory((prev) => [historyEntry, ...prev]);

    setFlashMessage(`${selectedEventId}: ${actionName} completed`);
    setComment('');
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading Safety Monitoring...</div>
    );
  }

  if (error) {
    return (
      <div className="banner-error">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const kpis = safetyKpis(events);

  // Apply filters
  const filteredEvents = events.filter((e) => {
    if (selectedType !== 'All' && e.event_type !== selectedType) return false;
    if (selectedSeverity !== 'All' && e.severity !== selectedSeverity) return false;
    if (selectedSite !== 'All' && e.vessel_or_terminal !== selectedSite) return false;
    if (selectedLocation !== 'All' && e.location !== selectedLocation) return false;
    if (selectedStatus !== 'All' && e.status !== selectedStatus) return false;
    if (selectedSource !== 'All' && e.detection_source !== selectedSource) return false;
    return true;
  });

  const selectedEvent =
    filteredEvents.find((e) => e.event_id === selectedEventId) || filteredEvents[0] || events[0];

  const typesList = ['All', ...Array.from(new Set(events.map((e) => e.event_type))).sort()];
  const sitesList = ['All', ...Array.from(new Set(events.map((e) => e.vessel_or_terminal))).sort()];
  const locsList = ['All', ...Array.from(new Set(events.map((e) => e.location))).sort()];
  const statusesList = ['All', ...Array.from(new Set(events.map((e) => e.status))).sort()];
  const sourcesList = ['All', ...Array.from(new Set(events.map((e) => e.detection_source))).sort()];

  // Distribution chart data
  const distCounts: Record<string, number> = {};
  filteredEvents.forEach((e) => {
    distCounts[e.event_type] = (distCounts[e.event_type] || 0) + 1;
  });
  const distData = Object.entries(distCounts).map(([type, count]) => ({
    label: type,
    value: count,
    color: '#25c2d8',
  }));

  // Camera event placeholders
  const cameraEvents = filteredEvents
    .filter((e) => e.detection_source === 'Synthetic camera event')
    .slice(0, 3);

  return (
    <div>
      <div className="eyebrow">SAFETY INTELLIGENCE</div>
      <h1>Safety Monitoring</h1>
      <p className="subtitle">Synthetic observations and simulated detection events</p>

      <div className="disclaimer-banner">
        This conceptual safety module uses synthetic records, neutral evidence references and
        illustrative risk scores. It does not use real photographs, production computer vision or
        approved safety limits.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid-6">
        <MetricCard label="Open safety events" value={kpis['Open safety events']} icon="🛡" />
        <MetricCard label="Critical events" value={kpis['Critical events']} icon="!" />
        <MetricCard label="Near misses" value={kpis['Near misses']} icon="⚠" />
        <MetricCard label="Overdue actions" value={kpis['Overdue actions']} icon="⏳" />
        <MetricCard label="High-risk locations" value={kpis['High-risk locations']} icon="📍" />
        <MetricCard label="Days without LTI" value={kpis['Days without LTI']} icon="✓" />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Event Type</label>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {typesList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Severity</label>
          <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)}>
            <option value="All">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Site</label>
          <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
            {sitesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Location</label>
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            {locsList.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Status</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            {statusesList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Source</label>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
            {sourcesList.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Safety Event Register */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Safety Event Register</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredEvents.length} of {events.length} records
          </span>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: '280px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Detection Source</th>
                <th>Vessel / Terminal</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Persons</th>
                <th>Risk Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr
                  key={ev.event_id}
                  onClick={() => {
                    setSelectedEventId(ev.event_id);
                    setImmediateActionInput(ev.immediate_action || '');
                    setAssignedOwner(ev.responsible_owner || 'Unassigned');
                  }}
                  className={selectedEvent?.event_id === ev.event_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{ev.event_id}</td>
                  <td>{ev.timestamp.substring(0, 16).replace('T', ' ')}</td>
                  <td style={{ fontWeight: 600 }}>{ev.event_type}</td>
                  <td>{ev.detection_source}</td>
                  <td>{ev.vessel_or_terminal}</td>
                  <td>{ev.location}</td>
                  <td>
                    <span className={`pill ${ev.severity.toLowerCase()}`}>{ev.severity}</span>
                  </td>
                  <td>{ev.persons_exposed}</td>
                  <td
                    style={{ fontWeight: 600, color: ev.risk_score >= 70 ? '#ef5b69' : '#28c499' }}
                  >
                    {ev.risk_score}/100
                  </td>
                  <td>
                    <span className={`pill ${ev.status === 'Closed' ? 'low' : 'info'}`}>
                      {ev.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics & Simulated Camera Events */}
      <div className="grid-2">
        <BarChart title="Event Distribution by Type" data={distData} height={260} />

        <div className="card-panel">
          <h3>Simulated Camera-Event Placeholders</h3>
          {cameraEvents.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              No camera events match the active filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {cameraEvents.map((cEv) => (
                <div
                  key={cEv.event_id}
                  className={`alert-card ${cEv.severity.toLowerCase()}`}
                  style={{ margin: 0 }}
                >
                  <div className="alert-heading">
                    <span className={`pill ${cEv.severity.toLowerCase()}`}>{cEv.severity}</span>
                    <strong>
                      {cEv.event_type} &mdash; {cEv.location}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      Risk: {cEv.risk_score}/100
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9fb5cc', marginTop: '0.35rem' }}>
                    Neutral synthetic event placeholder &middot; Ref:{' '}
                    <code>{cEv.evidence_reference}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Event Detail Panel */}
      {selectedEvent && (
        <div className="card-panel">
          <h3>
            Event Detail: {selectedEvent.event_id} &mdash; {selectedEvent.event_type}
          </h3>

          <div className={`alert-card ${selectedEvent.severity.toLowerCase()}`}>
            <div className="alert-heading">
              <span className={`pill ${selectedEvent.severity.toLowerCase()}`}>
                {selectedEvent.severity}
              </span>
              <strong>{selectedEvent.event_type}</strong>
              <span className="pill info">{selectedEvent.status}</span>
            </div>
            <div className="detail-grid">
              <div>
                <label>Description</label>
                <div>{selectedEvent.description}</div>
              </div>
              <div>
                <label>Risk Score</label>
                <div>{selectedEvent.risk_score}/100</div>
              </div>
              <div>
                <label>Detection Source</label>
                <div>{selectedEvent.detection_source}</div>
              </div>
              <div>
                <label>Persons Exposed</label>
                <div>{selectedEvent.persons_exposed}</div>
              </div>
              <div>
                <label>Immediate Action</label>
                <div>{selectedEvent.immediate_action}</div>
              </div>
              <div>
                <label>Recommended Corrective Action</label>
                <div>{selectedEvent.recommended_corrective_action}</div>
              </div>
              <div>
                <label>Owner / Due</label>
                <div>
                  {selectedEvent.responsible_owner} &middot;{' '}
                  {selectedEvent.due_date.substring(0, 10)}
                </div>
              </div>
              <div>
                <label>Evidence Reference</label>
                <div>{selectedEvent.evidence_reference}</div>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="Optional action comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />

              <input
                type="text"
                placeholder="Immediate action update"
                value={immediateActionInput}
                onChange={(e) => setImmediateActionInput(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />

              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <select
                  value={assignedOwner}
                  onChange={(e) => setAssignedOwner(e.target.value)}
                  style={{ minWidth: '150px' }}
                >
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button
                  className="btn"
                  onClick={() => handleAction('Assign owner', 'Assigned', { owner: assignedOwner })}
                >
                  Assign
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('Acknowledge event', 'Acknowledged')}
              >
                Acknowledge
              </button>
              <button
                className="btn"
                onClick={() => handleAction('Start investigation', 'Under Review')}
              >
                Investigate
              </button>
              <button
                className="btn"
                onClick={() =>
                  handleAction('Add immediate action', 'In Progress', {
                    immediate: immediateActionInput,
                  })
                }
              >
                Immediate Action
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('Create corrective action', 'Work Order Created')}
              >
                Corrective Action
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleAction('Escalate', 'Escalated', { escalate: true })}
              >
                Escalate
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleAction('Mark action completed', 'Completed')}
              >
                Complete
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleAction('Close event', 'Closed')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action History */}
      <div className="card-panel">
        <h3>Action History</h3>
        <div className="data-table-wrapper" style={{ maxHeight: '200px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Action</th>
                <th>Previous Status</th>
                <th>New Status</th>
                <th>Owner</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No safety actions recorded in this session.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td>{h.timestamp}</td>
                    <td>{h.event}</td>
                    <td style={{ fontWeight: 600 }}>{h.action}</td>
                    <td>{h.previous_status}</td>
                    <td>
                      <span className="pill info">{h.new_status}</span>
                    </td>
                    <td>{h.owner}</td>
                    <td>{h.comment}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
