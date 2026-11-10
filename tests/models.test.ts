import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURES, computeFeatures, featureVector, predictForest, predictMlp } from "../src/lib/floodfund/ml-runtime";
import { getBenchmark, getComparison, listModels, loadArtifacts } from "../src/lib/floodfund/models";
import { HOUR_MS } from "../src/lib/floodfund/time";

const REAL_DIR = "backend/artifacts";
const hasReal = existsSync(path.join(REAL_DIR, "benchmark.json")) && existsSync(path.join(REAL_DIR, "parity_sample.json"));
const emptyDir = () => mkdtempSync(path.join(tmpdir(), "ff-artifacts-"));

afterEach(() => vi.unstubAllGlobals());

describe("model registry", () => {
  it("reports team models as not-trained when artifacts are missing", async () => {
    const dir = emptyDir();
    const { models } = await listModels(dir);
    expect(models.map((m) => [m.id, m.status])).toEqual([
      ["ecmwf-aifs", "available"],
      ["random-forest", "not-trained"],
      ["neural-network", "not-trained"],
    ]);
    expect(models[0].trainedBy).toMatch(/ECMWF/);
    expect(models[1].usesAifsAsInput && models[2].usesAifsAsInput).toBe(true);
    const benchmark = await getBenchmark(dir);
    expect(benchmark).toMatchObject({ status: "unavailable", report: null });
    expect(benchmark.reason).toBeTruthy();
  });

  it("never presents synthetic test fixtures as real training results", async () => {
    const dir = emptyDir();
    writeFileSync(path.join(dir, "model_metadata.json"), JSON.stringify({ dataKind: "synthetic-test-fixture", status: "trained", features: FEATURES }));
    writeFileSync(path.join(dir, "benchmark.json"), JSON.stringify({ dataKind: "synthetic-test-fixture", test: { metrics: [] } }));
    const { models } = await listModels(dir);
    expect(models[1].status).toBe("not-trained");
    expect(models[1].statusReason).toMatch(/not real training results/);
    expect((await getBenchmark(dir)).status).toBe("unavailable");
  });

  it("returns AIFS only (team models null) for a comparison when models are not trained", async () => {
    const day = Date.parse("2026-07-10T00:00:00Z");
    const run = day - 12 * HOUR_MS;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("single-runs-api")) {
        expect(url).toContain("run=2026-07-09T12:00");
        return new Response(JSON.stringify({
          latitude: 25, longitude: 67, elevation: 7,
          hourly_units: { time: "unixtime", precipitation: "mm" },
          hourly: { time: Array.from({ length: 48 }, (_, i) => (run + i * HOUR_MS) / 1000), precipitation: Array.from({ length: 48 }, (_, i) => (i === 0 ? null : 0.5)) },
        }));
      }
      return new Response(JSON.stringify({ header: { fill_value: -999 }, properties: { parameter: { IMERG_PRECTOT: { "20260710": -999 } } } }));
    }));
    const c = await getComparison("2026-07-10", Date.parse("2026-11-10T12:00:00Z"), emptyDir());
    expect(c.status).toBe("available");
    expect(c.createsAllocations).toBe(false);
    expect(c.windowStart).toBe("2026-07-10T00:00:00.000Z");
    expect(c.modelRunAt).toBe("2026-07-09T12:00:00.000Z");
    expect(c.predictions.map((p) => [p.modelId, p.status, p.rainfallMm])).toEqual([
      ["ecmwf-aifs", "ok", 12],
      ["random-forest", "not-trained", null],
      ["neural-network", "not-trained", null],
    ]);
    expect(c.reference.valueMm).toBeNull(); // -999 is missing, not zero
  });
});

describe.skipIf(!hasReal)("real trained artifacts", () => {
  it("TypeScript runtime reproduces the scikit-learn features and predictions", async () => {
    const a = await loadArtifacts(REAL_DIR);
    expect(a.forest && a.mlp).toBeTruthy();
    const sample = JSON.parse(readFileSync(path.join(REAL_DIR, "parity_sample.json"), "utf8")) as {
      wetHourMm: number;
      rows: { targetDate: string; latitude: number; longitude: number; hourly: number[]; features: Record<string, number>; randomForestMm: number; neuralNetworkMm: number }[];
    };
    expect(sample.rows.length).toBeGreaterThan(5);
    for (const row of sample.rows) {
      const f = computeFeatures(row.hourly, row.latitude, row.longitude, row.targetDate, sample.wetHourMm);
      for (const name of FEATURES) expect(f[name]).toBeCloseTo(row.features[name], 9);
      const x = featureVector(f);
      expect(predictForest(a.forest!, x)).toBeCloseTo(row.randomForestMm, 6);
      expect(predictMlp(a.mlp!, x)).toBeCloseTo(row.neuralNetworkMm, 6);
      expect(predictForest(a.forest!, x)).toBeGreaterThanOrEqual(0);
      expect(predictMlp(a.mlp!, x)).toBeGreaterThanOrEqual(0);
    }
  });

  it("benchmark compares all three models on identical rows and uses null for undefined metrics", async () => {
    const b = await getBenchmark(REAL_DIR);
    expect(b.status).toBe("available");
    const r = b.report!;
    expect(r.dataKind).toBe("real");
    expect(r.sameRowsVerified).toBe(true);
    expect(r.splits.train.end < r.splits.validation.start && r.splits.validation.end < r.splits.test.start).toBe(true);
    for (const part of [r.validation, r.test]) {
      expect(part.metrics.map((m) => m.modelId)).toEqual(["ecmwf-aifs", "random-forest", "neural-network"]);
      expect(new Set(part.metrics.map((m) => `${m.nExamples}|${m.nDates}|${m.referenceAtOrAboveThreshold}`)).size).toBe(1);
      for (const m of part.metrics) {
        if (m.predictedAtOrAboveThreshold === 0) expect(m.precision).toBeNull();
        if (m.referenceAtOrAboveThreshold === 0) expect(m.recall).toBeNull();
        expect(m.maeMm).toBeGreaterThanOrEqual(0);
      }
    }
    expect(r.testRows).toHaveLength(r.test.metrics[0].nExamples);
    expect(r.recommendation.liveDashboardModel).toBe("ecmwf-aifs");
    const { models } = await listModels(REAL_DIR);
    expect(models.map((m) => m.status)).toEqual(["available", "trained", "trained"]);
    expect(models[1].features).toEqual([...FEATURES]);
    expect(models[2].features).toEqual([...FEATURES]);
  });
});
