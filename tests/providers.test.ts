import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLiveForecast, getLiveForecast, resetForecastCache, type RawForecast } from "../src/lib/floodfund/forecast";
import { fetchSatelliteLayer, parseLatestDomainDate, tileXY } from "../src/lib/floodfund/satellite";
import { HOUR_MS, rollingWindowStart, selectWindow, utcDayStart, type HourlySeries } from "../src/lib/floodfund/time";

/** Deterministic fixtures. External providers are always mocked in tests. */
const NOW = Date.parse("2026-11-10T16:49:34Z");
const INIT = Date.parse("2026-11-10T06:00:00Z");
const AVAILABLE = Date.parse("2026-11-10T12:12:03Z");

function seriesJson(startMs: number, hours: number, value: (i: number) => number | null) {
  return {
    latitude: 25,
    longitude: 67,
    elevation: 7,
    generationtime_ms: 123456789, // must never be used as a model time
    hourly_units: { time: "unixtime", precipitation: "mm" },
    hourly: {
      time: Array.from({ length: hours }, (_, i) => (startMs + i * HOUR_MS) / 1000),
      precipitation: Array.from({ length: hours }, (_, i) => value(i)),
    },
  };
}

const META = {
  last_run_initialisation_time: INIT / 1000,
  last_run_availability_time: AVAILABLE / 1000,
  temporal_resolution_seconds: 21600,
};

type Route = (url: string) => Response | Promise<Response>;
function mockFetch(routes: { meta?: Route; pinned?: Route; live?: Route; other?: Route }) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = url.includes("meta.json") ? routes.meta : url.includes("single-runs-api") ? routes.pinned : url.includes("/v1/ecmwf") ? routes.live : routes.other;
    if (!route) throw new Error("network disabled in tests");
    return route(url);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => resetForecastCache());
afterEach(() => vi.unstubAllGlobals());

describe("rolling next-24-hours window", () => {
  it("starts at the next full hour and uses the preceding-hour convention", () => {
    expect(new Date(rollingWindowStart(NOW)).toISOString()).toBe("2026-11-10T17:00:00.000Z");
    expect(rollingWindowStart(Date.parse("2026-11-10T10:00:00Z"))).toBe(Date.parse("2026-11-10T10:00:00Z"));

    const start = Date.parse("2026-11-10T17:00:00Z");
    const s: HourlySeries = { unit: "mm", timesUnix: [], values: [] };
    for (let i = 0; i < 48; i++) {
      s.timesUnix.push((INIT + i * HOUR_MS) / 1000);
      s.values.push(i === 0 ? null : i); // value == lead hour
    }
    const sel = selectWindow(s, start);
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    // 17:00-18:00 is stamped 18:00 = lead hour 12; the last interval is stamped 17:00 next day = lead 35.
    expect(sel.hourly).toHaveLength(24);
    expect(sel.hourly[0]).toEqual({ intervalStart: "2026-11-10T17:00:00.000Z", intervalEnd: "2026-11-10T18:00:00.000Z", precipitationMm: 12 });
    expect(sel.hourly[23].precipitationMm).toBe(35);
    expect(sel.totalMm).toBe(sel.hourly.reduce((a, h) => a + h.precipitationMm, 0));
  });

  it("selects a fixed UTC day from a 12 UTC run (benchmark window)", () => {
    const day = utcDayStart("2026-07-10") as number;
    const run = day - 12 * HOUR_MS;
    const s: HourlySeries = { unit: "mm", timesUnix: [], values: [] };
    for (let i = 0; i < 48; i++) {
      s.timesUnix.push((run + i * HOUR_MS) / 1000);
      s.values.push(i === 0 ? null : i);
    }
    const sel = selectWindow(s, day);
    expect(sel.ok && sel.hourly.map((h) => h.precipitationMm)).toEqual(Array.from({ length: 24 }, (_, i) => i + 13));
    expect(utcDayStart("2026-02-30")).toBeNull();
    expect(utcDayStart("10-07-2026")).toBeNull();
  });

  it("never treats missing data as zero", () => {
    const start = Date.parse("2026-11-10T17:00:00Z");
    const make = (mutate: (s: HourlySeries) => void) => {
      const s: HourlySeries = { unit: "mm", timesUnix: [], values: [] };
      for (let i = 1; i <= 30; i++) {
        s.timesUnix.push((start + i * HOUR_MS) / 1000);
        s.values.push(1);
      }
      mutate(s);
      return selectWindow(s, start);
    };
    const missing = make((s) => (s.values[5] = null));
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.reason).toMatch(/not treated as zero/);
    expect(make((s) => (s.values[3] = -0.1)).ok).toBe(false);
    expect(make((s) => (s.values[3] = Number.NaN)).ok).toBe(false);
    expect(make((s) => { s.timesUnix.splice(10, 1); s.values.splice(10, 1); }).ok).toBe(false);
    expect(make((s) => (s.unit = "inch")).ok).toBe(false);
    expect(make(() => undefined).ok).toBe(true);
  });
});

