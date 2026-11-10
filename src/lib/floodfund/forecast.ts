import { config } from "../config";
import { ProviderError, providerJson } from "./http";
import { HOUR_MS, rollingWindowStart, selectWindow, type HourlySeries } from "./time";
import type { Forecast } from "./types";

/**
 * Live ECMWF AIFS rainfall forecast for Karachi via Open-Meteo.
 *
 * Freshness is verified, not assumed:
 *  1. Read the provider's model metadata (meta.json) for the latest run's
 *     initialisation and availability times.
 *  2. Request exactly that run from the Single Runs API (`run=`).
 * Only a forecast pinned to a known run can be "fresh". If pinning fails we
 * fall back to the stitched live endpoint and label the result "unverified",
 * which can be displayed but cannot trigger the funding simulation.
 * `generationtime_ms` is an API timing value and is never used as a model time.
 */

export interface RunMeta {
  initMs: number;
  availableMs: number | null;
  stepSeconds: number | null;
}

export interface GridPoint {
  latitude: number;
  longitude: number;
  elevationM: number | null;
}

export interface RawForecast {
  retrievedAtMs: number;
  meta: RunMeta | null;
  /** True when the series was requested for the exact run in `meta`. */
  pinned: boolean;
  pinProblem: string | null;
  series: HourlySeries;
  grid: GridPoint | null;
}

const SOURCE = "Open-Meteo (ECMWF open data)";
const MODEL_NAME = "ECMWF AIFS Single 0.25°";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseRunMeta(json: unknown): RunMeta {
  const o = asRecord(json);
  const init = o?.last_run_initialisation_time;
  if (typeof init !== "number" || !Number.isFinite(init) || init <= 0) {
    throw new ProviderError("Open-Meteo model metadata did not contain a run initialisation time.");
  }
  const avail = o?.last_run_availability_time;
  const step = o?.temporal_resolution_seconds;
  return {
    initMs: init * 1000,
    availableMs: typeof avail === "number" && Number.isFinite(avail) && avail > 0 ? avail * 1000 : null,
    stepSeconds: typeof step === "number" && Number.isFinite(step) && step > 0 ? step : null,
  };
}

export function parseSeries(json: unknown): { series: HourlySeries; grid: GridPoint | null } {
  const o = asRecord(json);
  const hourly = asRecord(o?.hourly);
  const units = asRecord(o?.hourly_units);
  const time = hourly?.time;
  const precip = hourly?.precipitation;
  if (!Array.isArray(time) || !Array.isArray(precip)) {
    throw new ProviderError("Open-Meteo response did not contain hourly precipitation.");
  }
  if (units?.time !== "unixtime") {
    throw new ProviderError("Open-Meteo response did not use the requested unixtime format.");
  }
  const lat = o?.latitude;
  const lon = o?.longitude;
  const elev = o?.elevation;
  return {
    series: {
      timesUnix: time as number[],
      values: precip as (number | null)[],
      unit: typeof units?.precipitation === "string" ? units.precipitation : null,
    },
    grid:
      typeof lat === "number" && typeof lon === "number"
        ? { latitude: lat, longitude: lon, elevationM: typeof elev === "number" ? elev : null }
        : null,
  };
}

function baseQuery(): string {
  const { latitude, longitude } = config.area;
  return `latitude=${latitude}&longitude=${longitude}&hourly=precipitation&models=${config.providers.aifsModelId}&timezone=GMT&timeformat=unixtime`;
}

