import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vessel } from '../../types/maritime';
import {
  MARITIME_GEOGRAPHIC_LABELS,
  MAJOR_MARITIME_PORTS,
  MAJOR_SHIPPING_LANES,
  GeoFeatureCollection,
} from './basemapData';
import { REGIONAL_LAND_FALLBACK } from './landFallback';
import {
  layoutLabels,
  nearestPointOnBox,
  overlaps,
  type Box,
  type LabelRequest,
} from './labelLayout';
import {
  isUnderway,
  longestVoyageHours,
  motionAt,
  type VesselMotion,
} from '../../services/vesselMotion';
import { PORTS } from '../../services/seaRoutes';
import { SimulationClock, formatUtcClock } from '../../services/simulationClock';
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

/** Map time runs at this multiple of real time. 1 = live. */
const SPEEDS: { factor: number; label: string; title: string }[] = [
  { factor: 1, label: 'Live', title: 'Real time: vessels move at their reported speed' },
  { factor: 600, label: '×600', title: 'Time-lapse: 1 second = 10 minutes' },
  { factor: 3600, label: '×3600', title: 'Time-lapse: 1 second = 1 hour (voyage replay)' },
];

const SVG_HEIGHT = 500;
const HOUR_MS = 3_600_000;

// In-memory cache so subsequent mounts don't re-fetch
let cachedWorldLand: GeoFeatureCollection | null = null;

