export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AnomalyStatus =
  | 'New'
  | 'Acknowledged'
  | 'Monitoring'
  | 'Inspection Initiated'
  | 'Work Order Created'
  | 'Closed'
  | 'Under Review';
export type MaintenanceStatus =
  | 'Healthy'
  | 'Scheduled'
  | 'Assigned'
  | 'Inspection Scheduled'
  | 'Work Order Created'
  | 'On Hold'
  | 'In Progress'
  | 'Completed'
  | 'Deferred';
export type VoyageStatus =
  'Underway' | 'Delayed' | 'On schedule' | 'In Port' | 'At Berth' | 'At Anchorage';
export type OperationalStatus =
  | 'Underway'
  | 'In Port'
  | 'At Anchorage'
  | 'Delayed'
  | 'Under Maintenance'
  | 'Off-Hire'
  | 'At berth';
export type AutomationStatus =
  | 'Awaiting Approval'
  | 'Under Review'
  | 'Approved'
  | 'Executed'
  | 'On Hold'
  | 'Closed'
  | 'Rejected';

export interface Vessel {
  _row_id?: number;
  vessel_id: string;
  vessel_name: string;
  vessel_type: string;
  imo_identifier: string;
  operational_status: OperationalStatus;
  current_location: string;
  departure_port: string;
  destination_port: string;
  destination?: string;
  latitude: number;
  longitude: number;
  speed_knots: number;
  draft_metres: number;
  engine_load_percentage: number;
  fuel_consumption_tonnes_day: number;
  fuel_performance_status: string;
  technical_health_score: number;
  open_anomalies: number;
  overdue_work_orders: number;
  safety_risk_level: Severity;
  risk_level?: Severity;
  planned_eta: string;
  predicted_eta: string;
  voyage_status: string;
}

export interface Voyage {
  _row_id?: number;
  voyage_id: string;
  vessel_name: string;
  planned_fuel_tonnes: number;
  actual_fuel_tonnes: number;
  planned_eta: string;
  predicted_eta: string;
  potential_fuel_saving_pct: number;
}

export interface VoyagePlan {
  _row_id?: number;
  voyage_id: string;
  vessel_id: string;
  vessel_name: string;
  departure_port: string;
  destination_port: string;
  departure_time: string;
  planned_eta: string;
  predicted_eta: string;
  route_distance_nm: number;
  remaining_distance_nm: number;
  planned_speed_knots: number;
  current_speed_knots: number;
  recommended_speed_knots: number;
  planned_fuel_tonnes: number;
  predicted_fuel_tonnes: number;
  bunker_price_usd_tonne: number;
  weather_risk: string;
  sea_state: string;
  wind_factor: number;
  berth_availability_time: string;
  estimated_waiting_hours: number;
  estimated_co2_tonnes: number;
  optimisation_status: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
}

export interface Equipment {
  _row_id?: number;
  asset_name: string;
  terminal: string;
  health_score: number;
  predicted_failure_days: number;
  maintenance_due_days: number;
  maintenance_status: string;
}

export interface Alert {
  _row_id?: number;
  alert_id: string;
  severity: Severity;
  module: string;
  asset: string;
  description: string;
  probable_cause: string;
  recommended_action: string;
  owner: string;
  status: string;
  created_at: string;
}

export interface Anomaly {
  _row_id?: number;
  anomaly_id: string;
  detected_timestamp: string;
  asset_category: string;
  asset_id: string;
  asset_name: string;
  location: string;
  vessel_or_terminal: string;
  parameter_name: string;
  current_value: number;
  expected_value: number;
  lower_threshold: number;
  upper_threshold: number;
  deviation_percentage: number;
  severity: Severity;
  anomaly_type: string;
  probable_cause: string;
  confidence_score: number;
  recommended_action: string;
  potential_consequence: string;
  owner: string;
  status: AnomalyStatus;
  work_order_reference?: string | null;
}

export interface SensorReading {
  _row_id?: number;
  anomaly_id: string;
  timestamp: string;
  parameter_name: string;
  actual_reading: number;
  expected_baseline: number;
  lower_threshold: number;
  upper_threshold: number;
  is_detection_point: boolean | number;
}

export interface MaintenanceAsset {
  _row_id?: number;
  asset_id: string;
  asset_name: string;
  asset_category: string;
  vessel_or_terminal: string;
  location: string;
  manufacturer: string;
  running_hours: number;
  last_maintenance_date: string;
  next_planned_maintenance_date: string;
  health_score: number;
  failure_probability_percentage: number;
  remaining_useful_life_hours: number;
  criticality: Severity;
  predicted_failure_mode: string;
  recommended_action: string;
  spare_part_required: string;
  spare_part_availability: string;
  estimated_downtime_hours: number;
  estimated_failure_cost_usd: number;
  maintenance_status: MaintenanceStatus;
  owner: string;
  work_order_reference?: string | null;
}

export interface MaintenanceHistory {
  _row_id?: number;
  asset_id: string;
  maintenance_date: string;
  maintenance_type: string;
  finding: string;
  downtime_hours: number;
}

export interface WorkOrder {
  _row_id?: number;
  work_order_reference: string;
  asset_id: string;
  created_date: string;
  status: string;
  owner: string;
}

export interface SafetyEvent {
  _row_id?: number;
  event_id: string;
  timestamp: string;
  event_type: string;
  detection_source: string;
  vessel_or_terminal: string;
  location: string;
  severity: Severity;
  description: string;
  persons_exposed: number;
  immediate_action: string;
  recommended_corrective_action: string;
  responsible_owner: string;
  due_date: string;
  status: string;
  overdue_flag: boolean | number;
  risk_score: number;
  evidence_reference: string;
  event_date?: string;
  owner?: string;
  risk_level?: string;
}

export interface AutomationTask {
  _row_id?: number;
  task_id: string;
  created_timestamp: string;
  workflow_name: string;
  module_source: string;
  vessel_or_terminal: string;
  asset_or_reference: string;
  task_description: string;
  AI_recommendation: string;
  confidence_score: number;
  risk_level: string;
  human_approval_required: boolean | number;
  assigned_owner: string;
  due_date: string;
  status: AutomationStatus;
  automation_level: string;
  estimated_time_saved_minutes: number;
  estimated_value_usd: number;
  final_decision?: string | null;
  decision_comment?: string | null;
}

export interface ActionHistoryEntry {
  timestamp: string;
  id?: string;
  vessel?: string;
  asset?: string;
  anomaly_id?: string;
  voyage?: string;
  event?: string;
  task?: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  owner?: string;
  comment?: string;
}
