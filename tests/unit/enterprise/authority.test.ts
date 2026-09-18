import { describe, it, expect } from 'vitest';
import {
  AgentService,
  OrganizationService,
} from '../../../src/services/enterprise';

describe('Enterprise Authority and Permission Rules', () => {
  it('identifies CEO and Directors as Human, and Worker Agents as AI', () => {
    const ceo = OrganizationService.getActor('ACT-CEO');
    expect(ceo).toBeDefined();
    expect(ceo?.entityType).toBe('HUMAN');
    expect(ceo?.authorityLevel).toBe('EXECUTIVE');

    const opsDirector = OrganizationService.getActor('ACT-DIR-OPS');
    expect(opsDirector).toBeDefined();
    expect(opsDirector?.entityType).toBe('HUMAN');
    expect(opsDirector?.authorityLevel).toBe('DIRECTOR');

    const techManager = OrganizationService.getActor('ACT-MGR-TEC');
    expect(techManager).toBeDefined();
    expect(techManager?.entityType).toBe('HUMAN');
    expect(techManager?.authorityLevel).toBe('MANAGER');

    const advisor = OrganizationService.getActor('ACT-AI-ADV');
    expect(advisor).toBeDefined();
    expect(advisor?.entityType).toBe('AI_ADVISOR');
    expect(advisor?.authorityLevel).toBe('LEAD');

    const maintAgent = AgentService.getAgent('AGT-TEC-001');
    expect(maintAgent).toBeDefined();
    expect(maintAgent?.entityType).toBe('AI_AGENT');
    expect(maintAgent?.authorityLevel).toBe('AGENT');
  });

  it('verifies executive authority permissions exceed agent permissions', () => {
    const ceo = OrganizationService.getActor('ACT-CEO');
    const techManager = OrganizationService.getActor('ACT-MGR-TEC');

    expect(ceo?.permissions).toContain('APPROVE_HIGH_RISK');
    expect(ceo?.permissions).toContain('PAUSE_AGENT');
    expect(ceo?.permissions).toContain('OVERRIDE_WORKFLOW');
    expect(ceo?.permissions).toContain('EDIT_POLICY');

    expect(techManager?.permissions).not.toContain('OVERRIDE_WORKFLOW');
    expect(techManager?.permissions).not.toContain('EDIT_POLICY');
  });

  it('validates department reporting lines correctly', () => {
    const depts = OrganizationService.getDepartments();
    expect(depts.length).toBeGreaterThanOrEqual(6);

    const fleetDept = OrganizationService.getDepartment('DEPT-FLEET-OPS');
    expect(fleetDept).toBeDefined();
    expect(fleetDept?.directorId).toBe('ACT-DIR-OPS');

    const techDept = OrganizationService.getDepartment('DEPT-TECHNICAL');
    expect(techDept).toBeDefined();
    expect(techDept?.directorId).toBe('ACT-DIR-TEC');
  });
});
