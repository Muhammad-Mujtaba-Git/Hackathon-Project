import { round2 } from "./time";

/**
 * Runtime for the two team-trained models.
 *
 * The models are trained with scikit-learn in `backend/ml` and saved twice:
 * as joblib pipelines (for Python) and as plain JSON exports (for this
 * TypeScript runtime, so the web service never unpickles anything). The
 * feature maths below mirrors `backend/ml/common.py`; a parity test checks
 * that both sides produce the same features and predictions.
 */

export const FEATURES = [
  "aifs_total_24h_mm",
  "aifs_max_hourly_mm",
  "aifs_wet_hours",
  "aifs_max_6h_mm",
  "latitude",
  "longitude",
  "doy_sin",
  "doy_cos",
] as const;
export type FeatureName = (typeof FEATURES)[number];

export function computeFeatures(
  hourly: number[],
  latitude: number,
  longitude: number,
  date: string,
  wetHourMm = 0.1,
): Record<FeatureName, number> {
  if (hourly.length !== 24) throw new Error("Exactly 24 hourly values are required.");
  let total = 0;
  let maxHourly = 0;
  let wet = 0;
  for (const v of hourly) {
    total += v;
    if (v > maxHourly) maxHourly = v;
    if (v >= wetHourMm) wet += 1;
  }
  let max6 = 0;
  for (let block = 0; block < 4; block++) {
    let s = 0;
    for (let i = block * 6; i < block * 6 + 6; i++) s += hourly[i];
    if (s > max6) max6 = s;
  }
  const [y, m, d] = date.split("-").map(Number);
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
  const angle = (2 * Math.PI * dayOfYear) / 365.25;
  return {
    aifs_total_24h_mm: round2(total),
    aifs_max_hourly_mm: round2(maxHourly),
    aifs_wet_hours: wet,
    aifs_max_6h_mm: round2(max6),
    latitude,
    longitude,
    doy_sin: Math.sin(angle),
    doy_cos: Math.cos(angle),
  };
}

export function featureVector(features: Record<FeatureName, number>): number[] {
  return FEATURES.map((name) => features[name]);
}

export interface ForestExport {
  type: "random-forest";
  features: string[];
  clipMin: number;
  trees: { left: number[]; right: number[]; feature: number[]; threshold: number[]; value: number[] }[];
}

export interface MlpExport {
  type: "mlp";
  features: string[];
  clipMin: number;
  scalerMean: number[];
  scalerScale: number[];
  activation: string;
  outActivation: string;
  weights: number[][][];
  biases: number[][];
}

function sameFeatures(list: unknown): boolean {
  return Array.isArray(list) && list.length === FEATURES.length && FEATURES.every((f, i) => list[i] === f);
}

export function isForestExport(v: unknown): v is ForestExport {
  const o = v as ForestExport | null;
  return !!o && o.type === "random-forest" && sameFeatures(o.features) && Array.isArray(o.trees) && o.trees.length > 0;
}

export function isMlpExport(v: unknown): v is MlpExport {
  const o = v as MlpExport | null;
  return (
    !!o &&
    o.type === "mlp" &&
    sameFeatures(o.features) &&
    o.activation === "relu" &&
    o.outActivation === "identity" &&
    Array.isArray(o.weights) &&
    Array.isArray(o.biases) &&
    o.weights.length === o.biases.length &&
    Array.isArray(o.scalerMean) &&
    o.scalerMean.length === FEATURES.length
  );
}

/** scikit-learn trees compare float32 feature values against float64 thresholds. */
export function predictForest(model: ForestExport, x: number[]): number {
  let sum = 0;
  for (const t of model.trees) {
    let node = 0;
    while (t.left[node] !== -1) {
      node = Math.fround(x[t.feature[node]]) <= t.threshold[node] ? t.left[node] : t.right[node];
    }
    sum += t.value[node];
  }
  return Math.max(model.clipMin, sum / model.trees.length);
}

export function predictMlp(model: MlpExport, x: number[]): number {
  let a = x.map((v, i) => (v - model.scalerMean[i]) / model.scalerScale[i]);
  for (let layer = 0; layer < model.weights.length; layer++) {
    const w = model.weights[layer];
    const b = model.biases[layer];
    const out = b.slice();
    for (let i = 0; i < a.length; i++) {
      const row = w[i];
      const ai = a[i];
      for (let j = 0; j < out.length; j++) out[j] += ai * row[j];
    }
    a = layer < model.weights.length - 1 ? out.map((v) => (v > 0 ? v : 0)) : out;
  }
  return Math.max(model.clipMin, a[0]);
}
