import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEGS,
  PORTS,
  WAYPOINTS,
  distanceNm,
  seaRoute,
  shortestWaypointPath,
  type LonLat,
} from '../../src/services/seaRoutes';

type Ring = number[][];

// Coastline used by the map basemap (Natural Earth, public/data/world_land.json).
const land = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/data/world_land.json'), 'utf-8')
) as { features: { geometry: { type: string; coordinates: unknown } }[] };

const polygons: Ring[][] = land.features.flatMap((f) =>
  f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates as Ring[]]
    : (f.geometry.coordinates as Ring[][])
);

function inRing(p: LonLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function onLand(p: LonLat): boolean {
  return polygons.some((poly) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h)));
}

/** Sample a leg every ~5 nm and return the first sampled point that falls on land. */
function landCrossing(a: LonLat, b: LonLat): LonLat | null {
  const steps = Math.max(2, Math.ceil(distanceNm(a, b) / 5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (onLand(p)) return p;
  }
  return null;
}

describe('Sea-lane network', () => {
  it('has every waypoint in open water', () => {
    const onShore = Object.entries(WAYPOINTS).filter(([, p]) => onLand(p));
    expect(onShore.map(([id]) => id)).toEqual([]);
  });

  it('has no leg crossing land', () => {
    const crossing = LEGS.map(([a, b]) => ({
      leg: `${a}-${b}`,
      at: landCrossing(WAYPOINTS[a], WAYPOINTS[b]),
    }))
      .filter((x) => x.at !== null)
      .map((x) => `${x.leg} @ ${x.at}`);
    expect(crossing).toEqual([]);
  });

  it('connects every port to every other port', () => {
    const approaches = Object.values(PORTS).map((p) => p.approach);
    for (const a of approaches) {
      for (const b of approaches) {
        expect(shortestWaypointPath(a, b).length).toBeGreaterThan(0);
      }
    }
  });

  it('routes through Hormuz from the Gulf to Singapore and ends at the berth', () => {
    const route = seaRoute([54.65, 24.8], 'Singapore');
    expect(route).not.toBeNull();
    const r = route as LonLat[];
    expect(r[r.length - 1]).toEqual(PORTS.Singapore.position);
    expect(r).toContainEqual(WAYPOINTS.HORMUZ);
    expect(r).toContainEqual(WAYPOINTS.SUMATRA_N);
  });

  it('returns null for an unknown port', () => {
    expect(seaRoute([55, 25], 'Atlantis')).toBeNull();
  });
});

describe('Routes for the fleet dataset', () => {
  const vessels = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../public/data/vessels.json'), 'utf-8')
  ) as {
    vessel_id: string;
    operational_status: string;
    longitude: number;
    latitude: number;
    destination_port: string;
  }[];
  const moving = vessels.filter((v) => ['Underway', 'Delayed'].includes(v.operational_status));

  it('finds a sea route for every vessel under way', () => {
    expect(moving.length).toBeGreaterThan(0);
    for (const v of moving) {
      expect(seaRoute([v.longitude, v.latitude], v.destination_port), v.vessel_id).not.toBeNull();
    }
  });

  it('keeps every route off land outside the port approaches (12 nm)', () => {
    const problems: string[] = [];
    for (const v of moving) {
      const route = seaRoute([v.longitude, v.latitude], v.destination_port) as LonLat[];
      const start = route[0];
      const end = route[route.length - 1];
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        const steps = Math.max(2, Math.ceil(distanceNm(a, b) / 5));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const p: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (distanceNm(p, start) < 12 || distanceNm(p, end) < 12) continue;
          if (onLand(p)) {
            problems.push(`${v.vessel_id} leg ${i} @ ${p.map((x) => x.toFixed(2))}`);
            break;
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
