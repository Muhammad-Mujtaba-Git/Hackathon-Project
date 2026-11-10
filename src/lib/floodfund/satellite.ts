import { config } from "../config";
import { providerFetch, providerText } from "./http";
import type { SatelliteLayer } from "./types";

/**
 * NASA GIBS / GPM IMERG satellite precipitation layer (observational context).
 *
 * The observation date is taken from GIBS' own "Domains" metadata for the
 * layer and then confirmed by requesting one real tile over Karachi. If either
 * step fails the layer is reported as unavailable - no placeholder imagery.
 */

const ATTRIBUTION = "Imagery: NASA EOSDIS GIBS · GPM IMERG precipitation";
const LAYER_TITLE = "Precipitation Rate (IMERG), daily";
const LEGEND_URL = "https://gibs.earthdata.nasa.gov/legends/GPM_Precipitation_Rate_H.svg";
const NOTES = [
  "Satellite-estimated precipitation for one past UTC day. It is observational context, not a forecast.",
  "It arrives with a delay and is not a confirmed flood map.",
  "Colours are not converted into rainfall totals and do not influence the funding rule.",
];

/** Latest date listed in a GIBS DescribeDomains response, e.g. `<Domain>2026-10-25/2026-11-09/P1D</Domain>`. */
export function parseLatestDomainDate(xml: string): string | null {
  const dates: string[] = [];
  for (const match of xml.matchAll(/<Domain>([^<]*)<\/Domain>/g)) {
    for (const part of match[1].split(",")) {
      const seg = part.trim().split("/");
      const end = (seg.length >= 2 ? seg[1] : seg[0]).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(end)) dates.push(end);
    }
  }
  dates.sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function tileXY(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (latitude * Math.PI) / 180;
  return {
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

function tileTemplate(date: string): string {
  const p = config.providers;
  return `${p.gibsBaseUrl}/${p.gibsLayer}/default/${date}/${p.gibsTileMatrixSet}/{z}/{y}/{x}.png`;
}

function dayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function unavailable(reason: string, nowMs: number): SatelliteLayer {
  return {
    status: "unavailable",
    statusReason: reason,
    source: "NASA GIBS (Global Imagery Browse Services)",
    layerName: config.providers.gibsLayer,
    layerTitle: LAYER_TITLE,
    observationTime: null,
    observationPeriod: null,
    observationAgeDays: null,
    tileUrlTemplate: null,
    tileMatrixSet: null,
    maxNativeZoom: null,
    legendUrl: null,
    attribution: ATTRIBUTION,
    retrievedAt: new Date(nowMs).toISOString(),
    notes: NOTES,
  };
}

async function tileExists(date: string): Promise<boolean> {
  const { x, y } = tileXY(config.area.latitude, config.area.longitude, 4);
  const url = tileTemplate(date).replace("{z}", "4").replace("{y}", String(y)).replace("{x}", String(x));
  try {
    const res = await providerFetch(url, "nasa-gibs tile check");
    return (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

export async function fetchSatelliteLayer(nowMs: number): Promise<SatelliteLayer> {
  const p = config.providers;
  const range = `${dayString(nowMs - 14 * 86_400_000)}--${dayString(nowMs + 86_400_000)}`;
  let latest: string | null;
  try {
    const xml = await providerText(
      `${p.gibsBaseUrl}/1.0.0/${p.gibsLayer}/default/${p.gibsTileMatrixSet}/all/${range}.xml`,
      "nasa-gibs domains",
    );
    latest = parseLatestDomainDate(xml);
  } catch (err) {
    return unavailable(`NASA GIBS layer metadata could not be read: ${err instanceof Error ? err.message : "unknown error"}`, nowMs);
  }
  if (!latest) {
    return unavailable("NASA GIBS lists no IMERG imagery for the last 14 days.", nowMs);
  }
  if (!(await tileExists(latest))) {
    return unavailable(`NASA GIBS lists imagery for ${latest}, but a test tile over Karachi could not be loaded.`, nowMs);
  }
  const ageDays = Math.max(0, Math.round((Date.UTC(+latest.slice(0, 4), +latest.slice(5, 7) - 1, +latest.slice(8, 10)) - Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate())) / -86_400_000));
  return {
    status: "available",
    statusReason: `Latest daily IMERG imagery listed by NASA GIBS: ${latest} (UTC day). A test tile over Karachi loaded successfully.`,
    source: "NASA GIBS (Global Imagery Browse Services)",
    layerName: p.gibsLayer,
    layerTitle: LAYER_TITLE,
    observationTime: latest,
    observationPeriod: "P1D (one UTC day)",
    observationAgeDays: ageDays,
    tileUrlTemplate: tileTemplate(latest),
    tileMatrixSet: p.gibsTileMatrixSet,
    maxNativeZoom: p.gibsMaxNativeZoom,
    legendUrl: LEGEND_URL,
    attribution: ATTRIBUTION,
    retrievedAt: new Date(nowMs).toISOString(),
    notes: NOTES,
  };
}

type SatCache = { layer: SatelliteLayer | null; at: number };
const g = globalThis as typeof globalThis & { __ffSatelliteCache?: SatCache };
const cache: SatCache = (g.__ffSatelliteCache ??= { layer: null, at: 0 });

export function resetSatelliteCache(): void {
  cache.layer = null;
  cache.at = 0;
}

export async function getSatelliteLayer(): Promise<SatelliteLayer> {
  const now = Date.now();
  // Unavailable results are only cached for a minute so recovery is quick.
  const ttl = cache.layer?.status === "available" ? config.satelliteCacheSeconds * 1000 : 60_000;
  if (cache.layer && now - cache.at < ttl) return cache.layer;
  cache.layer = await fetchSatelliteLayer(now);
  cache.at = now;
  return cache.layer;
}
