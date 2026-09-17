import React, { useState } from 'react';
import { Vessel } from '../../types/maritime';

interface InteractiveMapProps {
  vessels: Vessel[];
  onSelectVessel?: (vesselId: string) => void;
  selectedVesselId?: string;
  height?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  vessels,
  onSelectVessel,
  selectedVesselId,
  height = 380,
}) => {
  const [hoveredVessel, setHoveredVessel] = useState<Vessel | null>(null);

  // Approximate Mercator / Equirectangular projection for world maritime view
  // Map longitude (-180 to 180) to X (0 to 1000)
  // Map latitude (-60 to 75) to Y (500 to 0)
  const projectX = (lon: number) => ((lon + 180) / 360) * 1000;
  const projectY = (lat: number) => ((75 - lat) / 135) * 500;

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'Critical':
        return '#ef5b69';
      case 'High':
        return '#f08b50';
      case 'Medium':
        return '#f6b84b';
      case 'Low':
      default:
        return '#28c499';
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        background: '#0a1422',
        borderRadius: '10px',
        border: '1px solid #1c2e46',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 1000 500"
        style={{ width: '100%', height: '100%', display: 'block' }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Lat/Lon Grid lines */}
        <g stroke="#14243a" strokeWidth="1" strokeDasharray="3,3">
          <line x1="0" y1="125" x2="1000" y2="125" />
          <line x1="0" y1="250" x2="1000" y2="250" />
          <line x1="0" y1="375" x2="1000" y2="375" />
          <line x1="250" y1="0" x2="250" y2="500" />
          <line x1="500" y1="0" x2="500" y2="500" />
          <line x1="750" y1="0" x2="750" y2="500" />
        </g>

        {/* Major world shipping routes representation */}
        <g stroke="#182d49" strokeWidth="1.5" fill="none" opacity="0.6">
          <path d="M 540 280 Q 640 290 780 270 T 900 240" /> {/* Malacca - East Asia */}
          <path d="M 520 220 Q 420 230 350 210 T 260 200" /> {/* Suez - Med */}
          <path d="M 260 200 Q 180 180 120 210" /> {/* Transatlantic */}
        </g>

        {/* Vessel markers */}
        {vessels.map((v) => {
          const cx = projectX(v.longitude);
          const cy = projectY(v.latitude);
          const isSelected = selectedVesselId === v.vessel_id;
          const color = getRiskColor(v.risk_level || v.safety_risk_level);

          return (
            <g
              key={v.vessel_id}
              onClick={() => onSelectVessel && onSelectVessel(v.vessel_id)}
              onMouseEnter={() => setHoveredVessel(v)}
              onMouseLeave={() => setHoveredVessel(null)}
              style={{ cursor: 'pointer' }}
            >
              {isSelected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={16}
                  fill="none"
                  stroke="#25c2d8"
                  strokeWidth="2"
                  opacity="0.8"
                >
                  <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.3;0.9"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              {/* Outer glow ring */}
              <circle cx={cx} cy={cy} r={isSelected ? 9 : 7} fill={color} opacity="0.3" />
              {/* Core dot */}
              <circle
                cx={cx}
                cy={cy}
                r={isSelected ? 5.5 : 4.5}
                fill={color}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {/* Label */}
              <text
                x={cx + 8}
                y={cy + 3}
                fill="#d8e6f5"
                fontSize="9.5"
                fontWeight={isSelected ? '700' : '500'}
                fontFamily="var(--font-sans)"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
              >
                {v.vessel_name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredVessel && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(13, 25, 41, 0.95)',
            border: '1px solid #29415b',
            borderRadius: '6px',
            padding: '0.6rem 0.85rem',
            fontSize: '0.78rem',
            color: '#e6eef8',
            pointerEvents: 'none',
            boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            maxWidth: '280px',
          }}
        >
          <div style={{ fontWeight: 700, color: '#25c2d8', marginBottom: '0.2rem' }}>
            {hoveredVessel.vessel_name} ({hoveredVessel.vessel_type})
          </div>
          <div>
            Status: <strong>{hoveredVessel.operational_status}</strong>
          </div>
          <div>
            Location: {hoveredVessel.current_location} &rarr;{' '}
            {hoveredVessel.destination || hoveredVessel.destination_port}
          </div>
          <div>
            Health: <strong>{hoveredVessel.technical_health_score}/100</strong> · Risk:{' '}
            <strong>{hoveredVessel.safety_risk_level || hoveredVessel.risk_level}</strong>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          background: 'rgba(9, 20, 36, 0.85)',
          padding: '0.4rem 0.65rem',
          borderRadius: '6px',
          border: '1px solid #1c2e46',
          fontSize: '0.7rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#8aa0b8', fontWeight: 600 }}>RISK:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#28c499' }}>
          ● Low
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f6b84b' }}>
          ● Medium
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef5b69' }}>
          ● Critical
        </span>
      </div>
    </div>
  );
};
