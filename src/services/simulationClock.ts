/**
 * Simulation clock.
 *
 * The synthetic datasets were generated around a fixed reference moment. To make the control
 * tower behave like a real-time system, every dataset timestamp is shifted ("rebased") by the
 * whole number of hours between that reference and the current wall-clock time. Relative timing
 * (event order, ETA variance, due dates, overdue flags) is preserved exactly; only the absolute
 * date moves. The data remains synthetic and is labelled as such in the UI.
 */

/** Moment the synthetic datasets describe as "now" (latest events are at 08:00 UTC). */
export const DATASET_REFERENCE_UTC = Date.UTC(2026, 6, 23, 9, 0, 0);

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Whole-hour offset so rebased times keep clean hour boundaries. */
export function computeOffsetMs(
  nowMs: number,
  referenceMs: number = DATASET_REFERENCE_UTC
): number {
  return Math.floor((nowMs - referenceMs) / HOUR_MS) * HOUR_MS;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(ms: number, withSeconds: boolean): string {
  const d = new Date(ms);
  const base = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getUTCSeconds())}` : base;
}

function formatDate(ms: number): string {
  return formatDateTime(ms, false).substring(0, 10);
}

/** Shift one timestamp string by offsetMs, preserving its format. Non-dates are returned unchanged. */
export function rebaseTimestamp(value: string, offsetMs: number): string {
  if (offsetMs === 0) return value;
  const m = DATE_TIME.exec(value);
  if (m) {
    const ms = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}Z`);
    return Number.isNaN(ms) ? value : formatDateTime(ms + offsetMs, m[4] !== undefined);
  }
  if (DATE_ONLY.test(value)) {
    const ms = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(ms) ? value : formatDate(ms + Math.round(offsetMs / DAY_MS) * DAY_MS);
  }
  return value;
}

/** Return a copy of each record with every top-level timestamp field rebased. */
export function rebaseRecords<T>(records: T[], offsetMs: number): T[] {
  if (offsetMs === 0) return records;
  return records.map((record) => {
    const out: Record<string, unknown> = { ...(record as Record<string, unknown>) };
    for (const [key, value] of Object.entries(out)) {
      if (typeof value === 'string') out[key] = rebaseTimestamp(value, offsetMs);
    }
    return out as T;
  });
}

/** Session-stable offset: computed once at load so data does not jump while the app is open. */
const SESSION_OFFSET_MS = computeOffsetMs(Date.now());

export const SimulationClock = {
  offsetMs: SESSION_OFFSET_MS,
  /** Dataset reference moment mapped onto the current timeline. */
  referenceMs: DATASET_REFERENCE_UTC + SESSION_OFFSET_MS,
  now: () => Date.now(),
  /** Parse a naive dataset timestamp as UTC milliseconds. */
  parseUtc: (value: string): number => {
    const m = DATE_TIME.exec(value);
    if (m) return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}Z`);
    if (DATE_ONLY.test(value)) return Date.parse(`${value}T00:00:00Z`);
    return Date.parse(value);
  },
};

/** Map a dataset-era timestamp (e.g. a hard-coded model reference) onto the current timeline. */
export function rebasedMs(datasetTimestamp: string): number {
  return SimulationClock.parseUtc(rebaseTimestamp(datasetTimestamp, SimulationClock.offsetMs));
}

/** Human-readable relative duration, e.g. "3h 20m ago" / "in 2d 4h". */
export function relativeTime(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60_000);
  let text: string;
  if (mins < 1) text = `${Math.max(1, Math.floor(abs / 1000))}s`;
  else if (mins < 60) text = `${mins}m`;
  else if (mins < 24 * 60) text = `${Math.floor(mins / 60)}h ${mins % 60}m`;
  else text = `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function formatUtcClock(ms: number): string {
  return `${formatDateTime(ms, true).replace('T', ' ')} UTC`;
}
