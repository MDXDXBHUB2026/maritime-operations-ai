/**
 * Sea-lane routing for the operational theatre (Arabian Gulf – Red Sea – Indian Ocean – Malacca).
 *
 * A small graph of open-water waypoints connected by legs that stay off land (validated
 * against the basemap coastline in tests/unit/seaRoutes.test.ts). Vessel routes are the
 * shortest path through this graph from a vessel's position to its destination port.
 * Coordinates are [longitude, latitude].
 */

export type LonLat = [number, number];

export const WAYPOINTS: Record<string, LonLat> = {
  // Arabian Gulf
  KWI_APP: [48.35, 29.2],
  GULF_N: [49.8, 28.2],
  GULF_NC: [51.0, 27.4],
  GULF_C: [52.4, 26.6],
  DOH_APP: [52.0, 25.5],
  GULF_S: [53.6, 25.6],
  ABU_APP: [54.4, 25.0],
  JEA_APP: [54.85, 25.15],
  DXB_ANCH: [55.2, 25.4],
  GULF_E: [55.9, 26.2],
  // Strait of Hormuz & Gulf of Oman
  HORMUZ: [56.45, 26.55],
  HORMUZ_S: [56.9, 26.0],
  KFK_APP: [56.65, 25.35],
  SOHAR_APP: [57.0, 24.55],
  GOO: [58.1, 24.8],
  MCT_APP: [58.8, 23.85],
  RAS_HADD: [60.2, 22.7],
  // Oman coast to Salalah
  MASIRAH: [59.6, 20.2],
  OMAN_S: [57.6, 17.8],
  SLL_APP: [54.2, 16.6],
  // Arabian Sea
  ARAB_N: [63.0, 21.5],
  ARAB_C: [63.0, 17.0],
  ARAB_S: [58.0, 14.8],
  // Red Sea & Gulf of Aden
  JED_APP: [38.8, 21.4],
  RED_C: [39.8, 19.0],
  RED_S: [41.2, 16.2],
  RED_SS: [42.4, 14.2],
  BAB: [43.3, 12.6],
  ADEN: [45.6, 12.1],
  ADEN_E: [49.5, 12.9],
  SOCOTRA_N: [53.5, 13.4],
  // India west coast
  BOM_APP: [72.5, 18.9],
  IND_W1: [72.6, 15.5],
  IND_W2: [73.9, 12.5],
  IND_W3: [75.4, 9.4],
  COMORIN: [77.4, 7.4],
  // Sri Lanka, India east coast, Bay of Bengal
  SL_S: [80.6, 5.4],
  SL_SE: [82.1, 5.9],
  SL_E: [82.4, 7.6],
  IND_E1: [81.2, 10.8],
  MAA_APP: [80.6, 13.0],
  BOB_S: [87.0, 6.0],
  NICOBAR_S: [93.0, 5.8],
  SUMATRA_N: [95.6, 6.3],
  // Strait of Malacca & Singapore
  MAL_N: [98.0, 5.7],
  MAL_C1: [99.6, 4.1],
  MAL_C2: [100.7, 2.9],
  PKL_APP: [101.1, 2.95],
  MAL_S: [102.4, 1.85],
  SIN_APP: [103.6, 1.15],
};

export const LEGS: [string, string][] = [
  ['KWI_APP', 'GULF_N'],
  ['GULF_N', 'GULF_NC'],
  ['GULF_NC', 'GULF_C'],
  ['GULF_C', 'DOH_APP'],
  ['GULF_C', 'GULF_S'],
  ['DOH_APP', 'GULF_S'],
  ['GULF_S', 'ABU_APP'],
  ['ABU_APP', 'JEA_APP'],
  ['JEA_APP', 'DXB_ANCH'],
  ['GULF_S', 'DXB_ANCH'],
  ['DXB_ANCH', 'GULF_E'],
  ['GULF_C', 'GULF_E'],
  ['GULF_E', 'HORMUZ'],
  ['HORMUZ', 'HORMUZ_S'],
  ['HORMUZ_S', 'KFK_APP'],
  ['HORMUZ_S', 'GOO'],
  ['KFK_APP', 'SOHAR_APP'],
  ['SOHAR_APP', 'GOO'],
  ['GOO', 'MCT_APP'],
  ['MCT_APP', 'RAS_HADD'],
  ['GOO', 'RAS_HADD'],
  ['RAS_HADD', 'MASIRAH'],
  ['MASIRAH', 'OMAN_S'],
  ['OMAN_S', 'SLL_APP'],
  ['RAS_HADD', 'ARAB_N'],
  ['ARAB_N', 'BOM_APP'],
  ['ARAB_N', 'ARAB_C'],
  ['ARAB_C', 'IND_W1'],
  ['ARAB_C', 'ARAB_S'],
  ['OMAN_S', 'ARAB_S'],
  ['ARAB_S', 'SLL_APP'],
  ['ARAB_S', 'SOCOTRA_N'],
  ['SLL_APP', 'SOCOTRA_N'],
  ['SOCOTRA_N', 'ADEN_E'],
  ['ADEN_E', 'ADEN'],
  ['ADEN', 'BAB'],
  ['BAB', 'RED_SS'],
  ['RED_SS', 'RED_S'],
  ['RED_S', 'RED_C'],
  ['RED_C', 'JED_APP'],
  ['BOM_APP', 'IND_W1'],
  ['IND_W1', 'IND_W2'],
  ['IND_W2', 'IND_W3'],
  ['IND_W3', 'COMORIN'],
  ['COMORIN', 'SL_S'],
  ['SL_S', 'SL_SE'],
  ['SL_SE', 'SL_E'],
  ['SL_E', 'IND_E1'],
  ['IND_E1', 'MAA_APP'],
  ['SL_S', 'BOB_S'],
  ['SL_SE', 'BOB_S'],
  ['BOB_S', 'NICOBAR_S'],
  ['NICOBAR_S', 'SUMATRA_N'],
  ['SUMATRA_N', 'MAL_N'],
  ['MAL_N', 'MAL_C1'],
  ['MAL_C1', 'MAL_C2'],
  ['MAL_C2', 'PKL_APP'],
  ['MAL_C2', 'MAL_S'],
  ['PKL_APP', 'MAL_S'],
  ['MAL_S', 'SIN_APP'],
];

