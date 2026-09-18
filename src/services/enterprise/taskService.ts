import { Task, TaskPriority, TaskRisk, TaskStatus } from '../../domain/enterprise';
import { AuditService } from './auditService';
import { EnterpriseStorage } from './enterpriseStorage';
import { EventService } from './eventService';

export interface TaskFilter {
  departmentId?: string;
  status?: TaskStatus;
  risk?: TaskRisk;
  priority?: TaskPriority;
  assignedTo?: string;
  searchQuery?: string;
}

export interface ITaskService {
  getTasks(filter?: TaskFilter): Task[];
  getTask(id: string): Task | undefined;
  reassignTask(taskId: string, newAgentId: string, actorName?: string): Task | undefined;
  changePriority(taskId: string, newPriority: TaskPriority): Task | undefined;
  requestRetry(taskId: string): Task | undefined;
  cancelTask(taskId: string, reason?: string): Task | undefined;
  requestVerification(taskId: string): Task | undefined;
  escalateTask(taskId: string, reason?: string): Task | undefined;
}

export const TaskService: ITaskService = {
  getTasks: (filter) => {
    let list = EnterpriseStorage.getTasks();
    if (!filter) return list;

    if (filter.departmentId) {
      list = list.filter((t) => t.departmentId === filter.departmentId);
    }
    if (filter.status) {
      list = list.filter((t) => t.status === filter.status);
    }
    if (filter.risk) {
      list = list.filter((t) => t.risk === filter.risk);
    }
    if (filter.priority) {
      list = list.filter((t) => t.priority === filter.priority);
    }
    if (filter.assignedTo) {
      list = list.filter((t) => t.assignedTo === filter.assignedTo);
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  },

  getTask: (id) => EnterpriseStorage.getTasks().find((t) => t.taskId === id),

  reassignTask: (taskId, newAgentId, actorName = 'Human Management') => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    const oldAgent = task.assignedTo;
    task.assignedTo = newAgentId;
    EnterpriseStorage.setTasks([...tasks]);

    EventService.publish({
      eventType: 'TASK_ASSIGNED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName,
      departmentId: task.departmentId,
      taskId,
      severity: 'INFO',
      summary: `Task ${task.taskId} reassigned from ${oldAgent} to ${newAgentId}.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName,
      action: 'REASSIGN_TASK',
      targetType: 'TASK',
      targetId: taskId,
      targetName: task.title,
      beforeState: `Assigned: ${oldAgent}`,
      afterState: `Assigned: ${newAgentId}`,
      result: 'SUCCESS',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return task;
  },

  changePriority: (taskId, newPriority) => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    const oldPriority = task.priority;
    task.priority = newPriority;
    EnterpriseStorage.setTasks([...tasks]);

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'CHANGE_PRIORITY',
      targetType: 'TASK',
      targetId: taskId,
      targetName: task.title,
      beforeState: oldPriority,
      afterState: newPriority,
      result: 'SUCCESS',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return task;
  },

  requestRetry: (taskId) => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    if (task.retryCount >= task.maxRetries) {
      task.status = 'BLOCKED';
      EnterpriseStorage.setTasks([...tasks]);
      EventService.publish({
        eventType: 'POLICY_BLOCKED',
        actorId: 'POL-ENGINE',
        actorName: 'Policy Engine',
        departmentId: task.departmentId,
        taskId,
        severity: 'HIGH',
        summary: `POL-MAX-RETRY: Task ${task.taskId} exceeded max retries (${task.retryCount}/${task.maxRetries}). Blocked.`,
      });
      return task;
    }

    task.retryCount += 1;
    task.status = 'RUNNING';
    EnterpriseStorage.setTasks([...tasks]);

    EventService.publish({
      eventType: 'TASK_STARTED',
      actorId: task.assignedTo,
      actorName: 'Assigned Agent',
      departmentId: task.departmentId,
      taskId,
      severity: 'INFO',
      summary: `Task ${task.taskId} retry #${task.retryCount} initiated.`,
    });

    return task;
  },

  cancelTask: (taskId, reason = 'Cancelled by operator') => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    const oldStatus = task.status;
    task.status = 'CANCELLED';
    EnterpriseStorage.setTasks([...tasks]);

    EventService.publish({
      eventType: 'HUMAN_OVERRIDE',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      departmentId: task.departmentId,
      taskId,
      severity: 'MEDIUM',
      summary: `Task ${task.taskId} was cancelled. Reason: ${reason}.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'CANCEL_TASK',
      targetType: 'TASK',
      targetId: taskId,
      targetName: task.title,
      beforeState: oldStatus,
      afterState: 'CANCELLED',
      result: 'SUCCESS',
      reason,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return task;
  },

  requestVerification: (taskId) => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    task.status = 'VERIFYING';
    task.verificationState = 'REQUESTED';
    EnterpriseStorage.setTasks([...tasks]);

    EventService.publish({
      eventType: 'VERIFICATION_REQUESTED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      departmentId: task.departmentId,
      taskId,
      severity: 'MEDIUM',
      summary: `Independent verification requested for ${task.title}. Assigned to Independent Verification Agent.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'REQUEST_INDEPENDENT_VERIFICATION',
      targetType: 'TASK',
      targetId: taskId,
      targetName: task.title,
      beforeState: 'RUNNING / WAITING',
      afterState: 'VERIFYING',
      result: 'SUCCESS',
      reason: 'Mandatory independent validation before high-impact execution.',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return task;
  },

  escalateTask: (taskId, reason = 'Operator escalation to Director') => {
    const tasks = EnterpriseStorage.getTasks();
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return undefined;

    task.status = 'ESCALATED';
    EnterpriseStorage.setTasks([...tasks]);

    EventService.publish({
      eventType: 'TASK_ESCALATED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      departmentId: task.departmentId,
      taskId,
      severity: 'HIGH',
      summary: `Task ${task.taskId} escalated to executive/director level. Reason: ${reason}.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'ESCALATE_TASK',
      targetType: 'TASK',
      targetId: taskId,
      targetName: task.title,
      beforeState: 'ACTIVE',
      afterState: 'ESCALATED',
      result: 'SUCCESS',
      reason,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return task;
  },
};
