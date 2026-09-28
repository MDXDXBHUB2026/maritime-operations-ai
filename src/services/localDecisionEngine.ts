/**
 * Browser-local decision engine for STATIC mode (GitHub Pages demo, no backend).
 *
 * A TypeScript port of the backend's deterministic specialist agents (backend/app/agents) and
 * decision state machine (backend/app/services/decision_service.py). Agents propose; a demo
 * persona reviews, approves or rejects within its role's authority; execution is simulated.
 * Decisions and audit events are stored in this browser only (localStorage). Nothing leaves the
 * browser and no operational system is changed.
 */
import { DataService } from './dataService';
import type {
  AuditEvent,
  Decision,
  DecisionAction,
  DecisionDomain,
  DecisionEvidence,
  DecisionQuery,
  DecisionStatus,
} from './decisionService';
import type { CurrentUser, RoleName } from './authSession';

type Severity = Decision['severity'];
type Rec = Record<string, unknown>;

const RANK: Record<Severity, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const ORDER: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

function sev(value: unknown): Severity {
  if (typeof value === 'string') {
    const hit = ORDER.find((s) => s.toLowerCase() === value.trim().toLowerCase());
    if (hit) return hit;
  }
  return 'Medium'; // unknown labels never silently become Low
}
const maxSev = (...v: Severity[]): Severity => v.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
const escalate = (s: Severity): Severity => ORDER[Math.min(ORDER.indexOf(s) + 1, 3)];
function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
}
const g = (n: number) => String(Number(n.toFixed(6)));
const act = (action: string, rationale: string, safety_critical: boolean): DecisionAction => ({
  action,
  rationale,
  safety_critical,
});

interface Assessment {
  severity: Severity;
  headline: string;
  facts: string[];
  evidence: DecisionEvidence[];
  actions: DecisionAction[];
  confidence: number | null;
  confidenceBasis: string;
}

interface Context {
  id: string;
  record: Rec;
  related: Rec[];
}

const SOURCE: Record<DecisionDomain, string> = {
  anomaly: 'anomalies',
  maintenance: 'maintenance_assets',
  voyage: 'voyage_plans',
  safety: 'safety_events',
};
const ENTITY_TYPE: Record<DecisionDomain, string> = {
  anomaly: 'anomaly',
  maintenance: 'maintenance_asset',
  voyage: 'voyage_plan',
  safety: 'safety_event',
};

function ev(domain: DecisionDomain, c: Context, field: string, note?: string): DecisionEvidence {
  return { source: SOURCE[domain], reference: c.id, field, value: c.record[field], note };
}

function assessAnomaly(c: Context): Assessment {
  const r = c.record;
  const current = num(r.current_value);
  const lower = num(r.lower_threshold);
  const upper = num(r.upper_threshold);
  const breach = current < lower || current > upper;
  const source = sev(r.severity);
  const severity = breach ? maxSev(source, 'High') : source;
  const asset = String(r.asset_name ?? c.id);
  const parameter = String(r.parameter_name ?? 'parameter');
  const flagged = c.related.filter(
    (x) => x.is_detection_point === true || x.is_detection_point === 1
  ).length;
  const closed = String(r.status ?? '').toLowerCase() === 'closed';
  const high = RANK[severity] >= RANK.High;
  const evidence = [
    'current_value',
    'lower_threshold',
    'upper_threshold',
    'deviation_percentage',
  ].map((f) => ev('anomaly', c, f));
  evidence.push(ev('anomaly', c, 'severity', 'severity recorded by source system'));
  evidence.push(ev('anomaly', c, 'probable_cause'));
  if (c.related.length) {
    evidence.push(
      ev(
        'anomaly',
        c,
        'anomaly_id',
        `${c.related.length} related sensor_readings, ${flagged} flagged`
      )
    );
  }
  let actions: DecisionAction[];
  if (closed) {
    actions = [
      act(
        'Verify closure evidence; no further action proposed',
        'Anomaly is already closed in the source register',
        false
      ),
    ];
  } else if (high) {
    actions = [
      act(
        `Raise inspection work-order request for ${asset}`,
        `${severity} anomaly on ${parameter}`,
        true
      ),
      act(
        `Notify ${r.owner || 'responsible engineer'} for immediate review`,
        'High-severity deviations require accountable review',
        false
      ),
    ];
  } else if (severity === 'Medium') {
    actions = [
      act(
        `Increase monitoring of ${parameter} and verify sensor calibration`,
        'Moderate deviation without confirmed breach',
        false
      ),
    ];
  } else {
    actions = [
      act(
        'Continue monitoring and review trend at next watch',
        'Low deviation within tolerance',
        false
      ),
    ];
  }
  if (r.recommended_action && !closed) {
    actions.push(
      act(
        `Source-system recommendation: ${r.recommended_action}`,
        'Carried forward from the detection system',
        high
      )
    );
  }
  const conf = r.confidence_score;
  const hasConf = typeof conf === 'number' && conf >= 0 && conf <= 100;
  return {
    severity,
    headline: `${parameter} anomaly on ${asset} (${r.vessel_or_terminal ?? 'unknown location'})`,
    facts: [
      `${parameter} = ${r.current_value} (expected ${r.expected_value}, band ${r.lower_threshold}-${r.upper_threshold})`,
      `deviation ${r.deviation_percentage}%`,
      breach ? 'value outside threshold band' : 'value inside threshold band',
      `source severity ${source}`,
      `${c.related.length} sensor readings, ${flagged} detection point(s)`,
    ],
    evidence,
    actions,
    confidence: hasConf ? (conf as number) : null,
    confidenceBasis: hasConf ? 'source_detection_confidence' : 'not_computed',
  };
}

