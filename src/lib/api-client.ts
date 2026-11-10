import type {
  ApiErrorBody,
  AreasResponse,
  AuditResponse,
  BenchmarkResponse,
  ComparisonResponse,
  Dashboard,
  Forecast,
  HealthResponse,
  ModelsResponse,
  SatelliteLayer,
  ScenarioId,
  SessionCreated,
} from "./floodfund/types";

/**
 * Central typed API client. Every call uses a RELATIVE path (/api/v1/...), so
 * the browser always talks to the origin that served the page. That works on
 * localhost and on any remote preview host without configuration.
 */
const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** The backend could not be reached at all (network failure or gateway error). */
export class BackendUnreachableError extends Error {
  constructor() {
    super("Backend not connected.");
    this.name = "BackendUnreachableError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    throw new BackendUnreachableError();
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    if (!err && res.status >= 502) throw new BackendUnreachableError();
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (HTTP ${res.status}).`);
  }
  if (body === null) throw new ApiError(res.status, "invalid_response", "The backend returned an empty response.");
  return body as T;
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<HealthResponse>("/health"),
  areas: () => request<AreasResponse>("/areas"),
  forecast: (areaId = "karachi") => request<Forecast>(`/areas/${areaId}/forecast`),
  satellite: (areaId = "karachi") => request<SatelliteLayer>(`/areas/${areaId}/satellite`),
  createSession: () => request<SessionCreated>("/demo/sessions", post()),
  getDashboard: (sessionId: string) => request<Dashboard>(`/demo/sessions/${sessionId}/dashboard`),
  evaluateLive: (sessionId: string) => request<Dashboard>(`/demo/sessions/${sessionId}/evaluate-live`, post()),
  runScenario: (sessionId: string, scenarioId: ScenarioId) =>
    request<Dashboard>(`/demo/sessions/${sessionId}/scenarios`, post({ scenarioId })),
  reset: (sessionId: string) => request<Dashboard>(`/demo/sessions/${sessionId}/reset`, post()),
  audit: (sessionId: string) => request<AuditResponse>(`/demo/sessions/${sessionId}/audit`),
  models: () => request<ModelsResponse>("/models"),
  benchmark: () => request<BenchmarkResponse>("/models/benchmark"),
  comparison: (date: string, areaId = "karachi") =>
    request<ComparisonResponse>(`/models/comparison?areaId=${encodeURIComponent(areaId)}&date=${encodeURIComponent(date)}`),
};