/** Fetch from the provider (no cache). Throws ProviderError if nothing usable can be retrieved. */
export async function fetchRawForecast(): Promise<RawForecast> {
  let meta: RunMeta | null = null;
  let pinProblem: string | null = null;
  try {
    meta = parseRunMeta(await providerJson(config.providers.openMeteoMetaUrl, "open-meteo meta"));
  } catch (err) {
    pinProblem = `Model-run metadata could not be read (${err instanceof Error ? err.message : "unknown error"}).`;
  }

  if (meta) {
    const run = new Date(meta.initMs).toISOString().slice(0, 16);
    try {
      const json = await providerJson(
        `${config.providers.openMeteoSingleRunsUrl}?${baseQuery()}&run=${run}&forecast_hours=72`,
        "open-meteo single-run",
      );
      const { series, grid } = parseSeries(json);
      return { retrievedAtMs: Date.now(), meta, pinned: true, pinProblem: null, series, grid };
    } catch (err) {
      pinProblem = `The run initialised ${run}Z could not be requested directly (${err instanceof Error ? err.message : "unknown error"}).`;
    }
  }

  const json = await providerJson(`${config.providers.openMeteoLiveUrl}?${baseQuery()}&forecast_days=3`, "open-meteo live");
  const { series, grid } = parseSeries(json);
  return { retrievedAtMs: Date.now(), meta, pinned: false, pinProblem, series, grid };
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/** Readable UTC time for messages, e.g. "2026-11-10 06:00 UTC". */
function readable(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function baseForecast(nowMs: number): Forecast {
  return {
    dataKind: "live",
    scenarioId: null,
    areaId: config.area.id,
    requestedLocation: { latitude: config.area.latitude, longitude: config.area.longitude },
    gridLocation: null,
    source: SOURCE,
    model: MODEL_NAME,
    modelId: config.providers.aifsModelId,
    modelRunAt: null,
    providerAvailableAt: null,
    retrievedAt: new Date(nowMs).toISOString(),
    windowStart: null,
    windowEnd: null,
    hourly: [],
    totalMm: null,
    unit: "mm",
    status: "unavailable",
    statusReason: "",
    freshnessVerified: false,
    runAgeHours: null,
    maxRunAgeHours: config.modelMaxRunAgeHours,
    nativeStepHours: null,
    notes: [],
  };
}

export function unavailableForecast(reason: string, nowMs: number): Forecast {
  return {
    ...baseForecast(nowMs),
    status: "unavailable",
    statusReason: reason,
    notes: ["No forecast values are shown because the provider could not be reached. Nothing has been substituted."],
  };
}

/** Pure: turn a provider payload into the dashboard forecast for the window starting after `nowMs`. */
export function buildLiveForecast(raw: RawForecast, nowMs: number): Forecast {
  const f = baseForecast(nowMs);
  f.retrievedAt = new Date(raw.retrievedAtMs).toISOString();
  f.gridLocation = raw.grid;
  f.nativeStepHours = raw.meta?.stepSeconds ? raw.meta.stepSeconds / 3600 : null;

  const windowStartMs = rollingWindowStart(nowMs);
  f.windowStart = new Date(windowStartMs).toISOString();
  f.windowEnd = new Date(windowStartMs + 24 * HOUR_MS).toISOString();

  f.notes.push("AIFS is a global model on a 0.25° grid (about 28 km). It cannot resolve street-level rainfall or flooding.");
  if (f.nativeStepHours && f.nativeStepHours > 1) {
    f.notes.push(
      `AIFS output on Open-Meteo is ${f.nativeStepHours}-hourly. The hourly values are Open-Meteo's interpolation, so a rolling window that does not start at 00, 06, 12 or 18 UTC includes interpolated fractions.`,
    );
  }
  f.notes.push("Each hourly value is the rainfall total of the preceding hour (Open-Meteo convention).");

  const sel = selectWindow(raw.series, windowStartMs, 24);
  if (!sel.ok) {
    f.status = "invalid";
    f.statusReason = `The forecast could not be validated: ${sel.reason}`;
    return f;
  }
  f.hourly = sel.hourly;
  f.totalMm = sel.totalMm;

  if (!raw.pinned || !raw.meta) {
    f.status = "unverified";
    f.statusReason = `Forecast values were received, but the model run behind them could not be verified. ${raw.pinProblem ?? ""} It is shown for information only and cannot trigger the funding simulation.`.replace(/\s+/g, " ").trim();
    if (raw.meta) {
      f.notes.push(`Provider metadata lists the latest run as ${readable(raw.meta.initMs)}, but this response could not be tied to that run.`);
    }
    return f;
  }

  const ageHours = (nowMs - raw.meta.initMs) / HOUR_MS;
  f.modelRunAt = iso(raw.meta.initMs);
  f.providerAvailableAt = iso(raw.meta.availableMs);
  f.runAgeHours = Math.round(ageHours * 10) / 10;

  if (ageHours < -0.25) {
    f.status = "unverified";
    f.statusReason = "The provider reports a model run time in the future, so freshness cannot be verified.";
    return f;
  }
  f.freshnessVerified = true;
  if (ageHours > config.modelMaxRunAgeHours) {
    f.status = "stale";
    f.statusReason = `The latest AIFS run is ${f.runAgeHours} h old, beyond the ${config.modelMaxRunAgeHours} h limit. A stale forecast cannot trigger the funding simulation.`;
  } else {
    f.status = "fresh";
    f.statusReason = `Verified AIFS run initialised ${readable(raw.meta.initMs)} (${f.runAgeHours} h old, limit ${config.modelMaxRunAgeHours} h).`;
  }
  return f;
}

type CacheState = { raw: RawForecast | null; inflight: Promise<RawForecast> | null };
const g = globalThis as typeof globalThis & { __ffForecastCache?: CacheState };
const state: CacheState = (g.__ffForecastCache ??= { raw: null, inflight: null });

export function resetForecastCache(): void {
  state.raw = null;
  state.inflight = null;
}

/**
 * Cached live forecast. The provider payload is cached briefly; the 24 h window
 * is always recomputed for the current time, and `retrievedAt` stays the real fetch time.
 * Never throws: provider failures become an explicit "unavailable" forecast.
 */
export async function getLiveForecast(options: { nowMs?: number; forceRefresh?: boolean } = {}): Promise<Forecast> {
  const nowMs = options.nowMs ?? Date.now();
  const fresh =
    state.raw !== null && !options.forceRefresh && Date.now() - state.raw.retrievedAtMs < config.forecastCacheSeconds * 1000;
  try {
    if (!fresh) {
      state.inflight ??= fetchRawForecast().finally(() => {
        state.inflight = null;
      });
      state.raw = await state.inflight;
    }
    return buildLiveForecast(state.raw as RawForecast, nowMs);
  } catch (err) {
    state.raw = null;
    const message = err instanceof Error ? err.message : "Unknown provider error.";
    return unavailableForecast(`The live forecast provider is unavailable: ${message}`, nowMs);
  }
}
