import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";
import { ProviderError, providerJson } from "./http";
import { parseSeries } from "./forecast";
import { computeFeatures, featureVector, isForestExport, isMlpExport, predictForest, predictMlp, type ForestExport, type MlpExport } from "./ml-runtime";
import { HOUR_MS, selectWindow, utcDayStart } from "./time";
import type { BenchmarkReport, BenchmarkResponse, ComparisonPrediction, ComparisonResponse, ModelInfo, ModelsResponse, SplitInfo } from "./types";

/**
 * Trusted local model artifacts produced by `backend/ml`. Only files in the
 * configured artifacts directory are read; there is no upload path. The API
 * works without them and then reports the team models as "not-trained".
 * Only artifacts labelled `dataKind: "real"` are ever presented as results.
 */

interface ModelMeta {
  name?: string;
  version?: string;
  hyperparameters?: Record<string, unknown>;
  trainingSeconds?: number;
}
interface Metadata {
  dataKind?: string;
  status?: string;
  reason?: string;
  trainedAt?: string;
  features?: string[];
  splits?: Record<"train" | "validation" | "test", SplitInfo>;
  models?: Record<string, ModelMeta>;
}
export interface Artifacts {
  metadata: Metadata | null;
  benchmark: BenchmarkReport | null;
  forest: ForestExport | null;
  mlp: MlpExport | null;
}

const cache = new Map<string, { at: number; data: Artifacts }>();

function resolveDir(dir?: string): string {
  // Read at runtime from the deployed project directory; not part of the bundler's file trace.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), dir ?? config.artifactsDir);
}

async function readJson(dir: string, name: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
  } catch {
    return null;
  }
}

export async function loadArtifacts(dir?: string): Promise<Artifacts> {
  const resolved = resolveDir(dir);
  const hit = cache.get(resolved);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const [metadata, benchmark, forest, mlp] = await Promise.all([
    readJson(resolved, "model_metadata.json"),
    readJson(resolved, "benchmark.json"),
    readJson(resolved, "random_forest.export.json"),
    readJson(resolved, "neural_network.export.json"),
  ]);
  const data: Artifacts = {
    metadata: (metadata as Metadata | null) ?? null,
    benchmark: (benchmark as BenchmarkReport | null) ?? null,
    forest: isForestExport(forest) ? forest : null,
    mlp: isMlpExport(mlp) ? mlp : null,
  };
  cache.set(resolved, { at: Date.now(), data });
  return data;
}

export function teamModelStatus(a: Artifacts): { trained: boolean; reason: string | null } {
  if (!a.metadata) {
    return { trained: false, reason: "No model artifacts found. Run the training commands in backend/ (see README)." };
  }
  if (a.metadata.status !== "trained") {
    return { trained: false, reason: a.metadata.reason ?? "Training did not complete (insufficient data)." };
  }
  if (a.metadata.dataKind !== "real") {
    return { trained: false, reason: `Artifacts are labelled "${a.metadata.dataKind ?? "unknown"}" and are not real training results.` };
  }
  if (!a.forest || !a.mlp) {
    return { trained: false, reason: "Model export files are missing or do not match the expected feature list." };
  }
  return { trained: true, reason: null };
}

