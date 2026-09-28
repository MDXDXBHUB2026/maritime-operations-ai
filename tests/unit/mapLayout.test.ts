import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_COUNT,
  layoutLabels,
  overlaps,
  type LabelRequest,
} from '../../src/components/charts/labelLayout';
import { motionAt, motionPlan } from '../../src/services/vesselMotion';
import type { Vessel } from '../../src/types/maritime';

const bounds = { x: 0, y: 0, w: 1000, h: 500 };

describe('Label layout', () => {
  it('places a dense cluster without any overlapping labels', () => {
    // Five markers within ~20 units (like the Dubai / Hormuz cluster).
    const pts = [
      [500, 250],
      [508, 256],
      [515, 244],
      [520, 262],
      [496, 262],
    ];
    const requests: LabelRequest[] = pts.map(([x, y], i) => ({
      id: `v${i}`,
      x,
      y,
      width: 60,
      height: 13,
    }));
    const markers = pts.map(([x, y]) => ({ x: x - 7, y: y - 7, w: 14, h: 14 }));
    const placed = [...layoutLabels(requests, { bounds, markers }).values()];
    const shown = placed.filter((p) => !p.hidden);
    expect(shown.length).toBe(5);
    for (let i = 0; i < shown.length; i++) {
      for (let j = i + 1; j < shown.length; j++) {
        expect(overlaps(shown[i].box, shown[j].box, 0)).toBe(false);
      }
      for (const m of markers) expect(overlaps(shown[i].box, m, 0)).toBe(false);
    }
    expect(shown.some((p) => p.leader)).toBe(true); // outer ring used, with leader lines
  });

  it('keeps labels out of reserved areas and inside bounds', () => {
    const reserved = [{ x: 0, y: 0, w: 1000, h: 40 }];
    const placed = layoutLabels([{ id: 'a', x: 500, y: 45, width: 60, height: 13 }], {
      bounds,
      markers: [],
      reserved,
    }).get('a')!;
    expect(placed.hidden).toBe(false);
    expect(overlaps(placed.box, reserved[0], 0)).toBe(false);
  });

  it('keeps the previous position when still free (no jumping)', () => {
    const req = { id: 'a', x: 500, y: 250, width: 60, height: 13 };
    const previous = new Map([['a', 3]]);
    expect(layoutLabels([req], { bounds, markers: [], previous }).get('a')!.candidate).toBe(3);
  });

  it('hides a label only when no candidate is free', () => {
    const req = { id: 'a', x: 500, y: 250, width: 60, height: 13 };
    const everything = [{ x: 0, y: 0, w: 1000, h: 500 }];
    const placed = layoutLabels([req], { bounds, markers: [], reserved: everything }).get('a')!;
    expect(placed.hidden).toBe(true);
    expect(CANDIDATE_COUNT).toBe(24);
  });
});

describe('Vessel motion', () => {
  const underway = {
    vessel_id: 'VES-003',
    vessel_name: 'MV Meridian',
    operational_status: 'Underway',
    speed_knots: 13.9,
    latitude: 26.28,
    longitude: 56.34,
    destination_port: 'Singapore',
  } as Vessel;

  it('stays at the reported position at the snapshot time', () => {
    const m = motionAt(underway, 0);
    expect(m.position).toEqual([56.34, 26.28]);
    expect(m.moving).toBe(true);
    expect(m.course).not.toBeNull();
  });

  it('advances along the route at reported speed and arrives at the berth', () => {
    const total = motionPlan(underway)!.totalNm;
    const later = motionAt(underway, 10);
    expect(later.progressNm).toBeCloseTo(139, 0);
    expect(later.remaining.length).toBeGreaterThan(1);
    const end = motionAt(underway, total / 13.9 + 1);
    expect(end.arrived).toBe(true);
    expect(end.position).toEqual([103.84, 1.26]);
    expect(end.moving).toBe(false);
  });

  it('does not move vessels in port, at anchor or without a known destination', () => {
    for (const v of [
      { ...underway, operational_status: 'In Port' },
      { ...underway, operational_status: 'At Anchorage' },
      { ...underway, destination_port: 'Unknown Port' },
      { ...underway, speed_knots: 0 },
    ] as Vessel[]) {
      const m = motionAt(v, 48);
      expect(m.moving).toBe(false);
      expect(m.position).toEqual([56.34, 26.28]);
    }
  });
});
