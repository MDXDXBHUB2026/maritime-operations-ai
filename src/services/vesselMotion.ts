/**
 * Vessel motion model (simulated).
 *
 * A vessel that is under way (status Underway or Delayed, speed > 0.5 kn) and has a known
 * destination port follows the sea-lane route from its last reported position to that port at
 * its reported speed over ground, starting at the dataset snapshot time. It stops at the berth.
 * All other vessels stay at their reported position. Positions are deterministic for a given
 * elapsed time, so the map, telemetry and every viewer agree.
 */
import type { Vessel } from '../types/maritime';
import { bearingDeg, distanceNm, seaRoute, type LonLat } from './seaRoutes';

export const MOVING_STATUSES = new Set(['Underway', 'Delayed']);
const MIN_SPEED_KN = 0.5;

interface Plan {
  route: LonLat[];
  cumulativeNm: number[];
  totalNm: number;
}

export interface VesselMotion {
  position: LonLat;
  /** Course over ground in degrees true; null when not moving. */
  course: number | null;
  moving: boolean;
  arrived: boolean;
  hasRoute: boolean;
  progressNm: number;
  totalNm: number;
  /** Hours to arrival at reported speed; null when not under way on a route. */
  etaHours: number | null;
  traveled: LonLat[];
  remaining: LonLat[];
}

const planCache = new Map<string, Plan | null>();

export function isUnderway(v: Vessel): boolean {
  return MOVING_STATUSES.has(v.operational_status) && v.speed_knots > MIN_SPEED_KN;
}

export function motionPlan(v: Vessel): Plan | null {
  if (!isUnderway(v)) return null;
  const key = `${v.vessel_id}|${v.longitude}|${v.latitude}|${v.destination_port}`;
  if (planCache.has(key)) return planCache.get(key) ?? null;
  const route = seaRoute([v.longitude, v.latitude], v.destination_port);
  let plan: Plan | null = null;
  if (route && route.length >= 2) {
    const cumulativeNm = [0];
    for (let i = 1; i < route.length; i++) {
      cumulativeNm.push(cumulativeNm[i - 1] + distanceNm(route[i - 1], route[i]));
    }
    plan = { route, cumulativeNm, totalNm: cumulativeNm[cumulativeNm.length - 1] };
  }
  planCache.set(key, plan);
  return plan;
}

/** Position of a vessel `elapsedHours` after the dataset snapshot. */
export function motionAt(v: Vessel, elapsedHours: number): VesselMotion {
  const start: LonLat = [v.longitude, v.latitude];
  const plan = motionPlan(v);
  if (!plan) {
    return {
      position: start,
      course: null,
      moving: false,
      arrived: false,
      hasRoute: false,
      progressNm: 0,
      totalNm: 0,
      etaHours: null,
      traveled: [start],
      remaining: [start],
    };
  }
  const travelled = Math.min(plan.totalNm, Math.max(0, elapsedHours) * v.speed_knots);
  const arrived = travelled >= plan.totalNm - 1e-6;
  let i = 0;
  while (i < plan.route.length - 2 && plan.cumulativeNm[i + 1] <= travelled) i++;
  const a = plan.route[i];
  const b = plan.route[i + 1];
  const legNm = plan.cumulativeNm[i + 1] - plan.cumulativeNm[i];
  const t = legNm > 0 ? Math.min(1, (travelled - plan.cumulativeNm[i]) / legNm) : 1;
  const position: LonLat = arrived
    ? plan.route[plan.route.length - 1]
    : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return {
    position,
    course: arrived ? null : bearingDeg(a, b),
    moving: !arrived,
    arrived,
    hasRoute: true,
    progressNm: travelled,
    totalNm: plan.totalNm,
    etaHours: arrived ? 0 : (plan.totalNm - travelled) / v.speed_knots,
    traveled: [...plan.route.slice(0, i + 1), position],
    remaining: arrived ? [position] : [position, ...plan.route.slice(i + 1)],
  };
}

/** Longest remaining voyage in the fleet, in hours at reported speed (for replay looping). */
export function longestVoyageHours(vessels: Vessel[]): number {
  let longest = 0;
  for (const v of vessels) {
    const plan = motionPlan(v);
    if (plan) longest = Math.max(longest, plan.totalNm / v.speed_knots);
  }
  return longest;
}
