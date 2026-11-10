import { config } from "../config";
import { HOUR_MS, rollingWindowStart } from "./time";
import type { DataStatus, Forecast, HourlyRain, ScenarioId, ScenarioInfo } from "./types";

/**
 * DEMO SCENARIO MODE - deterministic, synthetic values that exist only so the
 * funding rule can be demonstrated on a calm day. They are always labelled
 * DEMO and are never mixed into or substituted for live data.
 *
 * Hourly values are stored in tenths of a millimetre (integers) so each
 * scenario's 24 values add up to its total exactly.
 */
interface ScenarioDef {
  id: ScenarioId;
  name: string;
  description: string;
  expected: string;
  dataStatus: DataStatus;
  tenths: number[];
}

const STORM = [0, 4, 8, 16, 28, 42, 60, 84, 106, 120, 112, 94, 76, 60, 46, 34, 24, 16, 12, 8, 5, 3, 2, 0];

const DEFS: ScenarioDef[] = [
  {
    id: "calm",
    name: "Calm",
    description: "40 mm in 24 h from fresh data.",
    expected: "Below the 80 mm example threshold. No allocation.",
    dataStatus: "fresh",
    tenths: [0, 0, 2, 5, 8, 12, 18, 24, 30, 36, 40, 42, 38, 32, 26, 22, 18, 14, 11, 8, 6, 4, 3, 1],
  },
  {
    id: "severe-storm",
    name: "Severe storm",
    description: "96 mm in 24 h from fresh data.",
    expected: "One simulated PKR 500,000 allocation.",
    dataStatus: "fresh",
    tenths: STORM,
  },
  {
    id: "exact-threshold",
    name: "Exact threshold",
    description: "Exactly 80 mm in 24 h from fresh data.",
    expected: "80 mm meets the rule (>=). One simulated allocation.",
    dataStatus: "fresh",
    tenths: [0, 2, 6, 12, 22, 34, 50, 70, 88, 100, 94, 80, 64, 50, 38, 28, 20, 14, 10, 7, 5, 3, 2, 1],
  },
  {
    id: "stale-data",
    name: "Stale data",
    description: "96 mm in 24 h, but the model run is too old.",
    expected: "Cannot evaluate. No allocation.",
    dataStatus: "stale",
    tenths: STORM,
  },
];

export const SCENARIO_IDS: ScenarioId[] = DEFS.map((d) => d.id);

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (SCENARIO_IDS as string[]).includes(value);
}

function totalOf(def: ScenarioDef): number {
  return def.tenths.reduce((a, b) => a + b, 0) / 10;
}

export function listScenarios(): ScenarioInfo[] {
  return DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    totalMm: totalOf(d),
    dataStatus: d.dataStatus,
    expected: d.expected,
  }));
}

export function buildScenarioForecast(id: ScenarioId, nowMs: number): Forecast {
  const def = DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown scenario ${id}`);
  const start = rollingWindowStart(nowMs);
  const hourly: HourlyRain[] = def.tenths.map((t, i) => ({
    intervalStart: new Date(start + i * HOUR_MS).toISOString(),
    intervalEnd: new Date(start + (i + 1) * HOUR_MS).toISOString(),
    precipitationMm: t / 10,
  }));
  const stale = def.dataStatus === "stale";
  const runAgeHours = stale ? config.modelMaxRunAgeHours + 12 : 7;
  const runMs = Math.floor((nowMs - runAgeHours * HOUR_MS) / HOUR_MS) * HOUR_MS;
  return {
    dataKind: "demo",
    scenarioId: def.id,
    areaId: config.area.id,
    requestedLocation: { latitude: config.area.latitude, longitude: config.area.longitude },
    gridLocation: null,
    source: "DEMO SCENARIO (synthetic values, not weather data)",
    model: `Synthetic scenario "${def.name}"`,
    modelId: `demo-${def.id}`,
    modelRunAt: new Date(runMs).toISOString(),
    providerAvailableAt: null,
    retrievedAt: new Date(nowMs).toISOString(),
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(start + 24 * HOUR_MS).toISOString(),
    hourly,
    totalMm: totalOf(def),
    unit: "mm",
    status: def.dataStatus,
    statusReason: stale
      ? `DEMO: the simulated model run is ${Math.round((nowMs - runMs) / HOUR_MS)} h old, beyond the ${config.modelMaxRunAgeHours} h limit. A stale forecast cannot be evaluated.`
      : "DEMO: simulated fresh model run.",
    freshnessVerified: !stale,
    runAgeHours: Math.round(((nowMs - runMs) / HOUR_MS) * 10) / 10,
    maxRunAgeHours: config.modelMaxRunAgeHours,
    nativeStepHours: null,
    notes: [
      "These numbers are synthetic and deterministic. They are not a forecast and not a measurement.",
      "The scenario exists only to demonstrate the simulated funding rule.",
    ],
  };
}
