import React from 'react';

interface HealthDonutChartProps {
  counts: { Healthy: number; Warning: number; Critical: number };
  total: number;
  height?: number;
}

export const HealthDonutChart: React.FC<HealthDonutChartProps> = ({
  counts,
  total,
  height = 300,
}) => {
  const safeTotal = total || 1;
  const hPct = counts.Healthy / safeTotal;
  const wPct = counts.Warning / safeTotal;
  const cPct = counts.Critical / safeTotal;

  // Circumference = 2 * PI * r (r = 54 => ~339.29)
  const r = 54;
  const c = 2 * Math.PI * r;

  const hDash = hPct * c;
  const wDash = wPct * c;
  const cDash = cPct * c;

  const hOffset = 0;
  const wOffset = -hDash;
  const cOffset = -(hDash + wDash);

  return (
    <div
      className="card-panel"
      style={{
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h3 style={{ alignSelf: 'flex-start', margin: 0, marginBottom: '0.75rem' }}>
        Equipment Health
      </h3>

      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <svg
          viewBox="0 0 140 140"
          style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}
        >
          {/* Background circle */}
          <circle cx="70" cy="70" r={r} fill="none" stroke="#14243a" strokeWidth="16" />

          {/* Healthy segment */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#28c499"
            strokeWidth="16"
            strokeDasharray={`${hDash} ${c}`}
            strokeDashoffset={hOffset}
          />
          {/* Warning segment */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#f6b84b"
            strokeWidth="16"
            strokeDasharray={`${wDash} ${c}`}
            strokeDashoffset={wOffset}
          />
          {/* Critical segment */}
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#ef5b69"
            strokeWidth="16"
            strokeDasharray={`${cDash} ${c}`}
            strokeDashoffset={cOffset}
          />
        </svg>

        {/* Center count label */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#ffffff' }}>{total}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em' }}>
            ASSETS
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c499' }}
          ></span>
          <span>Healthy ({counts.Healthy})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f6b84b' }}
          ></span>
          <span>Warning ({counts.Warning})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef5b69' }}
          ></span>
          <span>Critical ({counts.Critical})</span>
        </div>
      </div>
      <div style={{ fontSize: '0.68rem', color: '#68809a', marginTop: '0.5rem' }}>
        Healthy 80–100 · Warning 60–79 · Critical &lt;60
      </div>
    </div>
  );
};
