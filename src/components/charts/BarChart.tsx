import React from 'react';

interface BarDataItem {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
  category?: string;
}

interface BarChartProps {
  title: string;
  data: BarDataItem[];
  valueLabel?: string;
  secondaryLabel?: string;
  height?: number;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  valueLabel,
  secondaryLabel,
  height = 280,
  horizontal = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="card-panel"
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          No data available for {title}
        </span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue || 0)), 1);

  return (
    <div
      className="card-panel"
      style={{ height: `${height}px`, display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {(valueLabel || secondaryLabel) && (
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem' }}>
            {valueLabel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4472e8' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    background: '#4472e8',
                    borderRadius: '2px',
                  }}
                ></span>
                {valueLabel}
              </span>
            )}
            {secondaryLabel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#21b6a8' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    background: '#21b6a8',
                    borderRadius: '2px',
                  }}
                ></span>
                {secondaryLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: horizontal ? 'column' : 'row',
          gap: '0.5rem',
          alignItems: horizontal ? 'stretch' : 'flex-end',
          paddingTop: '0.5rem',
          overflowY: 'auto',
        }}
      >
        {data.map((item, idx) => {
          const pct = Math.max((item.value / maxVal) * 100, 2);
          const secPct =
            item.secondaryValue !== undefined
              ? Math.max((item.secondaryValue / maxVal) * 100, 2)
              : null;
          const color = item.color || '#25c2d8';

          if (horizontal) {
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#9bb1c9',
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#122338',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                minWidth: '28px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '3px',
                  alignItems: 'flex-end',
                  height: 'calc(100% - 24px)',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <div
                  title={`${item.label}: ${item.value}`}
                  style={{
                    width: secPct !== null ? '40%' : '65%',
                    height: `${pct}%`,
                    background: item.secondaryValue !== undefined ? '#4472e8' : color,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                {secPct !== null && (
                  <div
                    title={`${item.label} (Actual): ${item.secondaryValue}`}
                    style={{
                      width: '40%',
                      height: `${secPct}%`,
                      background: '#21b6a8',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: '#8da2b9',
                  marginTop: '6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                  textAlign: 'center',
                }}
                title={item.label}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