export async function listModels(dir?: string): Promise<ModelsResponse> {
  const a = await loadArtifacts(dir);
  const s = teamModelStatus(a);
  const team = (id: "random-forest" | "neural-network", name: string, kind: string, description: string): ModelInfo => {
    const m = s.trained ? a.metadata?.models?.[id] : undefined;
    return {
      id,
      name,
      trainedBy: "FloodFund team",
      kind,
      status: s.trained ? "trained" : "not-trained",
      statusReason: s.reason,
      version: m?.version ?? null,
      trainedAt: s.trained ? (a.metadata?.trainedAt ?? null) : null,
      usesAifsAsInput: true,
      description,
      features: s.trained ? (a.metadata?.features ?? null) : null,
      hyperparameters: m?.hyperparameters ?? null,
      trainingSeconds: m?.trainingSeconds ?? null,
    };
  };
  return {
    models: [
      {
        id: "ecmwf-aifs",
        name: "ECMWF AIFS (raw)",
        trainedBy: "ECMWF (not our team)",
        kind: "Global AI weather model, 0.25° grid",
        status: "available",
        statusReason: null,
        version: config.providers.aifsModelId,
        trainedAt: null,
        usesAifsAsInput: false,
        description: "Forecast produced and trained by ECMWF, retrieved through Open-Meteo. Default forecast on the live dashboard.",
        features: null,
        hyperparameters: null,
        trainingSeconds: null,
      },
      team(
        "random-forest",
        "Team Random Forest",
        "scikit-learn RandomForestRegressor (AIFS post-processor)",
        "Trained by our team to adjust the AIFS 24 h total towards NASA IMERG estimates. It takes AIFS output as input and is not an independent weather model.",
      ),
      team(
        "neural-network",
        "Team Neural Network",
        "scikit-learn MLPRegressor with feature scaling (AIFS post-processor)",
        "Small neural network trained by our team on the same features as the Random Forest. It takes AIFS output as input and is not an independent weather model.",
      ),
    ],
    note: "ECMWF trained AIFS. The FloodFund team trained only the two post-processing models, which use AIFS as an input.",
  };
}

export async function getBenchmark(dir?: string): Promise<BenchmarkResponse> {
  const a = await loadArtifacts(dir);
  const s = teamModelStatus(a);
  if (!s.trained) return { status: "unavailable", reason: s.reason, report: null };
  if (!a.benchmark) return { status: "unavailable", reason: "Models are trained but no benchmark report exists. Run `python -m ml.evaluate`.", report: null };
  if (a.benchmark.dataKind !== "real") {
    return { status: "unavailable", reason: `The benchmark report is labelled "${a.benchmark.dataKind}" and is not a real result.`, report: null };
  }
  return { status: "available", reason: null, report: a.benchmark };
}

function membership(a: Artifacts, date: string): ComparisonResponse["splitMembership"] {
  const splits = a.metadata?.splits;
  if (!splits) return "unknown";
  for (const name of ["train", "validation", "test"] as const) {
    if (date >= splits[name].start && date <= splits[name].end) return name;
  }
  return "outside";
}

async function fetchReference(date: string): Promise<{ valueMm: number | null; note: string }> {
  const d = date.replace(/-/g, "");
  const { latitude, longitude } = config.area;
  try {
    const json = (await providerJson(
      `${config.providers.nasaPowerDailyUrl}?parameters=IMERG_PRECTOT&community=SB&latitude=${latitude}&longitude=${longitude}&start=${d}&end=${d}&format=JSON&time-standard=UTC`,
      "nasa-power daily",
    )) as { properties?: { parameter?: { IMERG_PRECTOT?: Record<string, unknown> } }; header?: { fill_value?: number } };
    const value = json.properties?.parameter?.IMERG_PRECTOT?.[d];
    const fill = json.header?.fill_value ?? -999;
    if (typeof value !== "number" || !Number.isFinite(value) || value === fill || value < 0) {
      return { valueMm: null, note: "NASA POWER has no IMERG value for this day yet (the product lags by several weeks). Missing is not zero." };
    }
    return { valueMm: value, note: "Satellite estimate for the same UTC day. It may be revised by NASA." };
  } catch (err) {
    return { valueMm: null, note: `NASA POWER could not be reached (${err instanceof Error ? err.message : "unknown error"}).` };
  }
}

const comparisonCache = new Map<string, { at: number; data: ComparisonResponse }>();

/**
 * Predictions of all three models for the SAME fixed UTC day, using the AIFS
 * run initialised at 12:00 UTC on the previous day. Read-only: it never
 * touches sessions, budgets or allocations.
 */