function conditionSeverity(health: number, failure: number, rul: number): Severity {
  if (rul <= 250 || failure >= 70 || health < 40) return 'Critical';
  if (rul <= 750 || failure >= 50 || health < 60) return 'High';
  if (rul <= 1500 || failure >= 30 || health < 80) return 'Medium';
  return 'Low';
}

function assessMaintenance(c: Context): Assessment {
  const r = c.record;
  const health = num(r.health_score);
  const failure = num(r.failure_probability_percentage);
  const rul = num(r.remaining_useful_life_hours);
  const condition = conditionSeverity(health, failure, rul);
  const criticality = sev(r.criticality);
  const severity = maxSev(condition, criticality);
  const asset = String(r.asset_name ?? c.id);
  const spare = String(r.spare_part_availability ?? 'Unknown');
  const actions: DecisionAction[] = [];
  if (String(r.maintenance_status ?? '').toLowerCase() === 'completed') {
    actions.push(
      act('Confirm post-maintenance condition readings', 'Maintenance recorded as completed', false)
    );
  } else if (RANK[severity] >= RANK.High) {
    actions.push(
      act(
        `Propose corrective work order for ${asset} (${r.predicted_failure_mode ?? 'predicted failure'})`,
        `${severity} priority from condition and criticality`,
        severity === 'Critical'
      )
    );
  } else if (severity === 'Medium') {
    actions.push(
      act(
        `Schedule condition inspection before ${r.next_planned_maintenance_date ?? 'next planned date'}`,
        'Degrading condition indicators',
        false
      )
    );
  } else {
    actions.push(
      act(
        'Continue planned maintenance schedule',
        'Condition indicators within normal range',
        false
      )
    );
  }
  if (spare.toLowerCase() !== 'available' && RANK[severity] >= RANK.Medium) {
    actions.push(
      act(
        `Request procurement of ${r.spare_part_required ?? 'required spare'} (currently ${spare})`,
        'Spare availability constrains the maintenance window',
        false
      )
    );
  }
  return {
    severity,
    headline: `Maintenance priority for ${asset} (${r.vessel_or_terminal ?? ''})`,
    facts: [
      `health score ${g(health)}`,
      `failure probability ${g(failure)}%`,
      `remaining useful life ${g(rul)} h`,
      `condition severity ${condition}, asset criticality ${criticality}`,
      `spare part '${r.spare_part_required}' is ${spare}`,
      `${c.related.length} historical maintenance record(s)`,
    ],
    evidence: [
      'health_score',
      'failure_probability_percentage',
      'remaining_useful_life_hours',
      'criticality',
      'predicted_failure_mode',
      'spare_part_availability',
      'next_planned_maintenance_date',
    ].map((f) => ev('maintenance', c, f)),
    actions,
    confidence: null,
    confidenceBasis: 'not_computed',
  };
}

