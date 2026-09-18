import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Vessel } from '../../types/maritime';
import {
  MARITIME_GEOGRAPHIC_LABELS,
  MAJOR_MARITIME_PORTS,
  MAJOR_SHIPPING_LANES,
  GeoFeatureCollection,
} from './basemapData';
import { REGIONAL_LAND_FALLBACK } from './landFallback';
import styles from './InteractiveMap.module.css';

interface InteractiveMapProps {
  vessels: Vessel[];
  onSelectVessel?: (vesselId: string) => void;
  selectedVesselId?: string;
  height?: number;
}

type ViewPreset = 'fleet' | 'gulf' | 'regional' | 'global';

interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 500;

// In-memory cache so subsequent mounts don't re-fetch
let cachedWorldLand: GeoFeatureCollection | null = null;

// Mercator projection latitude helper
function mercatorY(lat: number): number {
  const clamped = Math.max(-80, Math.min(80, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  vessels,
  onSelectVessel,
  selectedVesselId,
  height = 390,
}) => {
  const [landData, setLandData] = useState<GeoFeatureCollection>(
    () => cachedWorldLand || REGIONAL_LAND_FALLBACK
  );
  const [activePreset, setActivePreset] = useState<ViewPreset>('fleet');
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0);
  const [hoveredVessel, setHoveredVessel] = useState<Vessel | null>(null);

  // Asynchronously load complete world land GeoJSON from local asset
  useEffect(() => {
    if (cachedWorldLand) {
      setLandData(cachedWorldLand);
      return;
    }

    let isMounted = true;
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const assetUrl = `${baseUrl}/data/world_land.json`;

    fetch(assetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GeoFeatureCollection) => {
        cachedWorldLand = data;
        if (isMounted) {
          setLandData(data);
        }
      })
      .catch((err) => {
        // Fallback is already initialized, silently log debug message
        console.debug('Using bundled regional land fallback:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute base geographic bounds based on active preset or filtered vessels
  const baseBounds = useMemo<GeoBounds>(() => {
    if (activePreset === 'gulf') {
      return { minLon: 46.5, maxLon: 60.5, minLat: 22.0, maxLat: 30.5 };
    }
    if (activePreset === 'regional') {
      return { minLon: 35.0, maxLon: 108.0, minLat: -2.0, maxLat: 32.0 };
    }
    if (activePreset === 'global') {
      return { minLon: -160.0, maxLon: 160.0, minLat: -56.0, maxLat: 72.0 };
    }

    // Default 'fleet': auto-fit to currently displayed vessels
    if (!vessels || vessels.length === 0) {
      // Fallback regional view if no vessels
      return { minLon: 35.0, maxLon: 108.0, minLat: -2.0, maxLat: 32.0 };
    }

    const lons = vessels.map((v) => v.longitude).filter((n) => typeof n === 'number' && !isNaN(n));
    const lats = vessels.map((v) => v.latitude).filter((n) => typeof n === 'number' && !isNaN(n));

    if (lons.length === 0 || lats.length === 0) {
      return { minLon: 35.0, maxLon: 108.0, minLat: -2.0, maxLat: 32.0 };
    }

    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);

    // Enforce sensible minimum degree span so single vessel or tight cluster isn't over-zoomed
    const minLonSpan = 9.0;
    const minLatSpan = 5.5;
    if (maxLon - minLon < minLonSpan) {
      const midLon = (minLon + maxLon) / 2;
      minLon = midLon - minLonSpan / 2;
      maxLon = midLon + minLonSpan / 2;
    }
    if (maxLat - minLat < minLatSpan) {
      const midLat = (minLat + maxLat) / 2;
      minLat = midLat - minLatSpan / 2;
      maxLat = midLat + minLatSpan / 2;
    }

    // Add adaptive padding (15% of span)
    const lonPad = Math.max(2.0, (maxLon - minLon) * 0.15);
    const latPad = Math.max(1.5, (maxLat - minLat) * 0.15);

    return {
      minLon: Math.max(-180, minLon - lonPad),
      maxLon: Math.min(180, maxLon + lonPad),
      minLat: Math.max(-75, minLat - latPad),
      maxLat: Math.min(75, maxLat + latPad),
    };
  }, [activePreset, vessels]);

  // Apply zoom multiplier around center of bounds
  const currentBounds = useMemo<GeoBounds>(() => {
    if (zoomMultiplier === 1.0) return baseBounds;

    const centerLon = (baseBounds.minLon + baseBounds.maxLon) / 2;
    const centerLat = (baseBounds.minLat + baseBounds.maxLat) / 2;
    const halfLonSpan = (baseBounds.maxLon - baseBounds.minLon) / 2 / zoomMultiplier;
    const halfLatSpan = (baseBounds.maxLat - baseBounds.minLat) / 2 / zoomMultiplier;

    return {
      minLon: Math.max(-180, centerLon - halfLonSpan),
      maxLon: Math.min(180, centerLon + halfLonSpan),
      minLat: Math.max(-75, centerLat - halfLatSpan),
      maxLat: Math.min(75, centerLat + halfLatSpan),
    };
  }, [baseBounds, zoomMultiplier]);

  // Project geographic coordinate [lon, lat] to SVG coordinates [x, y]
  const project = useCallback(
    (lon: number, lat: number): [number, number] => {
      const xRadMin = (currentBounds.minLon * Math.PI) / 180;
      const xRadMax = (currentBounds.maxLon * Math.PI) / 180;
      const yMercMin = mercatorY(currentBounds.minLat);
      const yMercMax = mercatorY(currentBounds.maxLat);

      const xSpan = xRadMax - xRadMin;
      const ySpan = yMercMax - yMercMin;

      // Equal scale for X and Y maintains true conformal Mercator proportions
      const scale = Math.min(SVG_WIDTH / xSpan, SVG_HEIGHT / ySpan);

      const xCenter = (xRadMin + xRadMax) / 2;
      const yCenter = (yMercMin + yMercMax) / 2;

      const lonRad = (lon * Math.PI) / 180;
      const latMerc = mercatorY(lat);

      const x = SVG_WIDTH / 2 + (lonRad - xCenter) * scale;
      const y = SVG_HEIGHT / 2 - (latMerc - yCenter) * scale;

      return [x, y];
    },
    [currentBounds]
  );

  // Convert land polygon rings to SVG path definitions
  const landSvgPaths = useMemo(() => {
    const paths: string[] = [];
    if (!landData || !landData.features) return paths;

    for (const feature of landData.features) {
      const geometry = feature.geometry;
      if (!geometry) continue;

      const polygons =
        geometry.type === 'Polygon'
          ? [geometry.coordinates as number[][][]]
          : (geometry.coordinates as number[][][][]);

      for (const poly of polygons) {
        for (const ring of poly) {
          if (!ring || ring.length < 3) continue;
          let d = '';
          for (let i = 0; i < ring.length; i++) {
            const pt = ring[i];
            const [px, py] = project(pt[0], pt[1]);
            d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
          }
          d += 'Z';
          paths.push(d);
        }
      }
    }
    return paths;
  }, [landData, project]);

  // Shipping corridors SVG paths
  const shippingLanePaths = useMemo(() => {
    return MAJOR_SHIPPING_LANES.map((lane) => {
      let d = '';
      for (let i = 0; i < lane.length; i++) {
        const [px, py] = project(lane[i][0], lane[i][1]);
        d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
      }
      return d;
    });
  }, [project]);

  // Graticule / Lat-Lon grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label?: string }[] = [];
    // Generate parallels every 10 degrees between current lat bounds
    const minLatFloor = Math.floor(currentBounds.minLat / 10) * 10;
    const maxLatCeil = Math.ceil(currentBounds.maxLat / 10) * 10;
    for (let lat = minLatFloor; lat <= maxLatCeil; lat += 10) {
      if (lat < -75 || lat > 75) continue;
      const [, y] = project(0, lat);
      if (y >= 0 && y <= SVG_HEIGHT) {
        lines.push({
          x1: 0,
          y1: y,
          x2: SVG_WIDTH,
          y2: y,
          label: `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`,
        });
      }
    }
    // Generate meridians every 10 or 15 degrees
    const stepLon = currentBounds.maxLon - currentBounds.minLon > 80 ? 20 : 10;
    const minLonFloor = Math.floor(currentBounds.minLon / stepLon) * stepLon;
    const maxLonCeil = Math.ceil(currentBounds.maxLon / stepLon) * stepLon;
    for (let lon = minLonFloor; lon <= maxLonCeil; lon += stepLon) {
      const [x] = project(lon, 0);
      if (x >= 0 && x <= SVG_WIDTH) {
        lines.push({
          x1: x,
          y1: 0,
          x2: x,
          y2: SVG_HEIGHT,
          label: `${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}`,
        });
      }
    }
    return lines;
  }, [currentBounds, project]);

  // Risk color semantics
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

  // Projected vessel data with collision-aware label placement
  const projectedVessels = useMemo(() => {
    const raw = vessels.map((v) => {
      const [cx, cy] = project(v.longitude, v.latitude);
      return {
        vessel: v,
        cx,
        cy,
        isSelected: selectedVesselId === v.vessel_id,
        color: getRiskColor(v.risk_level || v.safety_risk_level),
      };
    });

    // Compute label placement to prevent overlapping
    return raw.map((item, idx) => {
      const { cx, cy, vessel } = item;
      // Check proximity to other vessels
      const nearbyRight = raw.some(
        (other, oIdx) =>
          oIdx !== idx && other.cx > cx && other.cx - cx < 65 && Math.abs(other.cy - cy) < 22
      );
      const nearbyLeft = raw.some(
        (other, oIdx) =>
          oIdx !== idx && other.cx < cx && cx - other.cx < 65 && Math.abs(other.cy - cy) < 22
      );

      let textAnchor: 'start' | 'end' | 'middle' = 'start';
      let labelOffsetX = 10;
      let labelOffsetY = 3;

      if (nearbyRight && !nearbyLeft) {
        // Place label to the left of the marker
        textAnchor = 'end';
        labelOffsetX = -10;
        labelOffsetY = 3;
      } else if (nearbyRight && nearbyLeft) {
        // Place label above
        textAnchor = 'middle';
        labelOffsetX = 0;
        labelOffsetY = -11;
      }

      // Format name: abbreviate "MV Horizon Star" -> "Horizon Star" for compact view if needed
      const displayName = vessel.vessel_name.replace(/^MV\s+/, '');
      const pillWidth = Math.max(48, displayName.length * 5.6 + 8);

      return {
        ...item,
        textAnchor,
        labelOffsetX,
        labelOffsetY,
        displayName,
        pillWidth,
      };
    });
  }, [vessels, project, selectedVesselId]);

  // Sort projected vessels so selected or hovered vessels render on top
  const sortedVessels = useMemo(() => {
    return [...projectedVessels].sort((a, b) => {
      if (a.isSelected) return 1;
      if (b.isSelected) return -1;
      if (hoveredVessel?.vessel_id === a.vessel.vessel_id) return 1;
      if (hoveredVessel?.vessel_id === b.vessel.vessel_id) return -1;
      return 0;
    });
  }, [projectedVessels, hoveredVessel]);

  // Zoom handlers
  const handleZoomIn = () => setZoomMultiplier((prev) => Math.min(3.5, prev * 1.3));
  const handleZoomOut = () => setZoomMultiplier((prev) => Math.max(0.6, prev / 1.3));
  const handleResetZoom = (preset: ViewPreset) => {
    setActivePreset(preset);
    setZoomMultiplier(1.0);
  };

  return (
    <div
      data-testid="interactive-map"
      className={styles.mapContainer}
      style={{ height: `${height}px` }}
    >
      {/* Map Header Toolbar with Viewport Presets & Zoom Controls */}
      <div className={styles.mapToolbar}>
        <button
          className={`${styles.toolbarBtn} ${activePreset === 'fleet' ? styles.active : ''}`}
          onClick={() => handleResetZoom('fleet')}
          title="Fit view to current filtered vessels"
        >
          Fleet Extent
        </button>
        <button
          className={`${styles.toolbarBtn} ${activePreset === 'gulf' ? styles.active : ''}`}
          onClick={() => handleResetZoom('gulf')}
          title="Zoom to Arabian Gulf & Strait of Hormuz"
        >
          Arabian Gulf
        </button>
        <button
          className={`${styles.toolbarBtn} ${activePreset === 'regional' ? styles.active : ''}`}
          onClick={() => handleResetZoom('regional')}
          title="Regional Indo-Pacific & Indian Ocean view"
        >
          Indian Ocean
        </button>
        <button
          className={`${styles.toolbarBtn} ${activePreset === 'global' ? styles.active : ''}`}
          onClick={() => handleResetZoom('global')}
          title="World map overview"
        >
          Global
        </button>
        <div className={styles.divider} />
        <button
          className={`${styles.toolbarBtn} ${styles.zoomBtn}`}
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
        >
          +
        </button>
        <button
          className={`${styles.toolbarBtn} ${styles.zoomBtn}`}
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          &minus;
        </button>
      </div>

      {/* Map Legend */}
      <div className={styles.mapLegend}>
        <span style={{ color: '#7a96b2', fontWeight: 600 }}>RISK:</span>
        <span className={styles.legendItem} style={{ color: '#28c499' }}>
          ● Low
        </span>
        <span className={styles.legendItem} style={{ color: '#f6b84b' }}>
          ● Med
        </span>
        <span className={styles.legendItem} style={{ color: '#ef5b69' }}>
          ● Critical
        </span>
        <div className={styles.divider} />
        <span style={{ color: '#567599', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '12px',
              borderTop: '2px dashed #204c75',
              display: 'inline-block',
            }}
          />
          Corridor
        </span>
      </div>

      {/* Primary SVG Canvas */}
      <svg
        className={styles.mapSvg}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle ocean depth texture */}
          <radialGradient id="oceanGlow" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#0b1a2c" />
            <stop offset="100%" stopColor="#050e18" />
          </radialGradient>
          {/* Land gradient for realistic bathymetric elevation */}
          <linearGradient id="landFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14263b" />
            <stop offset="100%" stopColor="#0f1e2f" />
          </linearGradient>
        </defs>

        {/* Ocean Background */}
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#oceanGlow)" />

        {/* Lat/Lon Graticule Lines */}
        <g stroke="#132439" strokeWidth="0.8" strokeDasharray="3,4">
          {gridLines.map((line, idx) => (
            <React.Fragment key={idx}>
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              {line.label && (
                <text
                  x={line.x1 === 0 ? 8 : line.x1 + 2}
                  y={line.x1 === 0 ? line.y1 - 3 : SVG_HEIGHT - 6}
                  fill="#36506d"
                  fontSize="7.5"
                  fontFamily="monospace"
                  opacity="0.8"
                >
                  {line.label}
                </text>
              )}
            </React.Fragment>
          ))}
        </g>

        {/* Geographic Basemap Land Polygons */}
        <g className="basemap-land-group">
          {landSvgPaths.map((pathD, idx) => (
            <path
              key={`land-${idx}`}
              data-testid="basemap-land"
              d={pathD}
              fill="url(#landFill)"
              stroke="#26415f"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Commercial Shipping Corridors */}
        <g stroke="#1d456d" strokeWidth="1.5" strokeDasharray="4,4" fill="none" opacity="0.7">
          {shippingLanePaths.map((d, idx) => (
            <path key={`lane-${idx}`} d={d} />
          ))}
        </g>

        {/* Major Ports & Hubs */}
        <g className="basemap-ports">
          {MAJOR_MARITIME_PORTS.map((port) => {
            const [px, py] = project(port.longitude, port.latitude);
            if (px < -30 || px > SVG_WIDTH + 30 || py < -30 || py > SVG_HEIGHT + 30) return null;
            return (
              <g key={port.code} opacity="0.75">
                <circle cx={px} cy={py} r="2.5" fill="#38bdf8" />
                <circle
                  cx={px}
                  cy={py}
                  r="5"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.6"
                  opacity="0.4"
                />
                <text
                  x={px + 5}
                  y={py + 2.5}
                  fill="#54789d"
                  fontSize="7.5"
                  fontFamily="var(--font-sans)"
                  fontWeight="500"
                >
                  {port.code}
                </text>
              </g>
            );
          })}
        </g>

        {/* Geographic Sea / Strait Labels */}
        <g className="basemap-labels" pointerEvents="none">
          {MARITIME_GEOGRAPHIC_LABELS.map((label) => {
            const [lx, ly] = project(label.longitude, label.latitude);
            if (lx < -50 || lx > SVG_WIDTH + 50 || ly < -50 || ly > SVG_HEIGHT + 50) return null;
            const isStrait = label.type === 'strait';
            return (
              <text
                key={label.name}
                x={lx}
                y={ly}
                fill={isStrait ? '#3da1bf' : '#3d6185'}
                fontSize={isStrait ? '8' : '8.5'}
                fontFamily="var(--font-sans)"
                fontWeight="700"
                fontStyle="italic"
                letterSpacing="1.8"
                textAnchor="middle"
                opacity={isStrait ? '0.85' : '0.65'}
              >
                {label.name}
              </text>
            );
          })}
        </g>

        {/* Vessel Markers & Labels */}
        <g className="vessel-markers-layer">
          {sortedVessels.map((item) => {
            const {
              vessel,
              cx,
              cy,
              isSelected,
              color,
              textAnchor,
              labelOffsetX,
              labelOffsetY,
              displayName,
              pillWidth,
            } = item;

            // Pill placement coordinates
            let pillX = cx + labelOffsetX;
            if (textAnchor === 'end') {
              pillX = cx + labelOffsetX - pillWidth;
            } else if (textAnchor === 'middle') {
              pillX = cx - pillWidth / 2;
            }
            const pillY = cy + labelOffsetY - 10;

            return (
              <g
                key={vessel.vessel_id}
                data-testid="vessel-marker"
                data-vessel-id={vessel.vessel_id}
                aria-selected={isSelected}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (onSelectVessel) onSelectVessel(vessel.vessel_id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onSelectVessel) onSelectVessel(vessel.vessel_id);
                  }
                }}
                onMouseEnter={() => setHoveredVessel(vessel)}
                onMouseLeave={() => setHoveredVessel(null)}
                style={{ cursor: 'pointer', outline: 'none', pointerEvents: 'all' }}
              >
                {/* Radar pulse ripples on selected vessel */}
                {isSelected && (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={14}
                      fill="none"
                      stroke="#25c2d8"
                      strokeWidth="2"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="r"
                        values="8;24;8"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.9;0.1;0.9"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={20}
                      fill="none"
                      stroke="#25c2d8"
                      strokeWidth="1.2"
                      opacity="0.5"
                    >
                      <animate
                        attributeName="r"
                        values="14;32;14"
                        dur="2.4s"
                        begin="0.8s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.6;0.0;0.6"
                        dur="2.4s"
                        begin="0.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                )}

                {/* Invisible hit target ensuring click reliability across marker radius */}
                <circle cx={cx} cy={cy} r={18} fill="transparent" pointerEvents="all" />

                {/* Outer halo / glow circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 10 : 7}
                  fill={color}
                  opacity={isSelected ? 0.45 : 0.25}
                  pointerEvents="none"
                />

                {/* Core Vessel Dot with crisp white border */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5.8 : 4.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />

                {/* Vessel Label Pill Background */}
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillWidth}
                  height={13}
                  rx={3}
                  fill={isSelected ? 'rgba(9, 28, 48, 0.92)' : 'rgba(7, 18, 30, 0.82)'}
                  stroke={isSelected ? '#25c2d8' : '#1d344d'}
                  strokeWidth={isSelected ? 1.2 : 0.75}
                  pointerEvents="all"
                />

                {/* Vessel Name Text */}
                <text
                  x={cx + labelOffsetX}
                  y={cy + labelOffsetY}
                  textAnchor={textAnchor}
                  fill={isSelected ? '#25c2d8' : '#e6eef8'}
                  fontSize="8.2"
                  fontWeight={isSelected ? '700' : '600'}
                  fontFamily="var(--font-sans)"
                  pointerEvents="none"
                >
                  {displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Detailed Hover Tooltip */}
      {hoveredVessel && (
        <div className={styles.tooltipCard}>
          <div className={styles.tooltipTitle}>
            <span>{hoveredVessel.vessel_name}</span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background:
                  hoveredVessel.risk_level === 'Critical'
                    ? 'rgba(239, 91, 105, 0.25)'
                    : hoveredVessel.risk_level === 'Medium'
                      ? 'rgba(246, 184, 75, 0.25)'
                      : 'rgba(40, 196, 153, 0.25)',
                color: getRiskColor(hoveredVessel.risk_level || hoveredVessel.safety_risk_level),
                border: `1px solid ${getRiskColor(
                  hoveredVessel.risk_level || hoveredVessel.safety_risk_level
                )}`,
              }}
            >
              {hoveredVessel.risk_level || hoveredVessel.safety_risk_level} Risk
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Type / IMO:</span>
            <span className={styles.tooltipVal}>
              {hoveredVessel.vessel_type} · {hoveredVessel.imo_identifier}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Status:</span>
            <span className={styles.tooltipVal}>{hoveredVessel.operational_status}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Route:</span>
            <span className={styles.tooltipVal}>
              {hoveredVessel.current_location} &rarr;{' '}
              {hoveredVessel.destination || hoveredVessel.destination_port}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Speed / Health:</span>
            <span className={styles.tooltipVal}>
              {hoveredVessel.speed_knots} kts · {hoveredVessel.technical_health_score}/100
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Position:</span>
            <span className={styles.tooltipVal} style={{ fontFamily: 'monospace' }}>
              {hoveredVessel.latitude.toFixed(2)}°N, {hoveredVessel.longitude.toFixed(2)}°E
            </span>
          </div>
        </div>
      )}

      {/* Map Status Bar */}
      <div className={styles.mapStatus}>
        Fleet: {vessels.length} vessel{vessels.length !== 1 ? 's' : ''} · Zoom:{' '}
        {zoomMultiplier.toFixed(1)}x ({activePreset.toUpperCase()})
      </div>
    </div>
  );
};
