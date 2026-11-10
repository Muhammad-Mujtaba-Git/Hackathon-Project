import { config } from "../config";

export class ProviderError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

const USER_AGENT = "FloodFundKarachi-hackathon/1.0";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function log(message: string) {
  if (config.appEnv !== "test") console.info(`[floodfund] ${message}`);
}

/** Host + path only: query strings are never logged, so no token could leak even if one were added later. */
function safeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "invalid-url";
  }
}

/**
 * GET with a hard timeout and a small number of retries for transient failures.
 * Throws ProviderError; it never substitutes placeholder data.
 */
export async function providerFetch(url: string, label: string): Promise<Response> {
  let last: ProviderError = new ProviderError(`${label}: request failed.`);
  for (let attempt = 0; attempt <= config.httpMaxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.httpTimeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      });
      if (res.ok) {
        log(`${label} ${res.status} ${Date.now() - started}ms ${safeTarget(url)}`);
        return res;
      }
      let reason = "";
      try {
        const body: unknown = await res.clone().json();
        if (body && typeof body === "object" && "reason" in body) reason = String((body as { reason: unknown }).reason);
      } catch {
        /* non-JSON error body */
      }
      last = new ProviderError(`${label}: HTTP ${res.status}${reason ? ` – ${reason}` : ""}`, res.status);
      log(`${label} failed ${res.status} ${safeTarget(url)}`);
      if (!RETRYABLE.has(res.status)) throw last;
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.status !== null && !RETRYABLE.has(err.status)) throw err;
        last = err;
      } else {
        const aborted = err instanceof Error && err.name === "AbortError";
        last = new ProviderError(
          aborted ? `${label}: timed out after ${config.httpTimeoutMs} ms.` : `${label}: network error.`,
        );
        log(`${label} ${aborted ? "timeout" : "network error"} ${safeTarget(url)}`);
      }
    } finally {
      clearTimeout(timer);
    }
    if (attempt < config.httpMaxRetries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw last;
}

export async function providerJson(url: string, label: string): Promise<unknown> {
  const res = await providerFetch(url, label);
  try {
    return await res.json();
  } catch {
    throw new ProviderError(`${label}: response was not valid JSON.`);
  }
}

export async function providerText(url: string, label: string): Promise<string> {
  const res = await providerFetch(url, label);
  return res.text();
}
