import React from 'react';
import { SensorReading } from '../../types/maritime';

interface SensorTrendChartProps {
  readings: SensorReading[];
  parameterName: string;
  assetName: string;
  height?: number;
}

export const SensorTrendChart: React.FC<SensorTrendChartProps> = ({
  readings,
  parameterName,
  assetName,
  height = 360,
}) => {
  if (!readings || readings.length === 0) {
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
        <span style={{ color: 'var(--muted)' }}>No sensor trend data available.</span>
      </div>
    );
  }

  // Calculate min / max for Y scale
  const allValues = readings.flatMap((r) => [
    r.actual_reading,
    r.expected_baseline,
    r.upper_threshold,
    r.lower_threshold,
  ]);
  const minY = Math.min(...allValues) * 0.95;
  const maxY = Math.max(...allValues) * 1.05;
  const rangeY = maxY - minY || 1;

  const width = 800;
  const chartHeight = height - 80;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const scaleX = (index: number) => padding.left + (index / (readings.length - 1)) * innerWidth;
  const scaleY = (val: number) => padding.top + innerHeight - ((val - minY) / rangeY) * innerHeight;

  // Build SVG path strings
  const actualPoints = readings.map((r, i) => `${scaleX(i)},${scaleY(r.actual_reading)}`).join(' ');
  const baselinePoints = readings
    .map((r, i) => `${scaleX(i)},${scaleY(r.expected_baseline)}`)
    .join(' ');
  const upperPoints = readings.map((r, i) => `${scaleX(i)},${scaleY(r.upper_threshold)}`).join(' ');
  const lowerPoints = readings.map((r, i) => `${scaleX(i)},${scaleY(r.lower_threshold)}`).join(' ');

  const detectionIndex = readings.findIndex((r) => Boolean(r.is_detection_point));
  const detectionPoint = detectionIndex >= 0 ? readings[detectionIndex] : null;

  return (
    <div className="card-panel" style={{ padding: '1rem', height: `${height}px` }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0 }}>
          {assetName} &mdash; <span style={{ color: 'var(--cyan)' }}>{parameterName}</span> (24h)
        </h3>
        <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.72rem' }}>
          <span style={{ color: '#25c2d8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '2px', background: '#25c2d8' }}></span> Actual
          </span>
          <span style={{ color: '#a8b7ca', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #a8b7ca' }}></span>{' '}
            Baseline
          </span>
          <span style={{ color: '#ef5b69', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '2px', borderTop: '2px dotted #ef5b69' }}></span>{' '}
            Upper Threshold
          </span>
          <span style={{ color: '#f6b84b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '2px', borderTop: '2px dotted #f6b84b' }}></span>{' '}
            Lower Threshold
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        style={{ width: '100%', height: 'calc(100% - 30px)' }}
      >
        {/* Y Axis Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const yVal = minY + ratio * rangeY;
          const yPos = scaleY(yVal);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke="#1f324b"
                strokeDasharray="2,2"
              />
              <text x={padding.left - 8} y={yPos + 4} fill="#7f93aa" fontSize="10" textAnchor="end">
                {yVal.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Threshold Lines */}
        <polyline
          points={upperPoints}
          fill="none"
          stroke="#ef5b69"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />
        <polyline
          points={lowerPoints}
          fill="none"
          stroke="#f6b84b"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />

        {/* Baseline */}
        <polyline
          points={baselinePoints}
          fill="none"
          stroke="#a8b7ca"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />

        {/* Actual Trend Line */}
        <polyline points={actualPoints} fill="none" stroke="#25c2d8" strokeWidth="2.5" />

        {/* Detection Point Diamond Marker */}
        {detectionPoint && detectionIndex >= 0 && (
          <g
            transform={`translate(${scaleX(detectionIndex)}, ${scaleY(detectionPoint.actual_reading)})`}
          >
            <polygon points="0,-8 8,0 0,8 -8,0" fill="#ff5364" stroke="#ffffff" strokeWidth="2" />
            <circle r="12" fill="none" stroke="#ff5364" strokeWidth="1.5" opacity="0.6">
              <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* X Axis Time Labels */}
        {[
          0,
          Math.floor(readings.length / 4),
          Math.floor(readings.length / 2),
          Math.floor((3 * readings.length) / 4),
          readings.length - 1,
        ].map((idx) => {
          const r = readings[idx];
          if (!r) return null;
          const timeStr = r.timestamp ? r.timestamp.substring(11, 16) : '';
          return (
            <text
              key={idx}
              x={scaleX(idx)}
              y={chartHeight - 10}
              fill="#7f93aa"
              fontSize="10"
              textAnchor="middle"
            >
              {timeStr}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
