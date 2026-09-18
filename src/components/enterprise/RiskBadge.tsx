import React from 'react';
import { TaskRisk } from '../../domain/enterprise';

interface RiskBadgeProps {
  risk: TaskRisk;
  size?: 'sm' | 'md';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, size = 'md' }) => {
  const isSm = size === 'sm';
  const padding = isSm ? '0.12rem 0.45rem' : '0.2rem 0.6rem';
  const fontSize = isSm ? '0.68rem' : '0.75rem';

  const riskClass =
    risk === 'CRITICAL'
      ? 'pill critical'
      : risk === 'HIGH'
        ? 'pill high'
        : risk === 'MEDIUM'
          ? 'pill medium'
          : 'pill low';

  return (
    <span
      className={riskClass}
      data-risk-level={risk}
      style={{
        padding,
        fontSize,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      ● {risk}
    </span>
  );
};
