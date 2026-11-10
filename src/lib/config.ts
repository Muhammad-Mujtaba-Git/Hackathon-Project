/**
 * Central configuration for the FloodFund Karachi API (the web service's
 * equivalent of `config.py`). Every server module imports `config` from here;
 * nothing else reads `process.env` for application settings.
 *
 * Values come from `.env` in the project root (loaded by Next.js) or from the
 * hosting platform's environment. No API keys are required: Open-Meteo,
 * NASA POWER, NASA GIBS and OpenStreetMap tiles are public, keyless services.
 */

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? fallback : v.trim();
}

function num(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

export const config = {
  appEnv: str("APP_ENV", "development"),
  /** Comma-separated origins allowed to call /api/v1 from another site. Empty = same-origin only. */
  corsOrigins: str("CORS_ORIGINS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  forecastCacheSeconds: num("FORECAST_CACHE_SECONDS", 300, 0, 3600),
  satelliteCacheSeconds: num("SATELLITE_CACHE_SECONDS", 1800, 0, 86400),
  /** A model run older than this is "stale" and cannot trigger the funding simulation. */
  modelMaxRunAgeHours: num("MODEL_MAX_RUN_AGE_HOURS", 18, 1, 96),
  liveSchedulerEnabled: bool("LIVE_SCHEDULER_ENABLED", true),
  liveRefreshMinutes: num("LIVE_REFRESH_MINUTES", 15, 1, 1440),
  sessionActiveHours: num("SESSION_ACTIVE_HOURS", 24, 1, 720),
  httpTimeoutMs: num("HTTP_TIMEOUT_MS", 10000, 1000, 60000),
  httpMaxRetries: num("HTTP_MAX_RETRIES", 1, 0, 3),
  /** Trusted, locally produced model artifacts (written by backend/ml). Never user-uploaded. */
  artifactsDir: str("MODEL_ARTIFACTS_DIR", "backend/artifacts"),

  area: {
    id: "karachi",
    name: "Karachi",
    region: "Sindh",
    country: "Pakistan",
    latitude: 24.8607,
    longitude: 67.0011,
    note: "Single forecast point. The AIFS grid cell is about 0.25° (roughly 28 km) wide; this is not a street-level product.",
  },

  policy: {
    id: "KHI-RAIN-80MM-24H",
    name: "Karachi heavy-rainfall preparedness (demonstration)",
    areaId: "karachi",
    thresholdMm: num("POLICY_THRESHOLD_MM", 80, 1, 1000),
    windowHours: 24,
    allocationPkr: Math.round(num("POLICY_ALLOCATION_PKR", 500_000, 1, 1_000_000_000)),
    initialBudgetPkr: Math.round(num("POLICY_INITIAL_BUDGET_PKR", 2_000_000, 0, 2_000_000_000)),
    active: bool("POLICY_ACTIVE", true),
  },

  providers: {
    aifsModelId: "ecmwf_aifs025_single",
    openMeteoLiveUrl: "https://api.open-meteo.com/v1/ecmwf",
    openMeteoSingleRunsUrl: "https://single-runs-api.open-meteo.com/v1/forecast",
    openMeteoMetaUrl: "https://api.open-meteo.com/data/ecmwf_aifs025_single/static/meta.json",
    nasaPowerDailyUrl: "https://power.larc.nasa.gov/api/temporal/daily/point",
    gibsBaseUrl: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best",
    gibsLayer: "IMERG_Precipitation_Rate",
    gibsTileMatrixSet: "GoogleMapsCompatible_Level6",
    gibsMaxNativeZoom: 6,
  },

  /** Must match backend/app/config.py (fixed UTC-day benchmark alignment). */
  benchmark: {
    runHourUtc: 12,
    decisionCutoffHoursBeforeTarget: 2,
    assumedPublicationLagHours: 10,
    wetHourMm: 0.1,
  },
} as const;

export type AppConfig = typeof config;