function assessVoyage(c: Context): Assessment {
  const r = c.record;
  const planned = Date.parse(String(r.planned_eta));
  const predicted = Date.parse(String(r.predicted_eta));
  const delay =
    Number.isFinite(planned) && Number.isFinite(predicted) ? (predicted - planned) / 3.6e6 : null;
  const waiting = num(r.estimated_waiting_hours);
  const plannedFuel = num(r.planned_fuel_tonnes);
  const predictedFuel = num(r.predicted_fuel_tonnes);
  const overrun = plannedFuel ? ((predictedFuel - plannedFuel) / plannedFuel) * 100 : 0;
  const current = num(r.current_speed_knots);
  const recommended = num(r.recommended_speed_knots);
  const weather = sev(r.weather_risk);
  const d = delay ?? 0;
  let severity: Severity;
  if (weather === 'High' && d >= 24) severity = 'Critical';
  else if (d >= 12 || weather === 'High') severity = 'High';
  else if (d >= 4 || waiting >= 6 || overrun > 5) severity = 'Medium';
  else severity = 'Low';
  const vessel = String(r.vessel_name ?? '');
  const signed = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
  const actions: DecisionAction[] = [];
  if (recommended && Math.abs(current - recommended) >= 0.2) {
    actions.push(
      act(
        `Propose speed adjustment for ${vessel} from ${g(current)} kn to ${g(recommended)} kn`,
        'Planning-system recommended speed; final navigational decision rests with the Master',
        false
      )
    );
  }
  if (waiting > 0) {
    actions.push(
      act(
        'Coordinate berth window with terminal for just-in-time arrival',
        `${g(waiting)} h of berth waiting is forecast`,
        false
      )
    );
  }
  if (weather === 'High') {
    actions.push(
      act(
        "Request Master's weather-routing review before any route or speed change",
        'High weather risk on the planned route',
        true
      )
    );
  }
  if (!actions.length) {
    actions.push(act('Maintain current voyage plan', 'Voyage within plan tolerances', false));
  }
  return {
    severity,
    headline: `Voyage ${c.id} (${vessel}) performance versus plan`,
    facts: [
      `ETA variance ${delay === null ? 'unknown' : `${signed(delay)} h`} versus plan`,
      `estimated berth waiting ${g(waiting)} h`,
      `predicted fuel ${g(predictedFuel)} t vs planned ${g(plannedFuel)} t (${signed(overrun)}%)`,
      `current speed ${g(current)} kn, recommended ${g(recommended)} kn`,
      `weather risk ${r.weather_risk}`,
    ],
    evidence: [
      'planned_eta',
      'predicted_eta',
      'estimated_waiting_hours',
      'planned_fuel_tonnes',
      'predicted_fuel_tonnes',
      'current_speed_knots',
      'recommended_speed_knots',
      'weather_risk',
    ].map((f) => ev('voyage', c, f)),
    actions,
    confidence: null,
    confidenceBasis: 'not_computed',
  };
}

function assessSafety(c: Context): Assessment {
  const r = c.record;
  const source = sev(r.severity);
  const risk = num(r.risk_score);
  const overdue = r.overdue_flag === true || r.overdue_flag === 1;
  const exposed = Math.trunc(num(r.persons_exposed));
  let severity = source;
  if (risk >= 70) severity = maxSev(severity, 'High');
  if (overdue) severity = escalate(severity);
  const owner = String(r.responsible_owner || 'Unassigned');
  const actions: DecisionAction[] = [];
  if (String(r.status ?? '').toLowerCase() === 'closed') {
    actions.push(
      act(
        'Verify close-out evidence and effectiveness of controls',
        'Event recorded as closed',
        true
      )
    );
  } else {
    actions.push(
      act(
        `Verify effectiveness of immediate action: ${r.immediate_action ?? 'not recorded'}`,
        'Confirm hazard is controlled',
        true
      )
    );
    if (r.recommended_corrective_action) {
      actions.push(
        act(
          `Implement corrective action: ${r.recommended_corrective_action}`,
          'Prevent recurrence',
          true
        )
      );
    }
    if (owner.toLowerCase() === 'unassigned') {
      actions.push(act('Assign an accountable responsible owner', 'No owner recorded', true));
    }
    if (RANK[severity] >= RANK.High) {
      actions.push(
        act('Escalate to HSE manager / Designated Person Ashore', `${severity} safety event`, true)
      );
    }
  }
  return {
    severity,
    headline: `Safety event ${c.id}: ${r.event_type}`,
    facts: [
      `${r.event_type} at ${r.vessel_or_terminal} / ${r.location}`,
      `source severity ${source}, risk score ${g(risk)}`,
      `${exposed} person(s) exposed`,
      overdue ? 'corrective action overdue' : 'corrective action not overdue',
      `responsible owner: ${owner}`,
    ],
    evidence: [
      'event_type',
      'severity',
      'risk_score',
      'persons_exposed',
      'overdue_flag',
      'immediate_action',
      'responsible_owner',
      'evidence_reference',
    ].map((f) => ev('safety', c, f)),
    actions,
    confidence: null,
    confidenceBasis: 'not_computed',
  };
}