function mercatorY(lat: number): number {
  const clamped = Math.max(-80, Math.min(80, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const RISK_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function riskColor(risk?: string): string {
  switch (risk) {
    case 'Critical':
      return '#ef5b69';
    case 'High':
      return '#f08b50';
    case 'Medium':
      return '#f6b84b';
    default:
      return '#28c499';
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** Real hours elapsed since the dataset snapshot (the reported positions). */
function realElapsedHours(nowMs: number): number {
  return (nowMs - SimulationClock.referenceMs) / HOUR_MS;
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ---- Container measurement: the SVG viewBox follows the container aspect (no cropping) ----
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1000, h: height });
  const [reserved, setReserved] = useState<Box[]>([]);

  const svgWidth = useMemo(
    () => Math.round(Math.min(2000, Math.max(400, (SVG_HEIGHT * size.w) / Math.max(1, size.h)))),
    [size]
  );
  const unitsPerPx = SVG_HEIGHT / Math.max(1, size.h);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setSize((prev) =>
      Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
        ? { w: rect.width, h: rect.height }
        : prev
    );
    const k = SVG_HEIGHT / rect.height;
    const boxes: Box[] = [];
    for (const ref of [toolbarRef, legendRef, statusRef]) {
      const r = ref.current?.getBoundingClientRect();
      if (!r || r.width === 0) continue;
      boxes.push({
        x: (r.left - rect.left) * k - 3,
        y: (r.top - rect.top) * k - 3,
        w: r.width * k + 6,
        h: r.height * k + 6,
      });
    }
    setReserved((prev) => (JSON.stringify(prev) === JSON.stringify(boxes) ? prev : boxes));
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    for (const ref of [containerRef, toolbarRef, legendRef, statusRef]) {
      if (ref.current) ro.observe(ref.current);
    }
    return () => ro.disconnect();
  }, [measure]);

  // ---- Map time (simulated motion) ----
  const [speed, setSpeed] = useState<number>(() => (prefersReducedMotion() ? 1 : 3600));
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const replay = useRef<{ realStart: number; startHours: number }>({
    realStart: Date.now(),
    startHours: realElapsedHours(Date.now()),
  });
  const anyUnderway = useMemo(() => vessels.some(isUnderway), [vessels]);
  const loopHours = useMemo(() => longestVoyageHours(vessels) + 2, [vessels]);

  const changeSpeed = (factor: number) => {
    const now = Date.now();
    replay.current = { realStart: now, startHours: realElapsedHours(now) };
    setSpeed(factor);
    setNowMs(now);
  };

  useEffect(() => {
    if (!anyUnderway) return;
    const id = window.setInterval(() => setNowMs(Date.now()), speed === 1 ? 5000 : 200);
    return () => window.clearInterval(id);
  }, [speed, anyUnderway]);

  let mapHours = realElapsedHours(nowMs);
  if (speed !== 1) {
    const r = replay.current;
    mapHours = r.startHours + ((nowMs - r.realStart) / HOUR_MS) * speed;
    if (mapHours - r.startHours > loopHours) {
      // Voyage replay complete: restart from the current reported positions.
      replay.current = { realStart: nowMs, startHours: realElapsedHours(nowMs) };
      mapHours = replay.current.startHours;
    }
  }
  const mapTimeMs = SimulationClock.referenceMs + mapHours * HOUR_MS;

  const motions = useMemo(() => {
    const m = new Map<string, VesselMotion>();
    for (const v of vessels) m.set(v.vessel_id, motionAt(v, mapHours));
    return m;
  }, [vessels, mapHours]);
  const underwayCount = [...motions.values()].filter((m) => m.moving).length;

  // ---- Basemap loading ----
  useEffect(() => {
    if (cachedWorldLand) {
      setLandData(cachedWorldLand);
      return;
    }
    let isMounted = true;
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    fetch(`${baseUrl}/data/world_land.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GeoFeatureCollection) => {
        cachedWorldLand = data;
        if (isMounted) setLandData(data);
      })
      .catch((err) => {
        console.debug('Using bundled regional land fallback:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ---- View bounds (stable while vessels move: reported positions + destinations) ----
  const baseBounds = useMemo<GeoBounds>(() => {
    if (activePreset === 'gulf') return { minLon: 47.5, maxLon: 60.0, minLat: 22.5, maxLat: 30.2 };
    if (activePreset === 'regional')
      return { minLon: 35.0, maxLon: 108.0, minLat: -2.0, maxLat: 32.0 };
    if (activePreset === 'global')
      return { minLon: -160.0, maxLon: 160.0, minLat: -56.0, maxLat: 72.0 };

    const points: [number, number][] = [];
    for (const v of vessels) {
      if (Number.isFinite(v.longitude) && Number.isFinite(v.latitude))
        points.push([v.longitude, v.latitude]);
      const dest = isUnderway(v) ? PORTS[v.destination_port] : undefined;
      if (dest) points.push(dest.position);
    }
    if (points.length === 0) return { minLon: 35.0, maxLon: 108.0, minLat: -2.0, maxLat: 32.0 };

    let minLon = Math.min(...points.map((p) => p[0]));
    let maxLon = Math.max(...points.map((p) => p[0]));
    let minLat = Math.min(...points.map((p) => p[1]));
    let maxLat = Math.max(...points.map((p) => p[1]));
    if (maxLon - minLon < 9) {
      const mid = (minLon + maxLon) / 2;
      minLon = mid - 4.5;
      maxLon = mid + 4.5;
    }
    if (maxLat - minLat < 5.5) {
      const mid = (minLat + maxLat) / 2;
      minLat = mid - 2.75;
      maxLat = mid + 2.75;
    }
    const lonPad = Math.max(1.5, (maxLon - minLon) * 0.08);
    const latPad = Math.max(1.0, (maxLat - minLat) * 0.08);
    return {
      minLon: Math.max(-180, minLon - lonPad),
      maxLon: Math.min(180, maxLon + lonPad),
      minLat: Math.max(-75, minLat - latPad),
      maxLat: Math.min(75, maxLat + latPad),
    };
  }, [activePreset, vessels]);

  const currentBounds = useMemo<GeoBounds>(() => {
    if (zoomMultiplier === 1.0) return baseBounds;
    const cLon = (baseBounds.minLon + baseBounds.maxLon) / 2;
    const cLat = (baseBounds.minLat + baseBounds.maxLat) / 2;
    const hLon = (baseBounds.maxLon - baseBounds.minLon) / 2 / zoomMultiplier;
    const hLat = (baseBounds.maxLat - baseBounds.minLat) / 2 / zoomMultiplier;
    return {
      minLon: Math.max(-180, cLon - hLon),
      maxLon: Math.min(180, cLon + hLon),
      minLat: Math.max(-75, cLat - hLat),
      maxLat: Math.min(75, cLat + hLat),
    };
  }, [baseBounds, zoomMultiplier]);

  // Usable drawing area: keep clear of the toolbar (top) and legend/status (bottom).
  const usable = useMemo(() => {
    const top = Math.min(160, 46 * unitsPerPx);
    const bottom = Math.min(120, 30 * unitsPerPx);
    const side = 16 * unitsPerPx;
    return { x: side, y: top, w: svgWidth - 2 * side, h: SVG_HEIGHT - top - bottom };
  }, [svgWidth, unitsPerPx]);

  const project = useCallback(
    (lon: number, lat: number): [number, number] => {
      const xMin = (currentBounds.minLon * Math.PI) / 180;
      const xMax = (currentBounds.maxLon * Math.PI) / 180;
      const yMin = mercatorY(currentBounds.minLat);
      const yMax = mercatorY(currentBounds.maxLat);
      const scale = Math.min(usable.w / (xMax - xMin), usable.h / (yMax - yMin));
      const xc = (xMin + xMax) / 2;
      const yc = (yMin + yMax) / 2;
      const x = usable.x + usable.w / 2 + ((lon * Math.PI) / 180 - xc) * scale;
      const y = usable.y + usable.h / 2 - (mercatorY(lat) - yc) * scale;
      return [x, y];
    },
    [currentBounds, usable]
  );

  const toPath = useCallback(
    (pts: [number, number][]) =>
      pts
        .map(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(''),
    [project]
  );

  const landSvgPaths = useMemo(() => {
    const paths: string[] = [];
    for (const feature of landData?.features ?? []) {
      const geometry = feature.geometry;
      if (!geometry) continue;
      const polygons =
        geometry.type === 'Polygon'
          ? [geometry.coordinates as number[][][]]
          : (geometry.coordinates as number[][][][]);
      for (const poly of polygons) {
        for (const ring of poly) {
          if (!ring || ring.length < 3) continue;
          paths.push(toPath(ring as [number, number][]) + 'Z');
        }
      }
    }
    return paths;
  }, [landData, toPath]);

  const shippingLanePaths = useMemo(
    () => MAJOR_SHIPPING_LANES.map((lane) => toPath(lane)),
    [toPath]
  );

  const gridLines = useMemo(() => {
    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      horizontal: boolean;
    }[] = [];
    for (
      let lat = Math.floor(currentBounds.minLat / 10) * 10;
      lat <= Math.ceil(currentBounds.maxLat / 10) * 10;
      lat += 10
    ) {
      if (lat < -75 || lat > 75) continue;
      const [, y] = project(0, lat);
      if (y >= 0 && y <= SVG_HEIGHT) {
        lines.push({
          x1: 0,
          y1: y,
          x2: svgWidth,
          y2: y,
          label: `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`,
          horizontal: true,
        });
      }
    }
    const step = currentBounds.maxLon - currentBounds.minLon > 80 ? 20 : 10;
    for (
      let lon = Math.floor(currentBounds.minLon / step) * step;
      lon <= Math.ceil(currentBounds.maxLon / step) * step;
      lon += step
    ) {
      const [x] = project(lon, 0);
      if (x >= 0 && x <= svgWidth) {
        lines.push({
          x1: x,
          y1: 0,
          x2: x,
          y2: SVG_HEIGHT,
          label: `${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}`,
          horizontal: false,
        });
      }
    }
    return lines;
  }, [currentBounds, project, svgWidth]);

  // ---- Vessels: projected positions and collision-free labels ----
  const projected = useMemo(
    () =>
      vessels.map((v) => {
        const motion = motions.get(v.vessel_id) as VesselMotion;
        const [cx, cy] = project(motion.position[0], motion.position[1]);
        const displayName = v.vessel_name.replace(/^MV\s+/, '');
        return {
          vessel: v,
          motion,
          cx,
          cy,
          isSelected: selectedVesselId === v.vessel_id,
          color: riskColor(v.risk_level || v.safety_risk_level),
          displayName,
        };
      }),
    [vessels, motions, project, selectedVesselId]
  );

  const previousPlacement = useRef<Map<string, number>>(new Map());
  const labels = useMemo(() => {
    const priority = (p: (typeof projected)[number]) =>
      (p.isSelected ? 100 : 0) +
      (p.vessel.vessel_id === hoveredId ? 50 : 0) +
      (p.motion.moving ? 10 : 0) +
      (RISK_RANK[p.vessel.risk_level || p.vessel.safety_risk_level] ?? 0);
    const ordered = [...projected].sort((a, b) => priority(b) - priority(a));
    const requests: LabelRequest[] = ordered.map((p) => ({
      id: p.vessel.vessel_id,
      x: p.cx,
      y: p.cy,
      width: p.displayName.length * 5.1 + 10,
      height: 13,
    }));
    const markers: Box[] = projected.map((p) => ({ x: p.cx - 7, y: p.cy - 7, w: 14, h: 14 }));
    const placed = layoutLabels(requests, {
      bounds: { x: 2, y: 2, w: svgWidth - 4, h: SVG_HEIGHT - 4 },
      markers,
      reserved,
      previous: previousPlacement.current,
    });
    const next = new Map<string, number>();
    placed.forEach((l, id) => {
      if (!l.hidden) next.set(id, l.candidate);
    });
    previousPlacement.current = next;
    return placed;
  }, [projected, reserved, svgWidth, hoveredId]);

  // Everything vessel-related that background labels must stay clear of.
  const vesselBoxes = useMemo<Box[]>(() => {
    const boxes: Box[] = projected.map((p) => ({ x: p.cx - 8, y: p.cy - 8, w: 16, h: 16 }));
    labels.forEach((l) => {
      if (!l.hidden) boxes.push(l.box);
    });
    return [...boxes, ...reserved];
  }, [projected, labels, reserved]);

  const portsToDraw = useMemo(
    () =>
      MAJOR_MARITIME_PORTS.map((port) => {
        const [px, py] = project(port.longitude, port.latitude);
        const labelBox: Box = { x: px + 4, y: py - 5, w: port.code.length * 4.8 + 2, h: 9 };
        const showLabel = !vesselBoxes.some((b) => overlaps(labelBox, b, 0.5));
        return { port, px, py, showLabel };
      }).filter(({ px, py }) => px > -30 && px < svgWidth + 30 && py > -30 && py < SVG_HEIGHT + 30),
    [project, vesselBoxes, svgWidth]
  );

  const seaLabels = useMemo(() => {
    const out: { name: string; x: number; y: number; strait: boolean }[] = [];
    const taken: Box[] = [...vesselBoxes];
    for (const label of MARITIME_GEOGRAPHIC_LABELS) {
      const [lx, ly] = project(label.longitude, label.latitude);
      const w = label.name.length * 7;
      const box: Box = { x: lx - w / 2, y: ly - 8, w, h: 10 };
      if (box.x < 0 || box.x + box.w > svgWidth || box.y < 0 || box.y + box.h > SVG_HEIGHT)
        continue;
      if (taken.some((b) => overlaps(box, b, 1))) continue;
      taken.push(box);
      out.push({ name: label.name, x: lx, y: ly, strait: label.type === 'strait' });
    }
    return out;
  }, [project, vesselBoxes, svgWidth]);

  // Render order: selected / hovered on top.
  const renderOrder = useMemo(
    () =>
      [...projected].sort((a, b) => {
        const rank = (p: (typeof projected)[number]) =>
          (p.isSelected ? 2 : 0) + (p.vessel.vessel_id === hoveredId ? 1 : 0);
        return rank(a) - rank(b);
      }),
    [projected, hoveredId]
  );

  const hovered = hoveredId ? projected.find((p) => p.vessel.vessel_id === hoveredId) : undefined;

  const handleZoomIn = () => setZoomMultiplier((prev) => Math.min(3.5, prev * 1.3));
  const handleZoomOut = () => setZoomMultiplier((prev) => Math.max(0.6, prev / 1.3));
  const handleResetZoom = (preset: ViewPreset) => {
    setActivePreset(preset);
    setZoomMultiplier(1.0);
  };

  const speedLabel = SPEEDS.find((s) => s.factor === speed);

  return (
    <div
      ref={containerRef}
      data-testid="interactive-map"
      className={styles.mapContainer}
      style={{ height: `${height}px` }}
    >
      {/* Toolbar: view presets, zoom, motion speed */}
      <div className={styles.mapToolbar} ref={toolbarRef}>
        {(
          [
            [
              'fleet',
              'Fleet Extent',
              'Fit view to current filtered vessels and their destinations',
            ],
            ['gulf', 'Arabian Gulf', 'Zoom to Arabian Gulf & Strait of Hormuz'],
            ['regional', 'Indian Ocean', 'Regional Indo-Pacific & Indian Ocean view'],
            ['global', 'Global', 'World map overview'],
          ] as [ViewPreset, string, string][]
        ).map(([preset, label, title]) => (
          <button
            key={preset}
            className={`${styles.toolbarBtn} ${activePreset === preset ? styles.active : ''}`}
            onClick={() => handleResetZoom(preset)}
            title={title}
          >
            {label}
          </button>
        ))}
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
        {anyUnderway && (
          <>
            <div className={styles.divider} />
            <span className={styles.toolbarLabel}>Motion</span>
            {SPEEDS.map((s) => (
              <button
                key={s.factor}
                className={`${styles.toolbarBtn} ${speed === s.factor ? styles.active : ''}`}
                onClick={() => changeSpeed(s.factor)}
                title={s.title}
                aria-pressed={speed === s.factor}
                data-testid={`map-speed-${s.factor}`}
              >
                {s.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Legend (bottom-left) */}
      <div className={styles.mapLegend} ref={legendRef}>
        <span style={{ color: '#7a96b2', fontWeight: 600 }}>RISK</span>
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
        <span className={styles.legendItem} style={{ color: '#9cb4cc' }}>
          ▲ Under way
        </span>
        <span className={styles.legendItem} style={{ color: '#567599' }}>
          <span
            style={{ width: '12px', borderTop: '2px dashed #3d6f9c', display: 'inline-block' }}
          />
          Planned route
        </span>
      </div>

      <svg
        className={styles.mapSvg}
        viewBox={`0 0 ${svgWidth} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Fleet map"
      >
        <defs>
          <radialGradient id="oceanGlow" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#0b1a2c" />
            <stop offset="100%" stopColor="#050e18" />
          </radialGradient>
          <linearGradient id="landFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14263b" />
            <stop offset="100%" stopColor="#0f1e2f" />
          </linearGradient>
        </defs>

        <rect width={svgWidth} height={SVG_HEIGHT} fill="url(#oceanGlow)" />

        {/* Graticule */}
        <g stroke="#132439" strokeWidth="0.8" strokeDasharray="3,4">
          {gridLines.map((line, idx) => (
            <React.Fragment key={idx}>
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              <text
                x={line.horizontal ? svgWidth - 30 : line.x1 + 2}
                y={line.horizontal ? line.y1 - 3 : SVG_HEIGHT - 6}
                fill="#36506d"
                stroke="none"
                fontSize="7.5"
                fontFamily="monospace"
                opacity="0.8"
              >
                {line.label}
              </text>
            </React.Fragment>
          ))}
        </g>

        {/* Land */}
        <g className="basemap-land-group">
          {landSvgPaths.map((d, idx) => (
            <path
              key={`land-${idx}`}
              data-testid="basemap-land"
              d={d}
              fill="url(#landFill)"
              stroke="#26415f"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Main shipping corridors */}
        <g stroke="#1d456d" strokeWidth="1.2" strokeDasharray="4,4" fill="none" opacity="0.5">
          {shippingLanePaths.map((d, idx) => (
            <path key={`lane-${idx}`} d={d} />
          ))}
        </g>

        {/* Ports */}
        <g className="basemap-ports">
          {portsToDraw.map(({ port, px, py, showLabel }) => (
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
              {showLabel && (
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
              )}
            </g>
          ))}
        </g>

        {/* Sea / strait names (only where they do not collide with vessels or labels) */}
        <g className="basemap-labels" pointerEvents="none">
          {seaLabels.map((l) => (
            <text
              key={l.name}
              x={l.x}
              y={l.y}
              fill={l.strait ? '#3da1bf' : '#3d6185'}
              fontSize={l.strait ? '8' : '8.5'}
              fontFamily="var(--font-sans)"
              fontWeight="700"
              fontStyle="italic"
              letterSpacing="1.8"
              textAnchor="middle"
              opacity={l.strait ? '0.85' : '0.65'}
            >
              {l.name}
            </text>
          ))}
        </g>

        {/* Routes: travelled wake (solid) and remaining planned route (dashed) */}
        <g className="vessel-routes" fill="none" pointerEvents="none">
          {projected
            .filter((p) => p.motion.hasRoute)
            .map((p) => {
              const emphasis = p.isSelected || p.vessel.vessel_id === hoveredId;
              return (
                <g key={`route-${p.vessel.vessel_id}`} data-testid="vessel-route">
                  <path
                    d={toPath(p.motion.traveled)}
                    stroke={p.color}
                    strokeWidth={emphasis ? 2 : 1.4}
                    opacity={emphasis ? 0.8 : 0.45}
                    strokeLinecap="round"
                  />
                  {!p.motion.arrived && (
                    <path
                      d={toPath(p.motion.remaining)}
                      stroke={p.color}
                      strokeWidth={emphasis ? 1.6 : 1}
                      strokeDasharray="3,4"
                      opacity={emphasis ? 0.7 : 0.35}
                    />
                  )}
                </g>
              );
            })}
        </g>

        {/* Leader lines for labels placed away from their marker */}
        <g className="label-leaders" pointerEvents="none">
          {projected.map((p) => {
            const l = labels.get(p.vessel.vessel_id);
            if (!l || l.hidden || !l.leader) return null;
            const [lx, ly] = nearestPointOnBox(l.box, p.cx, p.cy);
            return (
              <line
                key={`leader-${p.vessel.vessel_id}`}
                x1={p.cx}
                y1={p.cy}
                x2={lx}
                y2={ly}
                stroke={p.isSelected ? '#25c2d8' : '#3a5877'}
                strokeWidth="0.8"
              />
            );
          })}
        </g>

        {/* Vessel markers */}
        <g className="vessel-markers-layer">
          {renderOrder.map((p) => {
            const { vessel, cx, cy, isSelected, color, displayName, motion } = p;
            const l = labels.get(vessel.vessel_id);
            const showLabel = l && (!l.hidden || isSelected || vessel.vessel_id === hoveredId);
            const select = () => onSelectVessel?.(vessel.vessel_id);
            return (
              <g
                key={vessel.vessel_id}
                data-testid="vessel-marker"
                data-vessel-id={vessel.vessel_id}
                data-moving={motion.moving ? 'true' : 'false'}
                aria-selected={isSelected}
                aria-label={`${vessel.vessel_name}, ${motion.moving ? 'under way' : vessel.operational_status}`}
                role="button"
                tabIndex={0}
                onClick={select}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select();
                  }
                }}
                onMouseEnter={() => setHoveredId(vessel.vessel_id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: 'pointer', outline: 'none', pointerEvents: 'all' }}
              >
                {isSelected && (
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
                )}
                <circle cx={cx} cy={cy} r={16} fill="transparent" pointerEvents="all" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 10 : 7}
                  fill={color}
                  opacity={isSelected ? 0.4 : 0.22}
                  pointerEvents="none"
                />
                {motion.moving && motion.course !== null ? (
                  <path
                    d={`M${cx},${cy - 7} L${cx + 5},${cy + 5} L${cx},${cy + 2.5} L${cx - 5},${cy + 5} Z`}
                    transform={`rotate(${motion.course.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5.8 : 4.5}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />
                )}
                {showLabel && l && (
                  <g data-testid="vessel-label">
                    <rect
                      x={l.box.x}
                      y={l.box.y}
                      width={l.box.w}
                      height={l.box.h}
                      rx={3}
                      fill={isSelected ? 'rgba(9, 28, 48, 0.94)' : 'rgba(7, 18, 30, 0.86)'}
                      stroke={isSelected ? '#25c2d8' : '#1d344d'}
                      strokeWidth={isSelected ? 1.2 : 0.75}
                    />
                    <text
                      x={l.box.x + l.box.w / 2}
                      y={l.box.y + 9.4}
                      textAnchor="middle"
                      fill={isSelected ? '#25c2d8' : '#e6eef8'}
                      fontSize="8.2"
                      fontWeight={isSelected ? '700' : '600'}
                      fontFamily="var(--font-sans)"
                      pointerEvents="none"
                    >
                      {displayName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover tooltip (top-right) */}
      {hovered && (
        <div className={styles.tooltipCard} data-testid="map-tooltip">
          <div className={styles.tooltipTitle}>
            <span>{hovered.vessel.vessel_name}</span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 5px',
                borderRadius: '3px',
                color: hovered.color,
                border: `1px solid ${hovered.color}`,
              }}
            >
              {hovered.vessel.risk_level || hovered.vessel.safety_risk_level} Risk
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Type / IMO:</span>
            <span className={styles.tooltipVal}>
              {hovered.vessel.vessel_type} · {hovered.vessel.imo_identifier}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Status:</span>
            <span className={styles.tooltipVal}>
              {hovered.motion.arrived
                ? `Arrived ${hovered.vessel.destination_port} (map time)`
                : hovered.vessel.operational_status}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Route:</span>
            <span className={styles.tooltipVal}>
              {hovered.vessel.departure_port} &rarr; {hovered.vessel.destination_port}
            </span>
          </div>
          {hovered.motion.moving && (
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>SOG / COG:</span>
              <span className={styles.tooltipVal}>
                {hovered.vessel.speed_knots} kn · {Math.round(hovered.motion.course ?? 0)}°
              </span>
            </div>
          )}
          {hovered.motion.hasRoute &&
            hovered.motion.etaHours !== null &&
            !hovered.motion.arrived && (
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Remaining:</span>
                <span className={styles.tooltipVal}>
                  {Math.round(hovered.motion.totalNm - hovered.motion.progressNm)} nm ·{' '}
                  {hovered.motion.etaHours.toFixed(1)} h
                </span>
              </div>
            )}
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Position:</span>
            <span className={styles.tooltipVal} style={{ fontFamily: 'monospace' }}>
              {Math.abs(hovered.motion.position[1]).toFixed(2)}°
              {hovered.motion.position[1] >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(hovered.motion.position[0]).toFixed(2)}°
              {hovered.motion.position[0] >= 0 ? 'E' : 'W'}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Health:</span>
            <span className={styles.tooltipVal}>{hovered.vessel.technical_health_score}/100</span>
          </div>
        </div>
      )}

      {/* Status (bottom-right) */}
      <div
        className={styles.mapStatus}
        ref={statusRef}
        data-testid="map-status"
        title="Vessel movement is simulated from reported position, speed and destination along sea lanes"
      >
        {vessels.length} vessels · {underwayCount} under way ·{' '}
        {speed === 1 ? 'Live (simulated)' : `Simulated ${speedLabel?.label}`} ·{' '}
        {formatUtcClock(mapTimeMs).substring(11, 16)} UTC
      </div>
    </div>
  );
};
