import React, { useEffect, useState } from 'react';
import { ActionHistoryEntry, Anomaly, SensorReading } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { anomalyKpis } from '../../utils/anomalyCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { SensorTrendChart } from '../../components/charts/SensorTrendChart';
import { Check, AlertTriangle } from 'lucide-react';

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const OWNERS = [
  'Unassigned',
  'Fleet Technical Manager',
  'Chief Engineer',
  'Terminal Maintenance Lead',
  'Reefer Operations Supervisor',
  'HSE Manager',
  'Digital Operations Analyst',
];

export const AnomalyDetectionPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [history, setHistory] = useState<ActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([...SEVERITY_ORDER]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('');
  const [actionComment, setActionComment] = useState<string>('');
  const [assignedOwner, setAssignedOwner] = useState<string>('Unassigned');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [aData, sData] = await Promise.all([
          DataService.getAnomalies(),
          DataService.getSensorReadings(),
        ]);

        const overrides = StorageService.getAnomalyOverrides();
        const mergedAnomalies = aData.map((a) => {
          const ov = overrides[a.anomaly_id];
          return ov ? { ...a, ...ov } : a;
        });

        setAnomalies(mergedAnomalies);
        setSensors(sData);
        setHistory(StorageService.getAnomalyHistory());

        if (mergedAnomalies.length > 0) {
          setSelectedAnomalyId(mergedAnomalies[0].anomaly_id);
          setAssignedOwner(mergedAnomalies[0].owner || 'Unassigned');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load anomaly data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePerformAction = (
    action: string,
    newStatus: string,
    extras: { owner?: string; escalate?: boolean; createWorkOrder?: boolean } = {}
  ) => {
    if (!selectedAnomalyId) return;

    const current = anomalies.find((a) => a.anomaly_id === selectedAnomalyId);
    if (!current) return;

    const previousStatus = current.status;
    let finalOwner = current.owner;
    let finalSeverity = current.severity;
    let workOrderRef = current.work_order_reference;

    if (extras.owner !== undefined) {
      finalOwner = extras.owner;
    }
    if (extras.escalate) {
      finalSeverity = 'Critical';
    }
    if (extras.createWorkOrder) {
      workOrderRef = StorageService.getNextWorkOrderReference();
    }

    const updates: Partial<Anomaly> = {
      status: newStatus as Anomaly['status'],
      owner: finalOwner,
      severity: finalSeverity as Anomaly['severity'],
      work_order_reference: workOrderRef,
    };

    setAnomalies((prev) =>
      prev.map((a) => (a.anomaly_id === selectedAnomalyId ? { ...a, ...updates } : a))
    );
    StorageService.saveAnomalyOverride(selectedAnomalyId, updates);

    const historyEntry: ActionHistoryEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      anomaly_id: selectedAnomalyId,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      owner: finalOwner,
      comment: actionComment.trim() || '—',
    };

    StorageService.addAnomalyHistory(historyEntry);
    setHistory((prev) => [historyEntry, ...prev]);

    const woDetail = extras.createWorkOrder ? ` — ${workOrderRef}` : '';
    setFlashMessage(`${selectedAnomalyId}: ${action} completed${woDetail}`);
    setActionComment('');
    setTimeout(() => setFlashMessage(null), 4500);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading Anomaly Detection...</div>
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

  const kpis = anomalyKpis(anomalies);

  // Apply filters
  const filteredAnomalies = anomalies.filter((a) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(a.asset_category))
      return false;
    if (selectedSites.length > 0 && !selectedSites.includes(a.vessel_or_terminal)) return false;
    if (!selectedSeverities.includes(a.severity)) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(a.anomaly_type)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(a.status)) return false;
    return true;
  });

  const selectedAnomaly =
    filteredAnomalies.find((a) => a.anomaly_id === selectedAnomalyId) ||
    filteredAnomalies[0] ||
    anomalies[0];

  const categoriesList = Array.from(new Set(anomalies.map((a) => a.asset_category))).sort();
  const sitesList = Array.from(new Set(anomalies.map((a) => a.vessel_or_terminal))).sort();
  const typesList = Array.from(new Set(anomalies.map((a) => a.anomaly_type))).sort();
  const statusesList = Array.from(new Set(anomalies.map((a) => a.status))).sort();

  const selectedSensors = selectedAnomaly
    ? sensors.filter((s) => s.anomaly_id === selectedAnomaly.anomaly_id)
    : [];

  const anomalyHistory = history.filter((h) => h.anomaly_id === selectedAnomaly?.anomaly_id);

  return (
    <div>
      <div className="eyebrow">RULE-BASED OPERATIONAL INTELLIGENCE</div>
      <h1>Anomaly Detection</h1>
      <p className="subtitle">
        Review synthetic signals across vessels, quay cranes and reefer containers
      </p>

      <div className="disclaimer-banner">
        This conceptual anomaly-detection prototype uses synthetic operational data and illustrative
        rule-based thresholds. It is not based on production systems or approved engineering limits.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid-6">
        <MetricCard
          label="Assets monitored"
          value={kpis['Assets monitored']}
          icon="◉"
          badge="RULE BASED"
        />
        <MetricCard
          label="Active anomalies"
          value={kpis['Active anomalies']}
          icon="◆"
          badge="RULE BASED"
        />
        <MetricCard
          label="Critical anomalies"
          value={kpis['Critical anomalies']}
          icon="!"
          badge="RULE BASED"
        />
        <MetricCard
          label="New anomalies today"
          value={kpis['New anomalies today']}
          icon="+"
          badge="RULE BASED"
        />
        <MetricCard
          label="Acknowledged anomalies"
          value={kpis['Acknowledged anomalies']}
          icon="✓"
          badge="RULE BASED"
        />
        <MetricCard
          label="Average confidence"
          value={kpis['Average confidence']}
          icon="%"
          badge="RULE BASED"
        />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Asset Category</label>
          <select
            value={selectedCategories[0] || 'All'}
            onChange={(e) =>
              setSelectedCategories(e.target.value === 'All' ? [] : [e.target.value])
            }
          >
            <option value="All">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Vessel or Terminal</label>
          <select
            value={selectedSites[0] || 'All'}
            onChange={(e) => setSelectedSites(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Sites</option>
            {sitesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Severity</label>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {SEVERITY_ORDER.map((sev) => {
              const active = selectedSeverities.includes(sev);
              return (
                <button
                  key={sev}
                  onClick={() =>
                    setSelectedSeverities((prev) =>
                      active ? prev.filter((s) => s !== sev) : [...prev, sev]
                    )
                  }
                  className={`pill ${sev.toLowerCase()}`}
                  style={{ opacity: active ? 1 : 0.35, cursor: 'pointer' }}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-item">
          <label>Anomaly Type</label>
          <select
            value={selectedTypes[0] || 'All'}
            onChange={(e) => setSelectedTypes(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Types</option>
            {typesList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Status</label>
          <select
            value={selectedStatuses[0] || 'All'}
            onChange={(e) => setSelectedStatuses(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Statuses</option>
            {statusesList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Anomaly Register Table */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Anomaly Register</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredAnomalies.length} of {anomalies.length} anomalies
          </span>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: '280px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Anomaly ID</th>
                <th>Detection Time</th>
                <th>Asset</th>
                <th>Location</th>
                <th>Parameter</th>
                <th>Current</th>
                <th>Expected</th>
                <th>Deviation %</th>
                <th>Severity</th>
                <th>Confidence %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.map((a) => (
                <tr
                  key={a.anomaly_id}
                  onClick={() => {
                    setSelectedAnomalyId(a.anomaly_id);
                    setAssignedOwner(a.owner || 'Unassigned');
                  }}
                  className={selectedAnomaly?.anomaly_id === a.anomaly_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{a.anomaly_id}</td>
                  <td>{a.detected_timestamp.substring(0, 16).replace('T', ' ')}</td>
                  <td style={{ fontWeight: 600 }}>{a.asset_name}</td>
                  <td>{a.location}</td>
                  <td>{a.parameter_name}</td>
                  <td>{a.current_value}</td>
                  <td>{a.expected_value}</td>
                  <td>{a.deviation_percentage.toFixed(1)}%</td>
                  <td>
                    <span className={`pill ${a.severity.toLowerCase()}`}>{a.severity}</span>
                  </td>
                  <td>{a.confidence_score.toFixed(1)}%</td>
                  <td>
                    <span
                      className={`pill ${a.status === 'Closed' ? 'low' : a.status === 'Acknowledged' ? 'medium' : 'info'}`}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Anomaly Detail & 24h Trend */}
      {selectedAnomaly && (
        <div>
          <div className="card-panel">
            <h3>Selected Anomaly Detail: {selectedAnomaly.anomaly_id}</h3>
            <div className={`alert-card ${selectedAnomaly.severity.toLowerCase()}`}>
              <div className="alert-heading">
                <span className={`pill ${selectedAnomaly.severity.toLowerCase()}`}>
                  {selectedAnomaly.severity}
                </span>
                <strong>{selectedAnomaly.asset_name}</strong>
                <span>Status: {selectedAnomaly.status}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <label>Asset Identity</label>
                  <div>{selectedAnomaly.asset_id}</div>
                </div>
                <div>
                  <label>Category</label>
                  <div>{selectedAnomaly.asset_category}</div>
                </div>
                <div>
                  <label>Vessel / Terminal</label>
                  <div>{selectedAnomaly.vessel_or_terminal}</div>
                </div>
                <div>
                  <label>Location</label>
                  <div>{selectedAnomaly.location}</div>
                </div>
                <div>
                  <label>Detected</label>
                  <div>{selectedAnomaly.detected_timestamp.substring(0, 16).replace('T', ' ')}</div>
                </div>
                <div>
                  <label>Parameter</label>
                  <div>{selectedAnomaly.parameter_name}</div>
                </div>
                <div>
                  <label>Current / Expected</label>
                  <div>
                    {selectedAnomaly.current_value} / {selectedAnomaly.expected_value}
                  </div>
                </div>
                <div>
                  <label>Illustrative Range</label>
                  <div>
                    {selectedAnomaly.lower_threshold} &ndash; {selectedAnomaly.upper_threshold}
                  </div>
                </div>
                <div>
                  <label>Deviation</label>
                  <div>{selectedAnomaly.deviation_percentage.toFixed(1)}%</div>
                </div>
                <div>
                  <label>Confidence</label>
                  <div>{selectedAnomaly.confidence_score.toFixed(1)}%</div>
                </div>
                <div>
                  <label>Probable Cause</label>
                  <div>{selectedAnomaly.probable_cause}</div>
                </div>
                <div>
                  <label>Recommended Action</label>
                  <div>{selectedAnomaly.recommended_action}</div>
                </div>
                <div>
                  <label>Potential Consequence</label>
                  <div>{selectedAnomaly.potential_consequence}</div>
                </div>
                <div>
                  <label>Owner</label>
                  <div>{selectedAnomaly.owner || 'Unassigned'}</div>
                </div>
                <div>
                  <label>Work Order</label>
                  <div
                    style={{
                      color: selectedAnomaly.work_order_reference ? '#28c499' : 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    {selectedAnomaly.work_order_reference || 'Not created'}
                  </div>
                </div>
                <div>
                  <label>Current Status</label>
                  <div>{selectedAnomaly.status}</div>
                </div>
              </div>
            </div>

            {/* 24-hour Trend Chart */}
            <SensorTrendChart
              readings={selectedSensors}
              parameterName={selectedAnomaly.parameter_name}
              assetName={selectedAnomaly.asset_name}
            />

            {/* Operator Actions Section */}
            <div style={{ marginTop: '1.25rem' }}>
              <h3>Operator Actions</h3>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="text"
                  placeholder="Optional action comment for history"
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  style={{ flex: 1, minWidth: '240px' }}
                />

                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <select
                    value={assignedOwner}
                    onChange={(e) => setAssignedOwner(e.target.value)}
                    style={{ minWidth: '160px' }}
                  >
                    {OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    onClick={() =>
                      handlePerformAction('Assign owner', 'Assigned', { owner: assignedOwner })
                    }
                  >
                    Assign
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePerformAction('Acknowledge', 'Acknowledged')}
                >
                  Acknowledge
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handlePerformAction('Escalate', 'Escalated', { escalate: true })}
                >
                  Escalate
                </button>
                <button
                  className="btn"
                  onClick={() => handlePerformAction('Continue monitoring', 'Monitoring')}
                >
                  Monitor
                </button>
                <button
                  className="btn"
                  onClick={() => handlePerformAction('Initiate inspection', 'Inspection Initiated')}
                >
                  Inspect
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    handlePerformAction('Create work order', 'Work Order Created', {
                      createWorkOrder: true,
                    })
                  }
                >
                  Work Order
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => handlePerformAction('Close anomaly', 'Closed')}
                >
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* Action History */}
          <div className="card-panel">
            <h3>Action History ({selectedAnomaly.anomaly_id})</h3>
            {anomalyHistory.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                No operator actions recorded in this session for this anomaly.
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Previous Status</th>
                      <th>New Status</th>
                      <th>Owner</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyHistory.map((h, idx) => (
                      <tr key={idx}>
                        <td>{h.timestamp}</td>
                        <td style={{ fontWeight: 600 }}>{h.action}</td>
                        <td>{h.previous_status}</td>
                        <td>
                          <span className="pill info">{h.new_status}</span>
                        </td>
                        <td>{h.owner}</td>
                        <td>{h.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
