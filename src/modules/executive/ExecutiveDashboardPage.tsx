import React, { useEffect, useState } from 'react';
import { Alert, Equipment, SafetyEvent, Vessel, Voyage } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { dashboardKpis, equipmentHealthCounts, maintenanceSummary } from '../../utils/calculations';
import { MetricCard } from '../../components/common/MetricCard';
import { InteractiveMap } from '../../components/charts/InteractiveMap';
import { HealthDonutChart } from '../../components/charts/HealthDonutChart';
import { BarChart } from '../../components/charts/BarChart';
import { AlertTriangle, Check } from 'lucide-react';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const OWNERS = [
  'Unassigned',
  'Maintenance Lead',
  'Safety Manager',
  'Fleet Performance',
  'Voyage Manager',
  'Shift Supervisor',
  'IT Operations',
];

export const ExecutiveDashboardPage: React.FC = () => {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [safety, setSafety] = useState<SafetyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for Alert Centre
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([...SEVERITIES]);
  const [selectedModule, setSelectedModule] = useState<string>('All');
  const [selectedAsset, setSelectedAsset] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');
  const [chosenOwner, setChosenOwner] = useState<string>('');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        const [vData, voyData, eqData, aData, sData] = await Promise.all([
          DataService.getVessels(),
          DataService.getVoyages(),
          DataService.getEquipment(),
          DataService.getAlerts(),
          DataService.getSafetyEvents(),
        ]);

        // Overlay storage overrides for alerts and vessels
        const alertOverrides = StorageService.getAlertOverrides();
        const mergedAlerts: Alert[] = aData.map((a) => {
          const ov = alertOverrides[a.alert_id];
          return ov ? ({ ...a, ...ov } as Alert) : a;
        });

        const vesselOverrides = StorageService.getVesselOverrides();
        const mergedVessels: Vessel[] = vData.map((v) => {
          const ov = vesselOverrides[v.vessel_id];
          return ov ? ({ ...v, ...ov } as Vessel) : v;
        });

        setVessels(mergedVessels);
        setVoyages(voyData);
        setEquipment(eqData);
        setAlerts(mergedAlerts);
        setSafety(sData);

        if (mergedAlerts.length > 0) {
          setSelectedAlertId(mergedAlerts[0].alert_id);
          setChosenOwner(mergedAlerts[0].owner || 'Unassigned');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load executive dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handleUpdateAlert = (alertId: string, updates: Partial<Alert>) => {
    setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? { ...a, ...updates } : a)));
    StorageService.saveAlertOverride(alertId, updates);
    setFlashMessage(`${alertId} updated successfully`);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
        Loading Executive Dashboard...
      </div>
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

  const kpis = dashboardKpis(vessels, voyages, equipment, alerts, safety);
  const healthCounts = equipmentHealthCounts(equipment);
  const maintSummary = maintenanceSummary(equipment);

  // Filter alerts
  const filteredAlerts = alerts.filter((a) => {
    if (!selectedSeverities.includes(a.severity)) return false;
    if (selectedModule !== 'All' && a.module !== selectedModule) return false;
    if (selectedAsset !== 'All' && a.asset !== selectedAsset) return false;
    if (selectedStatus !== 'All' && a.status !== selectedStatus) return false;
    return true;
  });

  const selectedAlert =
    filteredAlerts.find((a) => a.alert_id === selectedAlertId) || filteredAlerts[0];

  const modulesList = ['All', ...Array.from(new Set(alerts.map((a) => a.module))).sort()];
  const assetsList = ['All', ...Array.from(new Set(alerts.map((a) => a.asset))).sort()];
  const statusesList = ['All', ...Array.from(new Set(alerts.map((a) => a.status))).sort()];

  // Voyage chart data
  const voyageFuelData = voyages.map((v) => ({
    label: v.voyage_id,
    value: v.planned_fuel_tonnes,
    secondaryValue: v.actual_fuel_tonnes,
  }));

  return (
    <div>
      <div className="eyebrow">EXECUTIVE OPERATIONS DASHBOARD</div>
      <h1>Maritime Operations Control Tower</h1>
      <p className="subtitle">
        Unified situational awareness across fleet, terminals, equipment and safety
      </p>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid-6">
        <MetricCard label="Active vessels" value={kpis['Active vessels']} icon="◉" />
        <MetricCard label="Critical alerts" value={kpis['Critical alerts']} icon="!" />
        <MetricCard
          label="Predicted failures (30d)"
          value={kpis['Predicted failures (30d)']}
          icon="⚙"
        />
        <MetricCard label="Delayed voyages" value={kpis['Delayed voyages']} icon="◷" />
        <MetricCard label="Potential fuel saving" value={kpis['Potential fuel saving']} icon="↘" />
        <MetricCard label="Open high-risk safety" value={kpis['Open high-risk safety']} icon="◆" />
      </div>

      {/* Live Map & Fleet Status */}
      <div className="grid-2" style={{ alignItems: 'stretch' }}>
        <div
          className="card-panel"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}
        >
          <h3>Live Operational Picture</h3>
          <InteractiveMap vessels={vessels} height={390} />
        </div>

        <div
          className="card-panel"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}
        >
          <h3>Fleet Status</h3>
          <div className="data-table-wrapper" style={{ maxHeight: '390px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Destination</th>
                  <th>Predicted ETA</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {vessels.map((v) => (
                  <tr key={v.vessel_id}>
                    <td style={{ fontWeight: 600 }}>{v.vessel_name}</td>
                    <td>{v.vessel_type}</td>
                    <td>
                      <span
                        className={`pill ${v.operational_status === 'Underway' ? 'low' : 'info'}`}
                      >
                        {v.operational_status}
                      </span>
                    </td>
                    <td>{v.current_location}</td>
                    <td>{v.destination || v.destination_port}</td>
                    <td>
                      {v.predicted_eta ? v.predicted_eta.substring(0, 16).replace('T', ' ') : '—'}
                    </td>
                    <td>
                      <span
                        className={`pill ${(v.risk_level || v.safety_risk_level || 'Low').toLowerCase()}`}
                      >
                        {v.risk_level || v.safety_risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Critical Alert Centre */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Critical Alert Centre</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </span>
        </div>

        {flashMessage && (
          <div className="banner-success">
            <Check size={16} />
            <span>{flashMessage}</span>
          </div>
        )}

        {/* Alert Filters */}
        <div className="filter-bar">
          <div className="filter-item">
            <label>Severity</label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {SEVERITIES.map((sev) => {
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
                    style={{ opacity: active ? 1 : 0.4, cursor: 'pointer' }}
                  >
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="filter-item">
            <label>Module</label>
            <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
              {modulesList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Asset</label>
            <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
              {assetsList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              {statusesList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedAlert ? (
          <div>
            <div className={`alert-card ${selectedAlert.severity.toLowerCase()}`}>
              <div className="alert-heading">
                <span className={`pill ${selectedAlert.severity.toLowerCase()}`}>
                  {selectedAlert.severity}
                </span>
                <strong>{selectedAlert.asset}</strong>
                <span>Status: {selectedAlert.status}</span>
              </div>
              <div className="alert-description">{selectedAlert.description}</div>
              <div className="detail-grid">
                <div>
                  <label>Probable Cause</label>
                  <div>{selectedAlert.probable_cause}</div>
                </div>
                <div>
                  <label>Recommended Action</label>
                  <div>{selectedAlert.recommended_action}</div>
                </div>
                <div>
                  <label>Owner</label>
                  <div>{selectedAlert.owner || 'Unassigned'}</div>
                </div>
              </div>
            </div>

            {/* Operator Actions */}
            <div
              style={{
                display: 'flex',
                gap: '0.65rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() =>
                  handleUpdateAlert(selectedAlert.alert_id, { status: 'Acknowledged' })
                }
              >
                Acknowledge
              </button>

              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <select
                  value={chosenOwner || selectedAlert.owner || 'Unassigned'}
                  onChange={(e) => setChosenOwner(e.target.value)}
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
                  onClick={() => handleUpdateAlert(selectedAlert.alert_id, { owner: chosenOwner })}
                >
                  Assign
                </button>
              </div>

              <button
                className="btn btn-danger"
                onClick={() => handleUpdateAlert(selectedAlert.alert_id, { severity: 'Critical' })}
              >
                Escalate
              </button>

              <button
                className="btn"
                onClick={() =>
                  handleUpdateAlert(selectedAlert.alert_id, { status: 'Under Review' })
                }
              >
                Under Review
              </button>

              <button
                className="btn btn-success"
                onClick={() => handleUpdateAlert(selectedAlert.alert_id, { status: 'Closed' })}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1rem', color: 'var(--muted)' }}>
            No alerts match the selected filters.
          </div>
        )}

        {/* Alerts Table */}
        <div className="data-table-wrapper" style={{ maxHeight: '250px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Severity</th>
                <th>Asset</th>
                <th>Module</th>
                <th>Description</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((a) => (
                <tr
                  key={a.alert_id}
                  onClick={() => {
                    setSelectedAlertId(a.alert_id);
                    setChosenOwner(a.owner || 'Unassigned');
                  }}
                  className={selectedAlert?.alert_id === a.alert_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{a.alert_id}</td>
                  <td>
                    <span className={`pill ${a.severity.toLowerCase()}`}>{a.severity}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{a.asset}</td>
                  <td>{a.module}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.description}
                  </td>
                  <td>{a.owner}</td>
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

      {/* Equipment Health & Voyage Performance */}
      <div className="grid-2">
        <HealthDonutChart counts={healthCounts} total={equipment.length} height={340} />
        <BarChart
          title="Voyage Fuel Performance (Planned vs Actual Tonnes)"
          data={voyageFuelData}
          valueLabel="Planned"
          secondaryLabel="Actual"
          height={340}
        />
      </div>

      {/* Summaries: Maintenance & Safety */}
      <div className="grid-2">
        <div className="card-panel">
          <h3>Maintenance Overview</h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Due in 7 days</span>
              <strong>{maintSummary['Due in 7 days']}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Overdue</span>
              <strong style={{ color: 'var(--red)' }}>{maintSummary['Overdue']}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Work orders open</span>
              <strong>{maintSummary['Work orders open']}</strong>
            </div>
          </div>

          <div className="data-table-wrapper" style={{ maxHeight: '200px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Terminal</th>
                  <th>Due (days)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment
                  .slice()
                  .sort((a, b) => a.maintenance_due_days - b.maintenance_due_days)
                  .slice(0, 5)
                  .map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{e.asset_name}</td>
                      <td>{e.terminal}</td>
                      <td style={{ color: e.maintenance_due_days < 0 ? 'var(--red)' : 'inherit' }}>
                        {e.maintenance_due_days}
                      </td>
                      <td>
                        <span
                          className={`pill ${e.maintenance_status === 'Complete' ? 'low' : 'medium'}`}
                        >
                          {e.maintenance_status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-panel">
          <h3>Safety Overview</h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Open observations</span>
              <strong>{safety.filter((s) => s.status !== 'Closed').length}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>High risk</span>
              <strong style={{ color: 'var(--orange)' }}>
                {safety.filter((s) => s.risk_level === 'High' && s.status !== 'Closed').length}
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: '#091424',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Closed this period</span>
              <strong style={{ color: 'var(--green)' }}>
                {safety.filter((s) => s.status === 'Closed').length}
              </strong>
            </div>
          </div>

          <div className="data-table-wrapper" style={{ maxHeight: '200px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Observation</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {safety.slice(0, 5).map((s, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={`pill ${(s.risk_level || s.severity || 'low').toLowerCase()}`}
                      >
                        {s.risk_level || s.severity}
                      </span>
                    </td>
                    <td>{s.event_type}</td>
                    <td>{s.location}</td>
                    <td>
                      <span className={`pill ${s.status === 'Closed' ? 'low' : 'info'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
