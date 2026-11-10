/**
 * The single API contract for FloodFund Karachi. The server route handlers
 * return these shapes and the browser API client consumes the same types.
 * All JSON fields are camelCase; unavailable values are `null`, never invented.
 */

export type DataStatus = "fresh" | "stale" | "unverified" | "unavailable" | "invalid";
export type DataKind = "live" | "demo";
export type SessionMode = "live" | "demo";
export type ScenarioId = "calm" | "severe-storm" | "exact-threshold" | "stale-data";

export interface Area {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  note: string;
}

export interface HourlyRain {
  intervalStart: string;
  intervalEnd: string;
  precipitationMm: number;
}

export interface Forecast {
  /** "live" = real provider data. "demo" = deterministic synthetic scenario. */
  dataKind: DataKind;
  scenarioId: ScenarioId | null;
  areaId: string;
  requestedLocation: { latitude: number; longitude: number };
  gridLocation: { latitude: number; longitude: number; elevationM: number | null } | null;
  source: string;
  model: string;
  modelId: string;
  /** Model initialisation time. Null when it could not be verified. */
  modelRunAt: string | null;
  /** When the provider reports the run became available. */
  providerAvailableAt: string | null;
  /** When this backend fetched the data from the provider. */
  retrievedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  hourly: HourlyRain[];
  totalMm: number | null;
  unit: "mm";
  status: DataStatus;
  statusReason: string;
  freshnessVerified: boolean;
  runAgeHours: number | null;
  maxRunAgeHours: number;
  /** Native model output step (AIFS on Open-Meteo: 6 h). Hourly values are provider-interpolated. */
  nativeStepHours: number | null;
  notes: string[];
}

export interface SatelliteLayer {
  status: "available" | "unavailable";
  statusReason: string;
  source: string;
  layerName: string;
  layerTitle: string;
  /** UTC date of the daily product (YYYY-MM-DD), from provider metadata. */
  observationTime: string | null;
  observationPeriod: string | null;
  observationAgeDays: number | null;
  tileUrlTemplate: string | null;
  tileMatrixSet: string | null;
  maxNativeZoom: number | null;
  legendUrl: string | null;
  attribution: string;
  retrievedAt: string;
  notes: string[];
}

export interface Policy {
  id: string;
  name: string;
  areaId: string;
  thresholdMm: number;
  windowHours: number;
  allocationPkr: number;
  initialBudgetPkr: number;
  active: boolean;
  simulated: true;
  disclaimer: string;
}

export type DecisionStatus =
  | "allocated"
  | "already_allocated"
  | "below_threshold"
  | "insufficient_budget"
  | "policy_inactive"
  | "cannot_evaluate";

export type EvaluationTrigger = "manual" | "scheduler" | "scenario";

export interface Decision {
  id: number;
  status: DecisionStatus;
  reason: string;
  evaluatedAt: string;
  trigger: EvaluationTrigger;
  mode: SessionMode;
  scenarioId: string | null;
  eventId: string | null;
  dataStatus: DataStatus;
  forecastTotalMm: number | null;
  thresholdMm: number;
  modelRunAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  allocationId: number | null;
}

export interface Allocation {
  id: number;
  eventId: string;
  policyId: string;
  amountPkr: number;
  forecastTotalMm: number;
  mode: SessionMode;
  scenarioId: string | null;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  simulated: true;
}

export interface Budget {
  currency: "PKR";
  initialPkr: number;
  remainingPkr: number;
  allocatedPkr: number;
  allocationCount: number;
  simulated: true;
}

export interface AuditRecord {
  id: number;
  type: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface SchedulerStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  sessionsChecked: number;
  note: string;
}

export interface ScenarioInfo {
  id: ScenarioId;
  name: string;
  description: string;
  totalMm: number;
  dataStatus: DataStatus;
  expected: string;
}

export interface Dashboard {
  sessionId: string;
  mode: SessionMode;
  scenarioId: string | null;
  area: Area;
  policy: Policy;
  forecast: Forecast;
  /** Latest recorded evaluation for the current mode, or null if not evaluated yet. */
  decision: Decision | null;
  budget: Budget;
  allocations: Allocation[];
  evaluations: Decision[];
  audit: AuditRecord[];
  scenarios: ScenarioInfo[];
  scheduler: SchedulerStatus;
  generatedAt: string;
}

