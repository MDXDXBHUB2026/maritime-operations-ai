/**
 * Collision-free label placement for map markers.
 *
 * Greedy placement in priority order. For each label, candidate positions are tried around the
 * marker (8 directions) on increasing rings; outer rings are drawn with a leader line. A candidate
 * is accepted when it stays inside the usable bounds and does not overlap already placed labels,
 * any marker, or reserved areas (toolbar, legend, status bar). The previously used candidate is
 * tried first so labels do not jump while vessels move. Labels with no free slot are hidden
 * (the vessel stays visible and can be inspected on hover).
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelRequest {
  id: string;
  /** Marker centre. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedLabel {
  id: string;
  box: Box;
  /** True when the label sits on an outer ring and needs a leader line to its marker. */
  leader: boolean;
  hidden: boolean;
  candidate: number;
}

export const RINGS = [10, 24, 40];
const DIRECTIONS: [number, number][] = [
  [1, 0], // E
  [-1, 0], // W
  [0, -1], // N
  [0, 1], // S
  [1, -1], // NE
  [1, 1], // SE
  [-1, -1], // NW
  [-1, 1], // SW
];

export function overlaps(a: Box, b: Box, pad = 1.5): boolean {
  return (
    a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad
  );
}

function inside(box: Box, bounds: Box): boolean {
  return (
    box.x >= bounds.x &&
    box.y >= bounds.y &&
    box.x + box.w <= bounds.x + bounds.w &&
    box.y + box.h <= bounds.y + bounds.h
  );
}

export function candidateBox(req: LabelRequest, index: number): Box {
  const ring = RINGS[Math.floor(index / DIRECTIONS.length)];
  const [dx, dy] = DIRECTIONS[index % DIRECTIONS.length];
  const diag = dx !== 0 && dy !== 0 ? 0.72 : 1;
  const ox = dx * ring * diag;
  const oy = dy * ring * diag;
  const x = dx > 0 ? req.x + ox : dx < 0 ? req.x + ox - req.width : req.x - req.width / 2;
  const y = dy > 0 ? req.y + oy : dy < 0 ? req.y + oy - req.height : req.y - req.height / 2;
  return { x, y, w: req.width, h: req.height };
}

export const CANDIDATE_COUNT = RINGS.length * DIRECTIONS.length;

export function layoutLabels(
  requests: LabelRequest[],
  options: {
    bounds: Box;
    markers: Box[];
    reserved?: Box[];
    previous?: Map<string, number>;
  }
): Map<string, PlacedLabel> {
  const placed: Box[] = [];
  const result = new Map<string, PlacedLabel>();
  const blockers = [...options.markers, ...(options.reserved ?? [])];

  for (const req of requests) {
    const order = Array.from({ length: CANDIDATE_COUNT }, (_, i) => i);
    const prev = options.previous?.get(req.id);
    if (prev !== undefined && prev >= 0 && prev < CANDIDATE_COUNT) {
      order.splice(order.indexOf(prev), 1);
      order.unshift(prev);
    }
    let chosen: PlacedLabel | null = null;
    for (const index of order) {
      const box = candidateBox(req, index);
      if (!inside(box, options.bounds)) continue;
      if (placed.some((b) => overlaps(box, b))) continue;
      if (blockers.some((b) => overlaps(box, b, 0.5))) continue;
      chosen = {
        id: req.id,
        box,
        leader: index >= DIRECTIONS.length,
        hidden: false,
        candidate: index,
      };
      break;
    }
    if (chosen) {
      placed.push(chosen.box);
      result.set(req.id, chosen);
    } else {
      result.set(req.id, {
        id: req.id,
        box: candidateBox(req, 0),
        leader: false,
        hidden: true,
        candidate: -1,
      });
    }
  }
  return result;
}

/** Point on the box edge nearest to (x, y), used to anchor leader lines. */
export function nearestPointOnBox(box: Box, x: number, y: number): [number, number] {
  return [Math.max(box.x, Math.min(x, box.x + box.w)), Math.max(box.y, Math.min(y, box.y + box.h))];
}
