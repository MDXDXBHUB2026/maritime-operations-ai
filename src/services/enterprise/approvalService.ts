import { ApprovalRequest } from '../../domain/enterprise';
import { AuditService } from './auditService';
import { EnterpriseStorage } from './enterpriseStorage';
import { EventService } from './eventService';

export interface IApprovalService {
  getPendingApprovals(departmentId?: string): ApprovalRequest[];
  getResolvedApprovals(limit?: number): ApprovalRequest[];
  getApproval(id: string): ApprovalRequest | undefined;
  approve(
    id: string,
    approverId?: string,
    approverName?: string,
    comment?: string
  ): ApprovalRequest | undefined;
  reject(
    id: string,
    rejectorId?: string,
    rejectorName?: string,
    comment?: string
  ): ApprovalRequest | undefined;
  requestVerification(id: string): ApprovalRequest | undefined;
  escalate(id: string, reason?: string): ApprovalRequest | undefined;
}

export const ApprovalService: IApprovalService = {
  getPendingApprovals: (departmentId) => {
    let list = EnterpriseStorage.getApprovals().filter((a) => a.status === 'PENDING');
    if (departmentId) {
      list = list.filter((a) => a.departmentId === departmentId);
    }
    return list;
  },

  getResolvedApprovals: (limit = 10) => {
    return EnterpriseStorage.getApprovals()
      .filter((a) => a.status !== 'PENDING')
      .slice(0, limit);
  },

  getApproval: (id) => EnterpriseStorage.getApprovals().find((a) => a.id === id),

  approve: (
    id,
    approverId = 'HUMAN_EXECUTIVE',
    approverName = 'Human Management Approver',
    comment = 'Approved following operational risk assessment.'
  ) => {
    const approvals = EnterpriseStorage.getApprovals();
    const target = approvals.find((a) => a.id === id);
    if (!target) return undefined;

    const oldStatus = target.status;
    target.status = 'APPROVED';
    target.decidedBy = approverId;
    target.decidedAt = new Date().toISOString();
    target.decisionComment = comment;
    EnterpriseStorage.setApprovals([...approvals]);

    // Update corresponding task
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === target.taskId);
    if (task) {
      task.approvalState = 'APPROVED';
      if (task.status === 'WAITING_APPROVAL') {
        task.status = 'RUNNING';
        task.resultSummary = `Approval granted by ${approverName}: "${comment}". Execution unlocked.`;
      }
      EnterpriseStorage.setTasks([...tasks]);
    }

    EventService.publish({
      eventType: 'APPROVAL_GRANTED',
      actorId: approverId,
      actorName: approverName,
      departmentId: target.departmentId,
      taskId: target.taskId,
      severity: 'INFO',
      summary: `Approval ${id} GRANTED for ${target.taskTitle}. Policy: ${target.policyId}.`,
      details: { approvalId: id, approverName, comment },
    });

    AuditService.record({
      actorId: approverId,
      actorName: approverName,
      action:
        target.risk === 'HIGH' || target.risk === 'CRITICAL'
          ? 'APPROVE_HIGH_RISK'
          : 'APPROVE_LOW_RISK',
      targetType: 'APPROVAL',
      targetId: id,
      targetName: target.taskTitle,
      policyId: target.policyId,
      beforeState: oldStatus,
      afterState: 'APPROVED',
      result: 'SUCCESS',
      reason: comment,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  reject: (
    id,
    rejectorId = 'HUMAN_EXECUTIVE',
    rejectorName = 'Human Management Approver',
    comment = 'Rejected by operational authority.'
  ) => {
    const approvals = EnterpriseStorage.getApprovals();
    const target = approvals.find((a) => a.id === id);
    if (!target) return undefined;

    const oldStatus = target.status;
    target.status = 'REJECTED';
    target.decidedBy = rejectorId;
    target.decidedAt = new Date().toISOString();
    target.decisionComment = comment;
    EnterpriseStorage.setApprovals([...approvals]);

    // Update corresponding task
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === target.taskId);
    if (task) {
      task.approvalState = 'REJECTED';
      task.status = 'BLOCKED';
      task.resultSummary = `Action rejected by ${rejectorName}: "${comment}". Task blocked.`;
      EnterpriseStorage.setTasks([...tasks]);
    }

    EventService.publish({
      eventType: 'APPROVAL_REJECTED',
      actorId: rejectorId,
      actorName: rejectorName,
      departmentId: target.departmentId,
      taskId: target.taskId,
      severity: 'HIGH',
      summary: `Approval ${id} REJECTED for ${target.taskTitle}. Task blocked by policy.`,
      details: { approvalId: id, rejectorName, comment },
    });

    AuditService.record({
      actorId: rejectorId,
      actorName: rejectorName,
      action: 'REJECT_ACTION',
      targetType: 'APPROVAL',
      targetId: id,
      targetName: target.taskTitle,
      policyId: target.policyId,
      beforeState: oldStatus,
      afterState: 'REJECTED',
      result: 'DENIED',
      reason: comment,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  requestVerification: (id) => {
    const approvals = EnterpriseStorage.getApprovals();
    const target = approvals.find((a) => a.id === id);
    if (!target) return undefined;

    target.status = 'VERIFICATION_REQUESTED';
    target.decidedAt = new Date().toISOString();
    target.decisionComment = 'Routed to Independent Verification Agent for second-opinion review.';
    EnterpriseStorage.setApprovals([...approvals]);

    // Update task
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === target.taskId);
    if (task) {
      task.verificationState = 'REQUESTED';
      task.status = 'VERIFYING';
      EnterpriseStorage.setTasks([...tasks]);
    }

    EventService.publish({
      eventType: 'VERIFICATION_REQUESTED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      departmentId: target.departmentId,
      taskId: target.taskId,
      severity: 'MEDIUM',
      summary: `Verification requested on approval ${id} (${target.taskTitle}).`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'REQUEST_INDEPENDENT_VERIFICATION',
      targetType: 'APPROVAL',
      targetId: id,
      targetName: target.taskTitle,
      policyId: target.policyId,
      beforeState: 'PENDING',
      afterState: 'VERIFICATION_REQUESTED',
      result: 'SUCCESS',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  escalate: (id, reason = 'Escalated by supervisor') => {
    const approvals = EnterpriseStorage.getApprovals();
    const target = approvals.find((a) => a.id === id);
    if (!target) return undefined;

    target.status = 'ESCALATED';
    target.decidedAt = new Date().toISOString();
    target.decisionComment = reason;
    EnterpriseStorage.setApprovals([...approvals]);

    // Update task
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === target.taskId);
    if (task) {
      task.approvalState = 'ESCALATED';
      task.status = 'ESCALATED';
      EnterpriseStorage.setTasks([...tasks]);
    }

    EventService.publish({
      eventType: 'TASK_ESCALATED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      departmentId: target.departmentId,
      taskId: target.taskId,
      severity: 'HIGH',
      summary: `Approval request ${id} escalated to Executive Management. Reason: ${reason}.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'ESCALATE_TASK',
      targetType: 'APPROVAL',
      targetId: id,
      targetName: target.taskTitle,
      policyId: target.policyId,
      beforeState: 'PENDING',
      afterState: 'ESCALATED',
      result: 'SUCCESS',
      reason,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },
};