const ASSESS: Record<DecisionDomain, (c: Context) => Assessment> = {
  anomaly: assessAnomaly,
  maintenance: assessMaintenance,
  voyage: assessVoyage,
  safety: assessSafety,
};

async function loadContext(domain: DecisionDomain, id: string): Promise<Context> {
  const find = (rows: unknown[], key: string) =>
    (rows as Rec[]).find((row) => String(row[key]) === id);
  let record: Rec | undefined;
  let related: Rec[] = [];
  if (domain === 'anomaly') {
    const [rows, readings] = await Promise.all([
      DataService.getAnomalies(),
      DataService.getSensorReadings(),
    ]);
    record = find(rows, 'anomaly_id');
    related = (readings as unknown as Rec[]).filter((x) => String(x.anomaly_id) === id);
  } else if (domain === 'maintenance') {
    const [rows, history] = await Promise.all([
      DataService.getMaintenanceAssets(),
      DataService.getMaintenanceHistory(),
    ]);
    record = find(rows, 'asset_id');
    related = (history as unknown as Rec[]).filter((x) => String(x.asset_id) === id);
  } else if (domain === 'voyage') {
    record = find(await DataService.getVoyagePlans(), 'voyage_id');
  } else {
    record = find(await DataService.getSafetyEvents(), 'event_id');
  }
  if (!record) throw new Error(`${domain} record '${id}' not found`);
  return { id, record, related };
}

// ---- Demo personas (static mode only) ------------------------------------------------------

const ROLE_LABEL: Record<RoleName, string> = {
  viewer: 'Viewer',
  operator: 'Duty Officer',
  chief_engineer: 'Chief Engineer',
  master: 'Master',
  technical_superintendent: 'Technical Superintendent',
  marine_superintendent: 'Marine Superintendent',
  hse_manager: 'HSE Manager',
  admin: 'Administrator',
};

/** Mirrors backend/app/security/permissions.py APPROVER_ROLES. */
export const APPROVER_ROLES: Record<DecisionDomain, RoleName[]> = {
  anomaly: ['chief_engineer', 'technical_superintendent'],
  maintenance: ['chief_engineer', 'technical_superintendent'],
  voyage: ['master', 'marine_superintendent'],
  safety: ['hse_manager', 'master'],
};

const DEMO: { id: string; name: string; role: RoleName }[] = [
  { id: 'demo-operator', name: 'Demo Duty Officer', role: 'operator' },
  { id: 'demo-tech-supt', name: 'Demo Technical Superintendent', role: 'technical_superintendent' },
  { id: 'demo-chief-eng', name: 'Demo Chief Engineer', role: 'chief_engineer' },
  { id: 'demo-marine-supt', name: 'Demo Marine Superintendent', role: 'marine_superintendent' },
  { id: 'demo-master', name: 'Demo Master', role: 'master' },
  { id: 'demo-hse', name: 'Demo HSE Manager', role: 'hse_manager' },
  { id: 'demo-viewer', name: 'Demo Viewer', role: 'viewer' },
];

function personaUser(p: (typeof DEMO)[number]): CurrentUser {
  const operational = p.role !== 'viewer' && p.role !== 'admin';
  const matrix: CurrentUser['approval_matrix'] = {};
  for (const [domain, roles] of Object.entries(APPROVER_ROLES)) {
    matrix[domain] = roles.map((role) => ({ role, label: ROLE_LABEL[role] }));
  }
  return {
    user_id: p.id,
    username: p.id,
    display_name: p.name,
    role: p.role,
    role_label: ROLE_LABEL[p.role],
    permissions: {
      can_generate: operational,
      can_review: operational,
      approve_domains: (Object.keys(APPROVER_ROLES) as DecisionDomain[]).filter((d) =>
        APPROVER_ROLES[d].includes(p.role)
      ),
      can_manage_users: false,
    },
    // Demo personas are fleet-wide so every vessel can be exercised in the browser demo.
    scope: { fleet_wide: true, sites: [] },
    approval_matrix: matrix,
  };
}

export const DEMO_PERSONAS: CurrentUser[] = DEMO.map(personaUser);

const PERSONA_KEY = 'maritime_ai_demo_persona';
const personaListeners = new Set<(u: CurrentUser) => void>();

