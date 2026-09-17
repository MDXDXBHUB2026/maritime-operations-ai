import React, { useEffect, useState } from 'react';
import { ActionHistoryEntry, VoyagePlan } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { scenario, voyageKpis } from '../../utils/voyageCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { BarChart } from '../../components/charts/BarChart';
import { Check, AlertTriangle } from 'lucide-react';

export const VoyageOptimisationPage: React.FC = () => {
  const [voyages, setVoyages] = useState<VoyagePlan[]>([]);
  const [history, setHistory] = useState<ActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedVessel, setSelectedVessel] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedDeparture, setSelectedDeparture] = useState<string>('All');
  const [selectedDestination, setSelectedDestination] = useState<string>('All');
  const [selectedWeather, setSelectedWeather] = useState<string>('All');
  const [selectedDelay, setSelectedDelay] = useState<string>('All');

  const [selectedVoyageId, setSelectedVoyageId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Interactive Simulator Sliders
  const [speed, setSpeed] = useState<number>(13.5);
  const [bunker, setBunker] = useState<number>(650);
  const [weather, setWeather] = useState<number>(1.0);
  const [berthDelay, setBerthDelay] = useState<number>(4.0);
  const [loadFactor, setLoadFactor] = useState<number>(1.0);
  const [efficiency, setEfficiency] = useState<number>(1.0);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await DataService.getVoyagePlans();
        const overrides = StorageService.getVoyageOverrides();
        const merged = data.map((v) => {
          const ov = overrides[v.voyage_id];
          return ov ? { ...v, ...ov } : v;
        });

        setVoyages(merged);
        setHistory(StorageService.getVoyageHistory());

        if (merged.length > 0) {
          const first = merged[0];
          setSelectedVoyageId(first.voyage_id);
          setSpeed(first.recommended_speed_knots);
          setBunker(first.bunker_price_usd_tonne);
          setWeather(first.wind_factor);
          setBerthDelay(first.estimated_waiting_hours);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load voyage optimization data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelectVoyage = (voyage: VoyagePlan) => {
    setSelectedVoyageId(voyage.voyage_id);
    setSpeed(voyage.recommended_speed_knots);
    setBunker(voyage.bunker_price_usd_tonne);
    setWeather(voyage.wind_factor);
    setBerthDelay(voyage.estimated_waiting_hours);
    setLoadFactor(1.0);
    setEfficiency(1.0);
  };

  const handleAction = (actionName: string, newStatus: string, saveScenarioData = false) => {
    if (!selectedVoyageId) return;
    const current = voyages.find((v) => v.voyage_id === selectedVoyageId);
    if (!current) return;

    const previousStatus = current.optimisation_status;

    let scenarioSnapshot = null;
    if (saveScenarioData) {
      scenarioSnapshot = scenario(
        current,
        speed,
        bunker,
        weather,
        berthDelay,
        loadFactor,
        efficiency
      );
      StorageService.saveVoyageScenario(selectedVoyageId, scenarioSnapshot);
    }

    setVoyages((prev) =>
      prev.map((v) =>
        v.voyage_id === selectedVoyageId ? { ...v, optimisation_status: newStatus } : v
      )
    );
    StorageService.saveVoyageOverride(selectedVoyageId, newStatus);

    const historyEntry: ActionHistoryEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      voyage: selectedVoyageId,
      action: actionName,
      previous_status: previousStatus,
      new_status: newStatus,
      comment: comment.trim() || '—',
    };

    StorageService.addVoyageHistory(historyEntry);
    setHistory((prev) => [historyEntry, ...prev]);

    setFlashMessage(`${selectedVoyageId}: ${actionName} completed`);
    setComment('');
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }}>
        Loading Voyage & Fuel Optimisation...
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

  const kpis = voyageKpis(voyages);

  // Apply filters
  const filteredVoyages = voyages.filter((v) => {
    if (selectedVessel !== 'All' && v.vessel_name !== selectedVessel) return false;
    if (selectedStatus !== 'All' && v.optimisation_status !== selectedStatus) return false;
    if (selectedDeparture !== 'All' && v.departure_port !== selectedDeparture) return false;
    if (selectedDestination !== 'All' && v.destination_port !== selectedDestination) return false;
    if (selectedWeather !== 'All' && v.weather_risk !== selectedWeather) return false;
    if (selectedDelay !== 'All') {
      const isDelayed = new Date(v.predicted_eta) > new Date(v.planned_eta);
      if (selectedDelay === 'Delayed' && !isDelayed) return false;
      if (selectedDelay === 'On schedule' && isDelayed) return false;
    }
    return true;
  });

  const selectedPlan =
    filteredVoyages.find((v) => v.voyage_id === selectedVoyageId) ||
    filteredVoyages[0] ||
    voyages[0];

  const vesselsList = ['All', ...Array.from(new Set(voyages.map((v) => v.vessel_name))).sort()];
  const statusesList = [
    'All',
    ...Array.from(new Set(voyages.map((v) => v.optimisation_status))).sort(),
  ];
  const departuresList = [
    'All',
    ...Array.from(new Set(voyages.map((v) => v.departure_port))).sort(),
  ];
  const destinationsList = [
    'All',
    ...Array.from(new Set(voyages.map((v) => v.destination_port))).sort(),
  ];

  // Scenario Simulator calculations
  const currentScenario = selectedPlan
    ? scenario(
        selectedPlan,
        selectedPlan.current_speed_knots,
        selectedPlan.bunker_price_usd_tonne,
        selectedPlan.wind_factor,
        selectedPlan.estimated_waiting_hours,
        1.0,
        1.0
      )
    : null;

  const aiScenario = selectedPlan
    ? scenario(
        selectedPlan,
        selectedPlan.recommended_speed_knots,
        selectedPlan.bunker_price_usd_tonne,
        selectedPlan.wind_factor,
        selectedPlan.estimated_waiting_hours,
        1.0,
        0.95
      )
    : null;

  const adjustedScenario = selectedPlan
    ? scenario(selectedPlan, speed, bunker, weather, berthDelay, loadFactor, efficiency)
    : null;

  // Chart data
  const fuelData = filteredVoyages.map((v) => ({
    label: v.voyage_id,
    value: v.planned_fuel_tonnes,
    secondaryValue: v.predicted_fuel_tonnes,
  }));

  const etaVarianceData = filteredVoyages.map((v) => {
    const planned = new Date(v.planned_eta).getTime();
    const predicted = new Date(v.predicted_eta).getTime();
    const varianceH = Math.round((predicted - planned) / (3600 * 1000));
    return {
      label: v.voyage_id,
      value: varianceH,
      color: varianceH > 0 ? '#ef5b69' : '#28c499',
    };
  });

  const waitingData = filteredVoyages.map((v) => ({
    label: v.voyage_id,
    value: v.estimated_waiting_hours,
    color: '#f6b84b',
  }));

  return (
    <div>
      <div className="eyebrow">VOYAGE INTELLIGENCE</div>
      <h1>Voyage &amp; Fuel Optimisation</h1>
      <p className="subtitle">Compare plans and explore transparent synthetic scenarios</p>

      <div className="disclaimer-banner">
        Outputs are illustrative and are not approved navigational, engineering or commercial
        recommendations. They use synthetic routes and simplified calculations only.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid-6">
        <MetricCard label="Active voyages" value={kpis['Active voyages']} icon="⚓" />
        <MetricCard label="Delayed voyages" value={kpis['Delayed voyages']} icon="◷" />
        <MetricCard
          label="Fuel-saving opportunity"
          value={kpis['Fuel-saving opportunity']}
          icon="↘"
        />
        <MetricCard label="Estimated cost saving" value={kpis['Estimated cost saving']} icon="$" />
        <MetricCard
          label="Avoidable waiting time"
          value={kpis['Avoidable waiting time']}
          icon="⏳"
        />
        <MetricCard
          label="Estimated CO₂ reduction"
          value={kpis['Estimated CO₂ reduction']}
          icon="🌱"
        />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Vessel</label>
          <select value={selectedVessel} onChange={(e) => setSelectedVessel(e.target.value)}>
            {vesselsList.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Voyage Status</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            {statusesList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Departure Port</label>
          <select value={selectedDeparture} onChange={(e) => setSelectedDeparture(e.target.value)}>
            {departuresList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Destination Port</label>
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
          >
            {destinationsList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Weather Risk</label>
          <select value={selectedWeather} onChange={(e) => setSelectedWeather(e.target.value)}>
            <option value="All">All Weather</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Delay Status</label>
          <select value={selectedDelay} onChange={(e) => setSelectedDelay(e.target.value)}>
            <option value="All">All Delays</option>
            <option value="Delayed">Delayed</option>
            <option value="On schedule">On Schedule</option>
          </select>
        </div>
      </div>

      {/* Voyage Comparison Table */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Voyage Comparison</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredVoyages.length} of {voyages.length} voyages
          </span>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: '280px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Voyage ID</th>
                <th>Vessel</th>
                <th>Departure</th>
                <th>Destination</th>
                <th>Planned Fuel (t)</th>
                <th>Predicted Fuel (t)</th>
                <th>Waiting (h)</th>
                <th>Weather Risk</th>
                <th>Optimisation Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredVoyages.map((v) => (
                <tr
                  key={v.voyage_id}
                  onClick={() => handleSelectVoyage(v)}
                  className={selectedPlan?.voyage_id === v.voyage_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{v.voyage_id}</td>
                  <td style={{ fontWeight: 600 }}>{v.vessel_name}</td>
                  <td>{v.departure_port}</td>
                  <td>{v.destination_port}</td>
                  <td>{v.planned_fuel_tonnes}</td>
                  <td
                    style={{
                      color:
                        v.predicted_fuel_tonnes < v.planned_fuel_tonnes ? '#28c499' : 'inherit',
                    }}
                  >
                    {v.predicted_fuel_tonnes}
                  </td>
                  <td>{v.estimated_waiting_hours}</td>
                  <td>
                    <span className={`pill ${v.weather_risk.toLowerCase()}`}>{v.weather_risk}</span>
                  </td>
                  <td>
                    <span className="pill info">{v.optimisation_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 Charts */}
      <div className="grid-3">
        <BarChart
          title="Planned vs Predicted Fuel (t)"
          data={fuelData}
          valueLabel="Planned"
          secondaryLabel="Predicted"
          height={260}
        />
        <BarChart title="ETA Variance (h)" data={etaVarianceData} height={260} />
        <BarChart title="Estimated Waiting Time (h)" data={waitingData} height={260} />
      </div>

      {/* Selected Voyage Recommendation Card & Interactive Scenario Simulator */}
      {selectedPlan && currentScenario && aiScenario && adjustedScenario && (
        <div className="card-panel">
          <h3>
            Voyage Recommendation: {selectedPlan.vessel_name} ({selectedPlan.departure_port} &rarr;{' '}
            {selectedPlan.destination_port})
          </h3>

          <div className="alert-card" style={{ borderLeftColor: '#25c2d8' }}>
            <div className="alert-heading">
              <strong>
                {selectedPlan.vessel_name} &mdash; {selectedPlan.voyage_id}
              </strong>
              <span className="pill info">{selectedPlan.optimisation_status}</span>
            </div>
            <div className="detail-grid">
              <div>
                <label>Recommended Speed</label>
                <div>{selectedPlan.recommended_speed_knots} kn</div>
              </div>
              <div>
                <label>Weather / Sea State</label>
                <div>
                  {selectedPlan.weather_risk} &middot; {selectedPlan.sea_state}
                </div>
              </div>
              <div>
                <label>Planned / Predicted Fuel</label>
                <div>
                  {selectedPlan.planned_fuel_tonnes} / {selectedPlan.predicted_fuel_tonnes} t
                </div>
              </div>
              <div>
                <label>Waiting Exposure</label>
                <div>{selectedPlan.estimated_waiting_hours} h</div>
              </div>
            </div>
          </div>

          {/* Interactive Scenario Simulator */}
          <h3 style={{ marginTop: '1.25rem' }}>Interactive Scenario Simulator</h3>
          <div className="filter-bar" style={{ background: '#091424', padding: '1rem' }}>
            <div className="filter-item">
              <label>
                Proposed Speed: <strong>{speed.toFixed(1)} kn</strong>
              </label>
              <input
                type="range"
                min="8.0"
                max="22.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
            </div>

            <div className="filter-item">
              <label>
                Bunker Price: <strong>${bunker.toFixed(0)}/t</strong>
              </label>
              <input
                type="range"
                min="300"
                max="1200"
                step="10"
                value={bunker}
                onChange={(e) => setBunker(parseFloat(e.target.value))}
              />
            </div>

            <div className="filter-item">
              <label>
                Weather Severity: <strong>{weather.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={weather}
                onChange={(e) => setWeather(parseFloat(e.target.value))}
              />
            </div>

            <div className="filter-item">
              <label>
                Berth Delay: <strong>{berthDelay.toFixed(1)} h</strong>
              </label>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={berthDelay}
                onChange={(e) => setBerthDelay(parseFloat(e.target.value))}
              />
            </div>

            <div className="filter-item">
              <label>
                Load Factor: <strong>{loadFactor.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={loadFactor}
                onChange={(e) => setLoadFactor(parseFloat(e.target.value))}
              />
            </div>

            <div className="filter-item">
              <label>
                Efficiency: <strong>{efficiency.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.02"
                value={efficiency}
                onChange={(e) => setEfficiency(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Real-time Scenario Comparison Table */}
          <div
            className="data-table-wrapper"
            style={{ marginTop: '1rem', marginBottom: '1.25rem' }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>ETA</th>
                  <th>Fuel (t)</th>
                  <th>Cost ($)</th>
                  <th>Waiting (h)</th>
                  <th>CO₂ (t)</th>
                  <th>Cost Diff ($)</th>
                  <th>CO₂ Diff (t)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Current plan</td>
                  <td>{currentScenario.eta.substring(0, 16).replace('T', ' ')}</td>
                  <td>{currentScenario.fuel.toFixed(1)}</td>
                  <td>${Math.round(currentScenario.cost).toLocaleString()}</td>
                  <td>{currentScenario.waiting.toFixed(1)}</td>
                  <td>{currentScenario.co2.toFixed(1)}</td>
                  <td>$0</td>
                  <td>0.0</td>
                </tr>
                <tr style={{ background: 'rgba(37, 194, 216, 0.08)' }}>
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>AI-style recommendation</td>
                  <td>{aiScenario.eta.substring(0, 16).replace('T', ' ')}</td>
                  <td>{aiScenario.fuel.toFixed(1)}</td>
                  <td>${Math.round(aiScenario.cost).toLocaleString()}</td>
                  <td>{aiScenario.waiting.toFixed(1)}</td>
                  <td>{aiScenario.co2.toFixed(1)}</td>
                  <td
                    style={{
                      color: aiScenario.cost < currentScenario.cost ? '#28c499' : '#ef5b69',
                    }}
                  >
                    ${Math.round(aiScenario.cost - currentScenario.cost).toLocaleString()}
                  </td>
                  <td
                    style={{ color: aiScenario.co2 < currentScenario.co2 ? '#28c499' : '#ef5b69' }}
                  >
                    {(aiScenario.co2 - currentScenario.co2).toFixed(1)}
                  </td>
                </tr>
                <tr style={{ background: 'rgba(40, 196, 153, 0.08)' }}>
                  <td style={{ fontWeight: 600, color: '#28c499' }}>User adjusted</td>
                  <td>{adjustedScenario.eta.substring(0, 16).replace('T', ' ')}</td>
                  <td>{adjustedScenario.fuel.toFixed(1)}</td>
                  <td>${Math.round(adjustedScenario.cost).toLocaleString()}</td>
                  <td>{adjustedScenario.waiting.toFixed(1)}</td>
                  <td>{adjustedScenario.co2.toFixed(1)}</td>
                  <td
                    style={{
                      color: adjustedScenario.cost < currentScenario.cost ? '#28c499' : '#ef5b69',
                      fontWeight: 600,
                    }}
                  >
                    ${Math.round(adjustedScenario.cost - currentScenario.cost).toLocaleString()}
                  </td>
                  <td
                    style={{
                      color: adjustedScenario.co2 < currentScenario.co2 ? '#28c499' : '#ef5b69',
                      fontWeight: 600,
                    }}
                  >
                    {(adjustedScenario.co2 - currentScenario.co2).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Actions Bar */}
          <div
            style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
          >
            <input
              type="text"
              placeholder="Optional decision comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ flex: 1, minWidth: '240px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              onClick={() => handleAction('Accept recommendation', 'Approved')}
            >
              Accept
            </button>
            <button
              className="btn btn-danger"
              onClick={() => handleAction('Reject recommendation', 'Rejected')}
            >
              Reject
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleAction('Request review', 'Under Review')}
            >
              Review
            </button>
            <button
              className="btn"
              onClick={() => handleAction('Save scenario', 'Scenario Saved', true)}
            >
              Save Scenario
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleAction('Mark recommendation implemented', 'Implemented')}
            >
              Implemented
            </button>
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
                <th>Voyage</th>
                <th>Action</th>
                <th>Previous Status</th>
                <th>New Status</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No voyage actions recorded in this session.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td>{h.timestamp}</td>
                    <td>{h.voyage}</td>
                    <td style={{ fontWeight: 600 }}>{h.action}</td>
                    <td>{h.previous_status}</td>
                    <td>
                      <span className="pill info">{h.new_status}</span>
                    </td>
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
