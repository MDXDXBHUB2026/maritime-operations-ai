import React from 'react';
import { AgentStatus, OperationalMode, TaskStatus } from '../../domain/enterprise';

interface StatusBadgeProps {
  status: AgentStatus | TaskStatus | OperationalMode | string;
  type?: 'agent' | 'task' | 'mode';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'agent' }) => {
  let color = '#28c499';
  let bg = 'rgba(40, 196, 153, 0.15)';
  let border = 'rgba(40, 196, 153, 0.35)';
  let label = status.replace(/_/g, ' ');

  if (status === 'PAUSED' || status === 'LIMITED') {
    color = '#f6b84b';
    bg = 'rgba(246, 184, 75, 0.15)';
    border = 'rgba(246, 184, 75, 0.35)';
  } else if (
    status === 'WAITING_APPROVAL' ||
    status === 'WAITING' ||
    status === 'DEGRADED' ||
    status === 'VERIFYING'
  ) {
    color = '#f08b50';
    bg = 'rgba(240, 139, 80, 0.15)';
    border = 'rgba(240, 139, 80, 0.35)';
  } else if (status === 'BLOCKED' || status === 'FAILED' || status === 'ERROR' || status === 'UNAVAILABLE') {
    color = '#ef5b69';
    bg = 'rgba(239, 91, 105, 0.15)';
    border = 'rgba(239, 91, 105, 0.35)';
  } else if (status === 'RUNNING' || status === 'ACTIVE') {
    color = '#25c2d8';
    bg = 'rgba(37, 194, 216, 0.15)';
    border = 'rgba(37, 194, 216, 0.35)';
  } else if (status === 'ESCALATED') {
    color = '#c084fc';
    bg = 'rgba(192, 132, 252, 0.15)';
    border = 'rgba(192, 132, 252, 0.35)';
  }

  if (type === 'mode') {
    label = `MODE: ${label}`;
  }

  return (
    <span
      className={`status-badge ${type}-${status.toLowerCase()}`}
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: bg,
        color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.65rem' }}>●</span>
      <span>{label}</span>
    </span>
  );
};
