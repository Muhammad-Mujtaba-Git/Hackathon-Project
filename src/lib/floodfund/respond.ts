import { NotFoundError, isSessionId } from "./funding";
import type { ApiErrorBody } from "./types";

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Wrap a handler so every failure becomes a clear JSON error (no stack traces, no secrets). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NotFoundError) {
      return fail(404, "session_not_found", "This demo session does not exist. Create a new session.");
    }
    console.error("[floodfund] request failed:", err instanceof Error ? err.message : err);
    return fail(500, "internal_error", "The server could not complete the request.");
  }
}

export type SessionContext = { params: Promise<{ sessionId: string }> };
export type AreaContext = { params: Promise<{ areaId: string }> };

export async function sessionIdFrom(ctx: SessionContext): Promise<string> {
  const { sessionId } = await ctx.params;
  if (!isSessionId(sessionId)) throw new NotFoundError("Session not found.");
  return sessionId;
}
