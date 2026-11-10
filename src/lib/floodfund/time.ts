import type { HourlyRain } from "./types";

export const HOUR_MS = 3_600_000;

/** Round half up to two decimals (identical formula in backend/ml/common.py). */
export function round2(value: number): number {
  return Math.floor(value * 100 + 0.5) / 100;
}

export interface HourlySeries {
  /** Unix seconds, UTC. Each value is the precipitation sum of the PRECEDING hour. */
  timesUnix: number[];
  values: (number | null)[];
  unit: string | null;
}

export type WindowResult =
  | { ok: true; hourly: HourlyRain[]; totalMm: number }
  | { ok: false; reason: string };

/**
 * Start of the "next 24 complete hours" window: the next full-hour boundary at
 * or after `nowMs`. At 10:25 the window is 11:00 -> 11:00 next day.
 */
export function rollingWindowStart(nowMs: number): number {
  return Math.ceil(nowMs / HOUR_MS) * HOUR_MS;
}

/** Start (UTC midnight, ms) of a `YYYY-MM-DD` day, or null if the string is not a real date. */
export function utcDayStart(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return ms;
}

/**
 * Select `hours` complete hourly intervals starting at `windowStartMs`.
 *
 * Open-Meteo hourly precipitation is the sum of the preceding hour, so the
 * interval [start + (i-1)h, start + i·h] is the value stamped start + i·h.
 * Every interval must be present, finite and non-negative. Missing data is
 * reported as a failure and is never converted to zero.
 */
export function selectWindow(series: HourlySeries, windowStartMs: number, hours = 24): WindowResult {
  if (series.unit !== "mm") {
    return { ok: false, reason: `Unexpected precipitation unit "${series.unit ?? "missing"}" (expected mm).` };
  }
  if (!Array.isArray(series.timesUnix) || !Array.isArray(series.values) || series.timesUnix.length !== series.values.length) {
    return { ok: false, reason: "The provider returned time and precipitation arrays of different lengths." };
  }
  if (!Number.isFinite(windowStartMs) || windowStartMs % HOUR_MS !== 0) {
    return { ok: false, reason: "The forecast window does not start on a full hour." };
  }
  const lookup = new Map<number, number | null>();
  for (let i = 0; i < series.timesUnix.length; i++) {
    const t = series.timesUnix[i];
    if (typeof t !== "number" || !Number.isInteger(t)) {
      return { ok: false, reason: "The provider returned an invalid timestamp." };
    }
    lookup.set(t, series.values[i]);
  }
  const startSec = windowStartMs / 1000;
  const hourly: HourlyRain[] = [];
  let total = 0;
  for (let i = 1; i <= hours; i++) {
    const endSec = startSec + i * 3600;
    const endIso = new Date(endSec * 1000).toISOString();
    if (!lookup.has(endSec)) {
      return { ok: false, reason: `The provider returned no interval ending ${endIso}. Missing data is not treated as zero.` };
    }
    const v = lookup.get(endSec);
    if (v === null || v === undefined) {
      return { ok: false, reason: `Rainfall for the hour ending ${endIso} is missing. Missing data is not treated as zero.` };
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, reason: `Rainfall for the hour ending ${endIso} is not a valid non-negative number.` };
    }
    hourly.push({
      intervalStart: new Date((endSec - 3600) * 1000).toISOString(),
      intervalEnd: endIso,
      precipitationMm: v,
    });
    total += v;
  }
  return { ok: true, hourly, totalMm: round2(total) };
}
