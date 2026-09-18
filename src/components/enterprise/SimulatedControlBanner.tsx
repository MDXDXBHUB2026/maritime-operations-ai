import React from 'react';
import { Info } from 'lucide-react';

interface SimulatedControlBannerProps {
  compact?: boolean;
}

export const SimulatedControlBanner: React.FC<SimulatedControlBannerProps> = ({ compact = false }) => {
  return (
    <div
      className="simulated-control-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: compact ? '0.3rem 0.6rem' : '0.5rem 0.85rem',
        background: 'rgba(34, 53, 79, 0.45)',
        border: '1px solid rgba(44, 66, 99, 0.6)',
        borderRadius: '6px',
        color: 'var(--muted)',
        fontSize: compact ? '0.72rem' : '0.78rem',
        lineHeight: 1.4,
      }}
    >
      <Info size={compact ? 13 : 15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
      <span>
        <strong style={{ color: '#d0e0f5' }}>Simulated prototype control</strong> &mdash; no external system action executed.
      </span>
    </div>
  );
};
