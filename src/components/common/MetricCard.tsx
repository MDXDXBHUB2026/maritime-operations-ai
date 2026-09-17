import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: string;
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon = '◉',
  badge = 'LIVE',
}) => {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span>{icon}</span>
        <span>{badge}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
};