/** Port positions (berth / terminal) and the waypoint that serves as their sea approach. */
export const PORTS: Record<string, { position: LonLat; approach: string }> = {
  'Jebel Ali': { position: [55.05, 24.99], approach: 'JEA_APP' },
  'Khalifa Port': { position: [54.65, 24.8], approach: 'ABU_APP' },
  'Khor Fakkan': { position: [56.36, 25.35], approach: 'KFK_APP' },
  Sohar: { position: [56.74, 24.35], approach: 'SOHAR_APP' },
  Muscat: { position: [58.59, 23.61], approach: 'MCT_APP' },
  Salalah: { position: [54.0, 16.95], approach: 'SLL_APP' },
  Kuwait: { position: [48.0, 29.38], approach: 'KWI_APP' },
  'Hamad Port': { position: [51.61, 25.02], approach: 'DOH_APP' },
  Jeddah: { position: [39.17, 21.49], approach: 'JED_APP' },
  Mumbai: { position: [72.88, 19.08], approach: 'BOM_APP' },
  Chennai: { position: [80.24, 12.97], approach: 'MAA_APP' },
  'Port Klang': { position: [101.39, 3.0], approach: 'PKL_APP' },
  Singapore: { position: [103.84, 1.26], approach: 'SIN_APP' },
};

const EARTH_RADIUS_NM = 3440.065;

export function distanceNm(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial course from a to b in degrees true (0 = north, 90 = east). */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const ADJACENCY: Record<string, string[]> = (() => {
  const adj: Record<string, string[]> = {};
  for (const id of Object.keys(WAYPOINTS)) adj[id] = [];
  for (const [a, b] of LEGS) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
})();

export function nearestWaypoint(position: LonLat): string {
  let best = '';
  let bestDist = Infinity;
  for (const [id, wp] of Object.entries(WAYPOINTS)) {
    const d = distanceNm(position, wp);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

/** Dijkstra over the waypoint graph. Returns waypoint ids from start to goal (inclusive). */
export function shortestWaypointPath(start: string, goal: string): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | undefined> = {};
  const open = new Set(Object.keys(WAYPOINTS));
  for (const id of open) dist[id] = Infinity;
  dist[start] = 0;
  while (open.size > 0) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      if (dist[id] < best) {
        best = dist[id];
        current = id;
      }
    }
    if (!current || current === goal) break;
    open.delete(current);
    for (const next of ADJACENCY[current]) {
      if (!open.has(next)) continue;
      const alt = dist[current] + distanceNm(WAYPOINTS[current], WAYPOINTS[next]);
      if (alt < dist[next]) {
        dist[next] = alt;
        prev[next] = current;
      }
    }
  }
  if (dist[goal] === Infinity) return [];
  const path = [goal];
  while (path[0] !== start) {
    const p = prev[path[0]];
    if (!p) return [];
    path.unshift(p);
  }
  return path;
}

/**
 * Sea route from a position to a named destination port: position -> nearest waypoint ->
 * shortest waypoint path -> port approach -> berth. Returns null if the port is unknown.
 */
export function seaRoute(from: LonLat, destinationPort: string): LonLat[] | null {
  const port = PORTS[destinationPort];
  if (!port) return null;
  const startWp = nearestWaypoint(from);
  const path = shortestWaypointPath(startWp, port.approach);
  if (path.length === 0) return null;
  const points: LonLat[] = [from, ...path.map((id) => WAYPOINTS[id]), port.position];
  // Drop a leading waypoint that lies "behind" the vessel (closer to the destination to skip it).
  if (points.length > 3) {
    const skip = distanceNm(from, points[2]) < distanceNm(points[1], points[2]);
    if (skip) points.splice(1, 1);
  }
  return points;
}
