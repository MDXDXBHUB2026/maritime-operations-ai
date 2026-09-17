import React, { useEffect, useState } from 'react';
import { Vessel, OperationalStatus } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { fleetKpis, healthBand } from '../../utils/fleetCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { InteractiveMap } from '../../components/charts/InteractiveMap';
import { BarChart } from '../../components/charts/BarChart';
import { Check, AlertTriangle } from 'lucide-react';

const STATUSES = [
  'Underway',
  'In Port',
  'At Anchorage',
  'Delayed',
  'Under Maintenance',
  'Off-Hire',
];
const RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low'];

export const FleetOverviewPage: React.FC = () => {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedOps, setSelectedOps] = useState<string[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedVoyageStatuses, setSelectedVoyageStatuses] = useState<string[]>([]);

  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<OperationalStatus>('Underway');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await DataService.getVessels();
        const overrides = StorageService.getVesselOverrides();
        const merged: Vessel[] = data.map((v) => {
          const ov = overrides[v.vessel_id];
          return ov ? ({ ...v, ...ov } as Vessel) : v;
        });
        setVessels(merged);
        if (merged.length > 0) {
          setSelectedVesselId(merged[0].vessel_id);
          setTargetStatus(merged[0].operational_status);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load fleet data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleApplyStatus = () => {
    if (!selectedVesselId) return;
    setVessels((prev) =>
      prev.map((v) =>
        v.vessel_id === selectedVesselId ? { ...v, operational_status: targetStatus } : v
      )
    );
    StorageService.saveVesselOverride(selectedVesselId, targetStatus);
    setFlashMessage(`${selectedVesselId} operational status updated to ${targetStatus}`);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading Fleet Overview...</div>;
  }

  if (error) {
    return (
      <div className="banner-error">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const kpis = fleetKpis(vessels);

  // Apply filters
  const filteredVessels = vessels.filter((v) => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(v.vessel_type)) return false;
    if (selectedOps.length > 0 && !selectedOps.includes(v.operational_status)) return false;
    if (selectedRisks.length > 0 && !selectedRisks.includes(v.safety_risk_level)) return false;
    if (selectedLocations.length > 0 && !selectedLocations.includes(v.current_location))
      return false;
    if (selectedVoyageStatuses.length > 0 && !selectedVoyageStatuses.includes(v.voyage_status))
      return false;
    return true;
  });

  const selectedVessel =
    filteredVessels.find((v) => v.vessel_id === selectedVesselId) ||
    filteredVessels[0] ||
    vessels[0];

  const typesList = Array.from(new Set(vessels.map((v) => v.vessel_type))).sort();
  const opsList = Array.from(new Set(vessels.map((v) => v.operational_status))).sort();
  const locsList = Array.from(new Set(vessels.map((v) => v.current_location))).sort();
  const voyStatusList = Array.from(new Set(vessels.map((v) => v.voyage_status))).sort();

  // 4 breakdown charts data
  const healthGroups = { Healthy: 0, Warning: 0, Critical: 0 };
  filteredVessels.forEach((v) => {
    healthGroups[healthBand(v.technical_health_score)]++;
  });
  const healthData = [
    { label: 'Healthy', value: healthGroups.Healthy, color: '#28c499' },
    { label: 'Warning', value: healthGroups.Warning, color: '#f6b84b' },
    { label: 'Critical', value: healthGroups.Critical, color: '#ef5b69' },
  ];

  const delayData = filteredVessels.map((v) => {
    const planned = new Date(v.planned_eta).getTime();
    const predicted = new Date(v.predicted_eta).getTime();
    const delayHours = Math.max(Math.round((predicted - planned) / (3600 * 1000)), 0);
    return {
      label: v.vessel_name.replace('Pacific ', 'P. ').replace('Atlantic ', 'A. '),
      value: delayHours,
      color: delayHours > 12 ? '#ef5b69' : delayHours > 0 ? '#f6b84b' : '#28c499',
    };
  });

  const fuelData = filteredVessels.map((v) => ({
    label: v.vessel_name.replace('Pacific ', 'P. ').replace('Atlantic ', 'A. '),
    value: v.fuel_consumption_tonnes_day,
    color: v.fuel_performance_status === 'Optimal' ? '#28c499' : '#f6b84b',
  }));

  const exposureData = filteredVessels.map((v) => ({
    label: v.vessel_name.replace('Pacific ', 'P. ').replace('Atlantic ', 'A. '),
    value: v.open_anomalies + v.overdue_work_orders,
    color: '#f08b50',
  }));

  return (
    <div>
      <div className="eyebrow">FLEET OPERATIONS</div>
      <h1>Fleet Overview</h1>
      <p className="subtitle">Operational and technical visibility across the synthetic fleet</p>

      <div className="disclaimer-banner">
        This conceptual fleet prototype uses synthetic data and illustrative indicators. It is not
        based on production systems or approved operating limits.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* Fleet KPIs */}
      <div className="grid-6">
        <MetricCard label="Total vessels" value={kpis['Total vessels']} icon="⚓" />
        <MetricCard label="Vessels underway" value={kpis['Vessels underway']} icon="↗" />
        <MetricCard label="Vessels in port" value={kpis['Vessels in port']} icon="⚓" />
        <MetricCard label="Delayed vessels" value={kpis['Delayed vessels']} icon="◷" />
        <MetricCard label="Critical risk" value={kpis['Critical risk']} icon="!" />
        <MetricCard label="Average fleet health" value={kpis['Average fleet health']} icon="♥" />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Vessel Type</label>
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
          <label>Operational Status</label>
          <select
            value={selectedOps[0] || 'All'}
            onChange={(e) => setSelectedOps(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Statuses</option>
            {opsList.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Risk Level</label>
          <select
            value={selectedRisks[0] || 'All'}
            onChange={(e) => setSelectedRisks(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Risk Levels</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Current Location</label>
          <select
            value={selectedLocations[0] || 'All'}
            onChange={(e) => setSelectedLocations(e.target.value === 'All' ? [] : [e.target.value])}
          >
            <option value="All">All Locations</option>
            {locsList.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Voyage Status</label>
          <select
            value={selectedVoyageStatuses[0] || 'All'}
            onChange={(e) =>
              setSelectedVoyageStatuses(e.target.value === 'All' ? [] : [e.target.value])
            }
          >
            <option value="All">All Voyage Statuses</option>
            {voyStatusList.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map and Table */}
      <div className="grid-2">
        <div
          className="card-panel"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}
        >
          <h3>Vessel Locations</h3>
          <InteractiveMap
            vessels={filteredVessels}
            selectedVesselId={selectedVesselId}
            onSelectVessel={(id) => {
              setSelectedVesselId(id);
              const found = vessels.find((v) => v.vessel_id === id);
              if (found) setTargetStatus(found.operational_status);
            }}
            height={380}
          />
        </div>

        <div
          className="card-panel"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}
        >
          <h3>Fleet Status</h3>
          <div className="data-table-wrapper" style={{ maxHeight: '380px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Speed (kn)</th>
                  <th>Health</th>
                  <th>Anomalies</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredVessels.map((v) => (
                  <tr
                    key={v.vessel_id}
                    onClick={() => {
                      setSelectedVesselId(v.vessel_id);
                      setTargetStatus(v.operational_status);
                    }}
                    className={selectedVesselId === v.vessel_id ? 'selected' : ''}
                    style={{ cursor: 'pointer' }}
                  >
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
                    <td>{v.speed_knots}</td>
                    <td>{v.technical_health_score}/100</td>
                    <td>{v.open_anomalies}</td>
                    <td>
                      <span className={`pill ${v.safety_risk_level.toLowerCase()}`}>
                        {v.safety_risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4 Fleet Analytics Charts */}
      <div className="grid-4">
        <BarChart title="Vessel Health" data={healthData} height={260} />
        <BarChart title="Voyage Delay (Hours)" data={delayData} height={260} />
        <BarChart title="Fuel Consumption (t/day)" data={fuelData} height={260} />
        <BarChart title="Technical Exposure (Items)" data={exposureData} height={260} />
      </div>

      {/* Vessel Detail & Operational Status Update */}
      {selectedVessel && (
        <div className="card-panel">
          <h3>Vessel Detail: {selectedVessel.vessel_name}</h3>
          <div className="alert-card" style={{ borderLeftColor: '#25c2d8' }}>
            <div className="alert-heading">
              <strong>{selectedVessel.vessel_name}</strong>
              <span className="pill info">{selectedVessel.operational_status}</span>
            </div>
            <div className="detail-grid">
              <div>
                <label>Identity</label>
                <div>
                  {selectedVessel.imo_identifier} &middot; {selectedVessel.vessel_type}
                </div>
              </div>
              <div>
                <label>Current Voyage</label>
                <div>
                  {selectedVessel.departure_port} &rarr; {selectedVessel.destination_port}
                </div>
              </div>
              <div>
                <label>Technical Health</label>
                <div>
                  {selectedVessel.technical_health_score}/100 (
                  {healthBand(selectedVessel.technical_health_score)})
                </div>
              </div>
              <div>
                <label>Active Anomalies</label>
                <div>{selectedVessel.open_anomalies}</div>
              </div>
              <div>
                <label>Maintenance Exposure</label>
                <div>{selectedVessel.overdue_work_orders} overdue work orders</div>
              </div>
              <div>
                <label>Fuel Performance</label>
                <div>
                  {selectedVessel.fuel_performance_status} &middot;{' '}
                  {selectedVessel.fuel_consumption_tonnes_day} t/day
                </div>
              </div>
              <div>
                <label>Safety Risk</label>
                <div>
                  <span className={`pill ${selectedVessel.safety_risk_level.toLowerCase()}`}>
                    {selectedVessel.safety_risk_level}
                  </span>
                </div>
              </div>
              <div>
                <label>Planned / Predicted ETA</label>
                <div>
                  {selectedVessel.planned_eta.substring(0, 16).replace('T', ' ')} /{' '}
                  {selectedVessel.predicted_eta.substring(0, 16).replace('T', ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Update Operational Status Form */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
              Update operational status:
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as OperationalStatus)}
              style={{ minWidth: '160px' }}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleApplyStatus}>
              Apply vessel status
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