export interface SessionCreated {
  sessionId: string;
  dashboard: Dashboard;
}

export interface AuditResponse {
  sessionId: string;
  records: AuditRecord[];
}

export interface AreasResponse {
  areas: Area[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  time: string;
  appEnv: string;
  database: "ok" | "error";
  scheduler: SchedulerStatus | null;
  teamModels: "trained" | "not-trained";
  funding: "simulated-only";
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/* ----------------------------- Models ----------------------------- */

export type ModelId = "ecmwf-aifs" | "random-forest" | "neural-network";

export interface ModelInfo {
  id: ModelId;
  name: string;
  trainedBy: string;
  kind: string;
  status: "available" | "trained" | "not-trained";
  statusReason: string | null;
  version: string | null;
  trainedAt: string | null;
  usesAifsAsInput: boolean;
  description: string;
  features: string[] | null;
  hyperparameters: Record<string, unknown> | null;
  trainingSeconds: number | null;
}

export interface ModelsResponse {
  models: ModelInfo[];
  note: string;
}

export interface ModelMetrics {
  modelId: ModelId;
  nExamples: number;
  nDates: number;
  maeMm: number | null;
  rmseMm: number | null;
  biasMm: number | null;
  nWetReferenceDays: number;
  maeWetReferenceDaysMm: number | null;
  referenceAtOrAboveThreshold: number;
  predictedAtOrAboveThreshold: number;
  truePositives: number;
  falseTriggers: number;
  missedEvents: number;
  precision: number | null;
  recall: number | null;
}

export interface MaeDifference {
  modelId: ModelId;
  maeDifferenceMm: number | null;
  ci95LowMm: number | null;
  ci95HighMm: number | null;
  nDates: number;
  method: string;
}

export interface SplitInfo {
  start: string;
  end: string;
  nDates: number;
  nExamples: number;
}

export interface BenchmarkTestRow {
  locationId: string;
  targetDate: string;
  referenceMm: number;
  aifsMm: number;
  randomForestMm: number;
  neuralNetworkMm: number;
}

export interface BenchmarkReport {
  schemaVersion: number;
  dataKind: string;
  generatedAt: string;
  trainedAt: string;
  thresholdMm: number;
  window: string;
  reference: string;
  features: string[];
  locations: { id: string; name: string; latitude: number; longitude: number }[];
  datasetExamples: number;
  splits: { train: SplitInfo; validation: SplitInfo; test: SplitInfo };
  splitMethod: string;
  selection: string;
  models: {
    id: ModelId;
    name: string;
    trainedBy: string;
    version: string;
    trainingSeconds: number | null;
    hyperparameters: Record<string, unknown> | null;
    usesAifsAsInput: boolean;
  }[];
  validation: { fittedOn: string; metrics: ModelMetrics[]; differencesVsAifs: MaeDifference[] };
  test: { fittedOn: string; metrics: ModelMetrics[]; differencesVsAifs: MaeDifference[] };
  sameRowsVerified: boolean;
  testRowKeysSha256: string;
  recommendation: {
    basis: string;
    validationLeader: ModelId;
    reliable: boolean;
    reasons: string[];
    liveDashboardModel: ModelId;
    liveDashboardReason: string;
  };
  availabilityAssumption: string;
  referenceLimitations: string[];
  caveats: string[];
  libraries: Record<string, string>;
  testRows: BenchmarkTestRow[];
}

export interface BenchmarkResponse {
  status: "available" | "unavailable";
  reason: string | null;
  report: BenchmarkReport | null;
}

export interface ComparisonPrediction {
  modelId: ModelId;
  name: string;
  rainfallMm: number | null;
  status: "ok" | "not-trained" | "unavailable";
  note: string | null;
}

export interface ComparisonResponse {
  status: "available" | "unavailable";
  reason: string | null;
  areaId: string;
  date: string;
  windowLabel: string;
  windowStart: string;
  windowEnd: string;
  modelRunAt: string;
  decisionCutoffAt: string;
  availability: "assumed";
  predictions: ComparisonPrediction[];
  reference: { source: string; valueMm: number | null; note: string };
  /** Whether the requested day was part of the team models' training data. */
  splitMembership: "train" | "validation" | "test" | "outside" | "unknown";
  notes: string[];
  createsAllocations: false;
}
