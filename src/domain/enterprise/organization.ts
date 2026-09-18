export type EntityType = 'HUMAN' | 'AI_AGENT' | 'AI_ADVISOR';

export type AuthorityLevel = 'EXECUTIVE' | 'DIRECTOR' | 'MANAGER' | 'LEAD' | 'AGENT' | 'OBSERVER';

export type Permission =
  | 'VIEW_ENTERPRISE'
  | 'VIEW_DEPARTMENT'
  | 'VIEW_AGENT'
  | 'VIEW_TASK'
  | 'ASSIGN_TASK'
  | 'REASSIGN_TASK'
  | 'APPROVE_LOW_RISK'
  | 'APPROVE_MEDIUM_RISK'
  | 'APPROVE_HIGH_RISK'
  | 'REJECT_ACTION'
  | 'PAUSE_AGENT'
  | 'RESUME_AGENT'
  | 'DISABLE_TOOL'
  | 'ESCALATE_TASK'
  | 'REQUEST_REANALYSIS'
  | 'REQUEST_VERIFICATION'
  | 'CHANGE_PRIORITY'
  | 'OVERRIDE_WORKFLOW'
  | 'VIEW_AUDIT'
  | 'VIEW_ASSURANCE'
  | 'EDIT_POLICY';

export interface Department {
  id: string;
  name: string;
  code: string;
  directorId: string;
  description: string;
  iconName: string;
  sortOrder: number;
}

export interface OrganizationalUnit {
  id: string;
  departmentId: string;
  name: string;
  managerId: string;
  description?: string;
}

export interface Actor {
  id: string;
  name: string;
  displayName: string;
  entityType: EntityType;
  role: string;
  departmentId: string;
  unitId?: string;
  reportsTo?: string | null;
  authorityLevel: AuthorityLevel;
  permissions: Permission[];
  status?: string;
  description: string;
}