export async function getComparison(date: string, nowMs = Date.now(), dir?: string): Promise<ComparisonResponse> {
  const dayStart = utcDayStart(date);
  if (dayStart === null) throw new Error("Invalid date");
  const key = `${resolveDir(dir)}|${date}`;
  const hit = comparisonCache.get(key);
  if (hit && nowMs - hit.at < 600_000) return hit.data;

  const b = config.benchmark;
  const runMs = dayStart - (24 - b.runHourUtc) * HOUR_MS;
  const a = await loadArtifacts(dir);
  const team = teamModelStatus(a);
  const base: ComparisonResponse = {
    status: "unavailable",
    reason: null,
    areaId: config.area.id,
    date,
    windowLabel: "Fixed UTC day (benchmark window). Not the rolling next-24-hours window used by the live dashboard.",
    windowStart: new Date(dayStart).toISOString(),
    windowEnd: new Date(dayStart + 24 * HOUR_MS).toISOString(),
    modelRunAt: new Date(runMs).toISOString(),
    decisionCutoffAt: new Date(dayStart - b.decisionCutoffHoursBeforeTarget * HOUR_MS).toISOString(),
    availability: "assumed",
    predictions: [],
    reference: { source: "NASA POWER IMERG_PRECTOT (UTC day)", valueMm: null, note: "Not requested." },
    splitMembership: membership(a, date),
    notes: [
      `Availability of the archived run before the decision cutoff is assumed (within ${b.assumedPublicationLagHours} h of initialisation), not verified.`,
      "Both team models are AIFS post-processors. This comparison never creates a funding allocation.",
    ],
    createsAllocations: false,
  };

  if (runMs > nowMs) {
    return { ...base, reason: `The AIFS run for that day (${base.modelRunAt}) has not been initialised yet.` };
  }
  const { latitude, longitude } = config.area;
  const run = new Date(runMs).toISOString().slice(0, 16);
  let hourly: number[];
  try {
    const json = await providerJson(
      `${config.providers.openMeteoSingleRunsUrl}?latitude=${latitude}&longitude=${longitude}&hourly=precipitation&models=${config.providers.aifsModelId}&run=${run}&timezone=GMT&timeformat=unixtime&forecast_hours=48`,
      "open-meteo single-run",
    );
    const sel = selectWindow(parseSeries(json).series, dayStart, 24);
    if (!sel.ok) return { ...base, reason: `The archived run does not cover that UTC day completely: ${sel.reason}` };
    hourly = sel.hourly.map((h) => h.precipitationMm);
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : "Unknown provider error.";
    return { ...base, reason: `The archived AIFS run could not be retrieved: ${message}` };
  }

  const features = computeFeatures(hourly, latitude, longitude, date, b.wetHourMm);
  const x = featureVector(features);
  const round = (v: number) => Math.round(v * 100) / 100;
  const teamPrediction = (id: "random-forest" | "neural-network", name: string, value: () => number): ComparisonPrediction =>
    team.trained
      ? { modelId: id, name, rainfallMm: round(value()), status: "ok", note: "AIFS post-processor trained by our team." }
      : { modelId: id, name, rainfallMm: null, status: "not-trained", note: team.reason };

  const membershipNote: Record<ComparisonResponse["splitMembership"], string | null> = {
    train: "This day is inside the TRAINING period, so the team-model values are in-sample and look better than they would on new data.",
    validation: "This day is inside the VALIDATION period, which was used for model selection and the final fit (in-sample).",
    test: "This day is inside the held-out TEST period.",
    outside: "This day is outside the benchmark period; no skill estimate applies to it directly.",
    unknown: null,
  };
  const note = membershipNote[base.splitMembership];
  const reference = dayStart + 24 * HOUR_MS <= nowMs ? await fetchReference(date) : { valueMm: null, note: "The day has not ended, so no satellite estimate can exist yet." };

  const data: ComparisonResponse = {
    ...base,
    status: "available",
    predictions: [
      { modelId: "ecmwf-aifs", name: "ECMWF AIFS (raw)", rainfallMm: features.aifs_total_24h_mm, status: "ok", note: "Trained by ECMWF, via Open-Meteo." },
      teamPrediction("random-forest", "Team Random Forest", () => predictForest(a.forest as ForestExport, x)),
      teamPrediction("neural-network", "Team Neural Network", () => predictMlp(a.mlp as MlpExport, x)),
    ],
    reference: { source: base.reference.source, ...reference },
    notes: note ? [note, ...base.notes] : base.notes,
  };
  if (comparisonCache.size > 100) comparisonCache.clear();
  comparisonCache.set(key, { at: nowMs, data });
  return data;
}
