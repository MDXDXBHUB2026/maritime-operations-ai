import React, { useEffect, useState } from 'react';
import {
  ActionHistoryEntry,
  MaintenanceAsset,
  MaintenanceHistory,
  WorkOrder,
} from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { healthClass, maintenanceKpis } from '../../utils/maintenanceCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { BarChart } from '../../components/charts/BarChart';
import { Check, AlertTriangle } from 'lucide-react';

const OWNERS = [
  'Unassigned',
  'Fleet Technical Manager',
  'Chief Engineer',
  'Terminal Maintenance Lead',
  'Reefer Operations Supervisor',
  'Digital Operations Analyst',
];

export const PredictiveMaintenancePage: React.FC = () => {
  const [assets, setAssets] = useState<MaintenanceAsset[]>([]);
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSite, setSelectedSite] = useState<string>('All');
  const [selectedHealth, setSelectedHealth] = useState<string>('All');
  const [selectedCriticality, setSelectedCriticality] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedSpare, setSelectedSpare] = useState<string>('All');

  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [assignedOwner, setAssignedOwner] = useState<string>('Unassigned');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [aData, hData, woData] = await Promise.all([
          DataService.getMaintenanceAssets(),
          DataService.getMaintenanceHistory(),
          DataService.getWorkOrders(),
        ]);

        const overrides = StorageService.getMaintenanceOverrides();
        const mergedAssets: MaintenanceAsset[] = aData.map((a) => {
          const ov = overrides[a.asset_id];
          return ov ? ({ ...a, ...ov } as MaintenanceAsset) : a;
        });

        const sessionWos = StorageService.getSessionWorkOrders();

        setAssets(mergedAssets);
        setHistory(hData);
        setWorkOrders([...woData, ...sessionWos]);
        setActionHistory(StorageService.getMaintenanceHistory());

        if (mergedAssets.length > 0) {
          setSelectedAssetId(mergedAssets[0].asset_id);
          setAssignedOwner(mergedAssets[0].owner || 'Unassigned');
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load predictive maintenance data.'
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAction = (
    actionName: string,
    newStatus: string,
    extras: { owner?: string; workOrder?: boolean; spare?: boolean } = {}
  ) => {
    if (!selectedAssetId) return;
    const current = assets.find((a) => a.asset_id === selectedAssetId);
    if (!current) return;

    const previousStatus = current.maintenance_status;
    let finalOwner = current.owner;
    let finalSpare = current.spare_part_availability;
    let workOrderRef = current.work_order_reference;

    if (extras.owner !== undefined) finalOwner = extras.owner;
    if (extras.spare) finalSpare = 'Requested';
    if (extras.workOrder) {
      workOrderRef = StorageService.getNextWorkOrderReference();
      const newWo: WorkOrder = {
        work_order_reference: workOrderRef,
        asset_id: selectedAssetId,
        created_date: new Date().toISOString(),
        status: 'Open',
        owner: finalOwner,
      };
      StorageService.addSessionWorkOrder(newWo);
      setWorkOrders((prev) => [...prev, newWo]);
    }

    const updates: Partial<MaintenanceAsset> = {
      maintenance_status: newStatus as MaintenanceAsset['maintenance_status'],
      owner: finalOwner,
      spare_part_availability: finalSpare,
      work_order_reference: workOrderRef || null,
    };

    setAssets((prev) =>
      prev.map((a) => (a.asset_id === selectedAssetId ? { ...a, ...updates } : a))
    );
    StorageService.saveMaintenanceOverride(selectedAssetId, updates);

    const historyEntry: ActionHistoryEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      asset: selectedAssetId,
      action: actionName,
      previous_status: previousStatus,
      new_status: newStatus,
      owner: finalOwner,
      comment: comment.trim() || '—',
    };

    StorageService.addMaintenanceHistory(historyEntry);
    setActionHistory((prev) => [historyEntry, ...prev]);

    setFlashMessage(`${selectedAssetId}: ${actionName} completed`);
    setComment('');
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }}>
        Loading Predictive Maintenance...
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

  const kpis = maintenanceKpis(assets);

  // Apply filters
  const filteredAssets = assets.filter((a) => {
    if (selectedCategory !== 'All' && a.asset_category !== selectedCategory) return false;
    if (selectedSite !== 'All' && a.vessel_or_terminal !== selectedSite) return false;
    if (selectedHealth !== 'All' && healthClass(a.health_score) !== selectedHealth) return false;
    if (selectedCriticality !== 'All' && a.criticality !== selectedCriticality) return false;
    if (selectedStatus !== 'All' && a.maintenance_status !== selectedStatus) return false;
    if (selectedSpare !== 'All' && a.spare_part_availability !== selectedSpare) return false;
    return true;
  });

  const selectedAsset =
    filteredAssets.find((a) => a.asset_id === selectedAssetId) || filteredAssets[0] || assets[0];

  const categoriesList = [
    'All',
    ...Array.from(new Set(assets.map((a) => a.asset_category))).sort(),
  ];
  const sitesList = ['All', ...Array.from(new Set(assets.map((a) => a.vessel_or_terminal))).sort()];
  const statusesList = [
    'All',
    ...Array.from(new Set(assets.map((a) => a.maintenance_status))).sort(),
  ];
  const sparesList = [
    'All',
    ...Array.from(new Set(assets.map((a) => a.spare_part_availability))).sort(),
  ];

  // Chart data: Failure probability top 10
  const failureProbData = filteredAssets
    .slice()
    .sort((a, b) => b.failure_probability_percentage - a.failure_probability_percentage)
    .slice(0, 10)
    .map((a) => ({
      label: a.asset_name.replace('Main Engine ', 'ME ').replace('Quay Crane ', 'QC '),
      value: a.failure_probability_percentage,
      color: a.failure_probability_percentage > 70 ? '#ef5b69' : '#f6b84b',
    }));

  // Remaining useful life bottom 10
  const rulData = filteredAssets
    .slice()
    .sort((a, b) => a.remaining_useful_life_hours - b.remaining_useful_life_hours)
    .slice(0, 10)
    .map((a) => ({
      label: a.asset_name.replace('Main Engine ', 'ME ').replace('Quay Crane ', 'QC '),
      value: a.remaining_useful_life_hours,
      color: a.remaining_useful_life_hours < 720 ? '#ef5b69' : '#28c499',
    }));

  // Cost exposure by category
  const costByCategory: Record<string, number> = {};
  filteredAssets.forEach((a) => {
    costByCategory[a.asset_category] =
      (costByCategory[a.asset_category] || 0) + a.estimated_failure_cost_usd;
  });
  const costData = Object.entries(costByCategory).map(([cat, cost]) => ({
    label: cat,
    value: Math.round(cost / 1000), // in $k
    color: '#4472e8',
  }));

  const assetHistory = selectedAsset
    ? history.filter((h) => h.asset_id === selectedAsset.asset_id)
    : [];

  return (
    <div>
      <div className="eyebrow">PREDICTIVE MAINTENANCE</div>
      <h1>Predictive Maintenance</h1>
      <p className="subtitle">Rule-based visibility across vessel and terminal assets</p>

      <div className="disclaimer-banner">
        This conceptual module uses synthetic data and prototype thresholds: health below 60 is
        Critical, 60–79 Warning, 80–100 Healthy; failure probability above 70% and RUL below 100
        hours are illustrative only.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid-6">
        <MetricCard label="Assets monitored" value={kpis['Assets monitored']} icon="⚙" />
        <MetricCard label="Critical assets" value={kpis['Critical assets']} icon="!" />
        <MetricCard label="Failures within 30d" value={kpis['Failures within 30d']} icon="◷" />
        <MetricCard label="Overdue maintenance" value={kpis['Overdue maintenance']} icon="◆" />
        <MetricCard label="Awaiting spare parts" value={kpis['Awaiting spare parts']} icon="📦" />
        <MetricCard label="Failure exposure" value={kpis['Failure exposure']} icon="$" />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Category</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            {categoriesList.map((c) => (
              <option key={c} value={c}>
                {c}
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
          <label>Health Class</label>
          <select value={selectedHealth} onChange={(e) => setSelectedHealth(e.target.value)}>
            <option value="All">All Health</option>
            <option value="Healthy">Healthy (80-100)</option>
            <option value="Warning">Warning (60-79)</option>
            <option value="Critical">Critical (&lt;60)</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Criticality</label>
          <select
            value={selectedCriticality}
            onChange={(e) => setSelectedCriticality(e.target.value)}
          >
            <option value="All">All Criticality</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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
          <label>Spare Availability</label>
          <select value={selectedSpare} onChange={(e) => setSelectedSpare(e.target.value)}>
            {sparesList.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Asset Health Register */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Asset Health Register</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredAssets.length} of {assets.length} assets
          </span>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: '280px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Asset Name</th>
                <th>Category</th>
                <th>Vessel / Terminal</th>
                <th>Health</th>
                <th>Failure Prob</th>
                <th>RUL (h)</th>
                <th>Criticality</th>
                <th>Maintenance Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((a) => (
                <tr
                  key={a.asset_id}
                  onClick={() => {
                    setSelectedAssetId(a.asset_id);
                    setAssignedOwner(a.owner || 'Unassigned');
                  }}
                  className={selectedAsset?.asset_id === a.asset_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{a.asset_id}</td>
                  <td style={{ fontWeight: 600 }}>{a.asset_name}</td>
                  <td>{a.asset_category}</td>
                  <td>{a.vessel_or_terminal}</td>
                  <td>{a.health_score}/100</td>
                  <td>{a.failure_probability_percentage}%</td>
                  <td>{a.remaining_useful_life_hours.toLocaleString()}</td>
                  <td>
                    <span className={`pill ${a.criticality.toLowerCase()}`}>{a.criticality}</span>
                  </td>
                  <td>
                    <span
                      className={`pill ${a.maintenance_status === 'Completed' ? 'low' : 'medium'}`}
                    >
                      {a.maintenance_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 Analytics Charts */}
      <div className="grid-3">
        <BarChart title="Failure Probability (%)" data={failureProbData} height={260} />
        <BarChart title="Remaining Useful Life (h)" data={rulData} height={260} />
        <BarChart title="Failure Cost Exposure ($k)" data={costData} height={260} />
      </div>

      {/* Selected Asset Detail */}
      {selectedAsset && (
        <div className="card-panel">
          <h3>Asset Detail: {selectedAsset.asset_name}</h3>
          <div className="alert-card" style={{ borderLeftColor: '#28c499' }}>
            <div className="alert-heading">
              <strong>{selectedAsset.asset_name}</strong>
              <span className="pill info">{selectedAsset.maintenance_status}</span>
            </div>
            <div className="detail-grid">
              <div>
                <label>Location</label>
                <div>
                  {selectedAsset.vessel_or_terminal} &middot; {selectedAsset.location}
                </div>
              </div>
              <div>
                <label>Running Hours</label>
                <div>{selectedAsset.running_hours.toLocaleString()} h</div>
              </div>
              <div>
                <label>Health / Failure Prob</label>
                <div>
                  {selectedAsset.health_score}/100 &middot;{' '}
                  {selectedAsset.failure_probability_percentage}%
                </div>
              </div>
              <div>
                <label>Remaining Useful Life</label>
                <div>{selectedAsset.remaining_useful_life_hours.toLocaleString()} h</div>
              </div>
              <div>
                <label>Predicted Mode</label>
                <div>{selectedAsset.predicted_failure_mode}</div>
              </div>
              <div>
                <label>Recommended Action</label>
                <div>{selectedAsset.recommended_action}</div>
              </div>
              <div>
                <label>Spare Part</label>
                <div>
                  {selectedAsset.spare_part_required} &middot;{' '}
                  {selectedAsset.spare_part_availability}
                </div>
              </div>
              <div>
                <label>Downtime / Exposure</label>
                <div>
                  {selectedAsset.estimated_downtime_hours} h &middot; $
                  {selectedAsset.estimated_failure_cost_usd.toLocaleString()}
                </div>
              </div>
              <div>
                <label>Work Order</label>
                <div
                  style={{
                    fontWeight: 600,
                    color: selectedAsset.work_order_reference ? '#28c499' : 'var(--muted)',
                  }}
                >
                  {selectedAsset.work_order_reference || 'Not created'}
                </div>
              </div>
              <div>
                <label>Owner</label>
                <div>{selectedAsset.owner || 'Unassigned'}</div>
              </div>
            </div>
          </div>

          {/* Maintenance History */}
          <h4 style={{ fontSize: '0.85rem', color: '#cadbee', marginBottom: '0.5rem' }}>
            Maintenance History
          </h4>
          <div className="data-table-wrapper" style={{ maxHeight: '180px', marginBottom: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Finding</th>
                  <th>Downtime (h)</th>
                </tr>
              </thead>
              <tbody>
                {assetHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No prior maintenance records found for this asset.
                    </td>
                  </tr>
                ) : (
                  assetHistory.map((h, i) => (
                    <tr key={i}>
                      <td>{h.maintenance_date}</td>
                      <td>{h.maintenance_type}</td>
                      <td>{h.finding}</td>
                      <td>{h.downtime_hours}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Actions Bar */}
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="Optional action comment or deferral justification"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
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
                  onClick={() => handleAction('Assign owner', 'Assigned', { owner: assignedOwner })}
                >
                  Assign
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('Schedule inspection', 'Inspection Scheduled')}
              >
                Schedule Inspection
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  handleAction('Create work order', 'Work Order Created', { workOrder: true })
                }
              >
                Create Work Order
              </button>
              <button
                className="btn"
                onClick={() =>
                  handleAction('Mark spare part requested', 'On Hold', { spare: true })
                }
              >
                Request Spare
              </button>
              <button
                className="btn"
                onClick={() => handleAction('Mark maintenance started', 'In Progress')}
              >
                Start
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleAction('Mark maintenance completed', 'Completed')}
              >
                Complete
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleAction('Defer with justification', 'On Hold')}
              >
                Defer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Work Orders & Action History */}
      <div className="grid-2">
        <div className="card-panel">
          <h3>Session Work-Order Register</h3>
          <div className="data-table-wrapper" style={{ maxHeight: '220px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>WO Reference</th>
                  <th>Asset ID</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: '#28c499' }}>{wo.work_order_reference}</td>
                    <td>{wo.asset_id}</td>
                    <td>{wo.created_date.substring(0, 10)}</td>
                    <td>
                      <span className="pill low">{wo.status}</span>
                    </td>
                    <td>{wo.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-panel">
          <h3>Action History</h3>
          <div className="data-table-wrapper" style={{ maxHeight: '220px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Asset</th>
                  <th>Action</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Owner</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {actionHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No maintenance actions recorded in this session.
                    </td>
                  </tr>
                ) : (
                  actionHistory.map((h, i) => (
                    <tr key={i}>
                      <td>{h.timestamp}</td>
                      <td>{h.asset}</td>
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
    </div>
  );
};