describe("live AIFS forecast", () => {
  it("is fresh only when pinned to the run listed in provider metadata", async () => {
    const fetchFn = mockFetch({ meta: () => json(META), pinned: () => json(seriesJson(INIT, 72, (i) => (i === 0 ? null : 0.5))) });
    const f = await getLiveForecast({ nowMs: NOW, forceRefresh: true });
    expect(f.status).toBe("fresh");
    expect(f.dataKind).toBe("live");
    expect(f.freshnessVerified).toBe(true);
    expect(f.modelRunAt).toBe("2026-11-10T06:00:00.000Z");
    expect(f.providerAvailableAt).toBe("2026-11-10T12:12:03.000Z");
    expect(f.windowStart).toBe("2026-11-10T17:00:00.000Z");
    expect(f.windowEnd).toBe("2026-11-11T17:00:00.000Z");
    expect(f.hourly).toHaveLength(24);
    expect(f.totalMm).toBe(12);
    expect(f.hourly.reduce((a, h) => a + h.precipitationMm, 0)).toBeCloseTo(f.totalMm as number, 9);
    expect(f.nativeStepHours).toBe(6);
    expect(f.gridLocation).toEqual({ latitude: 25, longitude: 67, elevationM: 7 });
    // retrievedAt is the backend fetch time, distinct from the model run time.
    expect(Math.abs(Date.parse(f.retrievedAt) - Date.now())).toBeLessThan(60_000);
    expect(f.modelRunAt).not.toBe(f.retrievedAt);
    const pinnedCall = fetchFn.mock.calls.map((c) => String(c[0])).find((u) => u.includes("single-runs-api"));
    expect(pinnedCall).toContain("run=2026-11-10T06:00");
  });

  it("is unverified when the run cannot be pinned, and stale when the run is too old", async () => {
    mockFetch({ meta: () => json(META), pinned: () => json({ error: true, reason: "The requested model run is not available." }, 400), live: () => json(seriesJson(INIT, 72, () => 5)) });
    const unverified = await getLiveForecast({ nowMs: NOW, forceRefresh: true });
    expect(unverified.status).toBe("unverified");
    expect(unverified.freshnessVerified).toBe(false);
    expect(unverified.modelRunAt).toBeNull();
    expect(unverified.totalMm).toBe(120); // values are displayed, but cannot trigger funding

    resetForecastCache();
    mockFetch({ meta: () => json({ nothing: true }), live: () => json(seriesJson(INIT, 72, () => 0)) });
    expect((await getLiveForecast({ nowMs: NOW, forceRefresh: true })).status).toBe("unverified");

    const raw: RawForecast = {
      retrievedAtMs: NOW,
      meta: { initMs: INIT, availableMs: AVAILABLE, stepSeconds: 21600 },
      pinned: true,
      pinProblem: null,
      series: { unit: "mm", timesUnix: seriesJson(INIT, 72, () => 4).hourly.time, values: seriesJson(INIT, 72, () => 4).hourly.precipitation },
      grid: null,
    };
    const stale = buildLiveForecast(raw, INIT + 30 * HOUR_MS);
    expect(stale.status).toBe("stale");
    expect(stale.runAgeHours).toBe(30);
  });

  it("reports missing hours as invalid and provider failure as unavailable, with null totals", async () => {
    mockFetch({ meta: () => json(META), pinned: () => json(seriesJson(INIT, 72, (i) => (i === 20 ? null : 1))) });
    const invalid = await getLiveForecast({ nowMs: NOW, forceRefresh: true });
    expect(invalid.status).toBe("invalid");
    expect(invalid.totalMm).toBeNull();
    expect(invalid.hourly).toEqual([]);

    resetForecastCache();
    mockFetch({});
    const down = await getLiveForecast({ nowMs: NOW, forceRefresh: true });
    expect(down.status).toBe("unavailable");
    expect(down.totalMm).toBeNull();
    expect(down.statusReason).toMatch(/unavailable/i);
  });
});

describe("NASA GIBS satellite layer", () => {
  const XML = "<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-25/2026-11-09/P1D</Domain><Size>1</Size></DimensionDomain></Domains>";

  it("reads the observation date from provider metadata", () => {
    expect(parseLatestDomainDate(XML)).toBe("2026-11-09");
    expect(parseLatestDomainDate("<Domains></Domains>")).toBeNull();
    expect(tileXY(24.8607, 67.0011, 4)).toEqual({ x: 10, y: 6 });
  });

  it("is available only after metadata and a real tile check succeed", async () => {
    mockFetch({ other: (url) => (url.endsWith(".xml") ? new Response(XML) : new Response("png", { headers: { "content-type": "image/png" } })) });
    const layer = await fetchSatelliteLayer(NOW);
    expect(layer.status).toBe("available");
    expect(layer.observationTime).toBe("2026-11-09");
    expect(layer.observationAgeDays).toBe(1);
    expect(layer.tileUrlTemplate).toContain("/IMERG_Precipitation_Rate/default/2026-11-09/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png");
    expect(layer.maxNativeZoom).toBe(6);

    mockFetch({ other: (url) => (url.endsWith(".xml") ? new Response(XML) : new Response("missing", { status: 404 })) });
    const noTile = await fetchSatelliteLayer(NOW);
    expect(noTile.status).toBe("unavailable");
    expect(noTile.tileUrlTemplate).toBeNull();

    mockFetch({});
    const down = await fetchSatelliteLayer(NOW);
    expect(down.status).toBe("unavailable");
    expect(down.observationTime).toBeNull();
  });
});