function readPersonaId(): string {
  try {
    return localStorage.getItem(PERSONA_KEY) ?? 'demo-operator';
  } catch {
    return 'demo-operator';
  }
}
let personaId = readPersonaId();

export const DemoPersona = {
  current: (): CurrentUser =>
    DEMO_PERSONAS.find((p) => p.user_id === personaId) ?? DEMO_PERSONAS[0],
  set: (id: string): void => {
    personaId = id;
    try {
      localStorage.setItem(PERSONA_KEY, id);
    } catch {
      // storage unavailable; persona lives in memory only
    }
    personaListeners.forEach((l) => l(DemoPersona.current()));
  },
  subscribe: (l: (u: CurrentUser) => void): (() => void) => {
    personaListeners.add(l);
    return () => personaListeners.delete(l);
  },
};

// ---- Store & state machine -----------------------------------------------------------------

const STORE_KEY = 'maritime_ai_local_decisions_v1';
interface Store {
  decisions: Decision[];
  audit: AuditEvent[];
}
let memory: Store = { decisions: [], audit: [] };

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) memory = JSON.parse(raw) as Store;
  } catch {
    // corrupted or unavailable storage: keep in-memory copy
  }
  return memory;
}
function save(store: Store): void {
  memory = store;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

const ALLOWED: Record<DecisionStatus, DecisionStatus[]> = {
  PROPOSED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['EXECUTED', 'CANCELLED'],
  REJECTED: [],
  EXECUTED: [],
  CANCELLED: [],
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function audit(
  store: Store,
  actor: CurrentUser,
  action: string,
  d: Decision,
  previous: DecisionStatus | null,
  details: Record<string, unknown> | null,
  humanApproval: Record<string, unknown> | null = null
): void {
  store.audit.push({
    event_id: uuid(),
    timestamp: new Date().toISOString(),
    actor: actor.display_name,
    actor_user_id: actor.user_id,
    actor_role: actor.role,
    action,
    entity_type: d.entity_type,
    entity_id: d.entity_id,
    previous_state: previous,
    new_state: d.status,
    decision_id: d.recommendation_id,
    human_approval: humanApproval,
    details,
  });
}

function requireOperational(actor: CurrentUser): void {
  if (!actor.permissions.can_review) {
    throw new Error(`${actor.role_label} has read-only access to AI recommendations`);
  }
}
function requireDecider(actor: CurrentUser, d: Decision): void {
  if (!APPROVER_ROLES[d.agent].includes(actor.role)) {
    const labels = APPROVER_ROLES[d.agent].map((r) => ROLE_LABEL[r]).join(' or ');
    throw new Error(`Approval of ${d.agent} decisions requires ${labels}`);
  }
}

function transition(
  id: string,
  actor: CurrentUser,
  target: DecisionStatus,
  action: string,
  apply: (d: Decision) => void,
  details: Record<string, unknown> | null,
  humanApproval: Record<string, unknown> | null = null
): Decision {
  const store = load();
  const d = store.decisions.find((x) => x.recommendation_id === id);
  if (!d) throw new Error(`Decision '${id}' not found`);
  const previous = d.status;
  if (!ALLOWED[previous].includes(target)) {
    throw new Error(`Cannot move decision from ${previous} to ${target}`);
  }
  d.status = target;
  d.updated_at = new Date().toISOString();
  apply(d);
  audit(store, actor, action, d, previous, details, humanApproval);
  save(store);
  return { ...d };
}

export const LocalDecisionEngine = {
  async generate(domain: DecisionDomain, entityId: string, actor: CurrentUser): Promise<Decision> {
    if (!actor.permissions.can_generate) {
      throw new Error(`${actor.role_label} cannot request recommendations`);
    }
    const ctx = await loadContext(domain, entityId);
    const a = ASSESS[domain](ctx);
    const facts = a.facts.join('; ') || 'no supporting facts recorded';
    const first = a.actions[0]?.action ?? 'no action proposed';
    const now = new Date().toISOString();
    const site = String(ctx.record.vessel_or_terminal ?? ctx.record.vessel_name ?? '') || null;
    const decision: Decision = {
      recommendation_id: uuid(),
      agent: domain,
      entity_type: ENTITY_TYPE[domain],
      entity_id: entityId,
      status: 'PROPOSED',
      severity: a.severity,
      summary: `[${a.severity}] ${a.headline}`,
      rationale:
        `Rule-based assessment by the ${domain} agent for ${entityId}. Evidence: ${facts}. ` +
        `Proposed first step: ${first}. This is a recommendation only and requires human review ` +
        'before any execution.',
      evidence: a.evidence,
      recommended_actions: a.actions,
      confidence: a.confidence,
      confidence_basis: a.confidenceBasis,
      requires_human_approval: true,
      safety_critical: a.actions.some((x) => x.safety_critical),
      provider: 'deterministic (in-browser)',
      site_id: null,
      site_name: site,
      created_by: actor.display_name,
      created_by_role: actor.role,
      created_by_user_id: actor.user_id,
      created_at: now,
      updated_at: now,
      execution_mode: null,
    };
    const store = load();
    store.decisions.push(decision);
    audit(store, actor, 'RECOMMENDATION_CREATED', decision, null, {
      agent: domain,
      severity: a.severity,
      safety_critical: decision.safety_critical,
      manager: 'routed by Manager Agent',
    });
    save(store);
    return { ...decision };
  },

  async list(query: DecisionQuery = {}): Promise<Decision[]> {
    return load()
      .decisions.filter(
        (d) =>
          (!query.entityId || d.entity_id === query.entityId) &&
          (!query.status || d.status === query.status) &&
          (!query.agent || d.agent === query.agent)
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, query.limit ?? 100)
      .map((d) => ({ ...d }));
  },

  async review(id: string, actor: CurrentUser, comment?: string): Promise<Decision> {
    requireOperational(actor);
    return transition(
      id,
      actor,
      'UNDER_REVIEW',
      'REVIEW_STARTED',
      (d) => {
        d.reviewed_by = actor.display_name;
      },
      comment ? { comment } : null
    );
  },

  async approve(id: string, actor: CurrentUser, comment?: string): Promise<Decision> {
    const d = load().decisions.find((x) => x.recommendation_id === id);
    if (!d) throw new Error(`Decision '${id}' not found`);
    requireDecider(actor, d);
    if (d.safety_critical && d.created_by_user_id === actor.user_id) {
      throw new Error(
        'Four-eyes rule: the requester of a safety-critical recommendation cannot approve it'
      );
    }
    return transition(
      id,
      actor,
      'APPROVED',
      'APPROVED',
      (x) => {
        x.decided_by = actor.display_name;
        x.decided_by_role = actor.role;
        x.decided_at = new Date().toISOString();
        x.decision_comment = comment ?? null;
      },
      comment ? { comment } : null,
      { approved_by: actor.display_name, role: actor.role }
    );
  },

  async reject(id: string, actor: CurrentUser, reason: string): Promise<Decision> {
    const d = load().decisions.find((x) => x.recommendation_id === id);
    if (!d) throw new Error(`Decision '${id}' not found`);
    requireDecider(actor, d);
    if (reason.trim().length < 3) throw new Error('A rejection reason is required');
    return transition(
      id,
      actor,
      'REJECTED',
      'REJECTED',
      (x) => {
        x.decided_by = actor.display_name;
        x.decided_by_role = actor.role;
        x.decided_at = new Date().toISOString();
        x.decision_comment = reason;
      },
      { reason }
    );
  },

  async execute(id: string, actor: CurrentUser): Promise<Decision> {
    const d = load().decisions.find((x) => x.recommendation_id === id);
    if (!d) throw new Error(`Decision '${id}' not found`);
    requireDecider(actor, d);
    if (d.status !== 'APPROVED') {
      throw new Error('Human approval is required before execution');
    }
    return transition(
      id,
      actor,
      'EXECUTED',
      'EXECUTED_SIMULATED',
      (x) => {
        x.execution_mode = 'simulated';
      },
      { execution_mode: 'simulated', note: 'No operational system was changed' }
    );
  },

  async cancel(id: string, actor: CurrentUser, reason: string): Promise<Decision> {
    requireOperational(actor);
    return transition(id, actor, 'CANCELLED', 'CANCELLED', () => undefined, { reason });
  },

  async get(id: string): Promise<Decision> {
    const d = load().decisions.find((x) => x.recommendation_id === id);
    if (!d) throw new Error(`Decision '${id}' not found`);
    return { ...d };
  },

  async auditEvents(decisionId?: string, limit?: number): Promise<AuditEvent[]> {
    const events = load().audit.filter((e) => !decisionId || e.decision_id === decisionId);
    return limit ? events.slice(-limit) : events;
  },

  /** Remove all browser-local decisions and audit events. */
  reset(): void {
    save({ decisions: [], audit: [] });
  },
};
