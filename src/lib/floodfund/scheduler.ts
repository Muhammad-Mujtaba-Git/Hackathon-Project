import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db";
import { ensureSchema } from "../../db/ensure";
import { schedulerState, sessions } from "../../db/schema";
import { config } from "../config";
import { getLiveForecast } from "./forecast";
import { evaluateForecast } from "./funding";

/**
 * Automatic live checks for a single-process deployment.
 *
 * Every LIVE_REFRESH_MINUTES the real forecast is refreshed and the demo rule
 * is evaluated for recently active LIVE sessions. Database idempotency makes
 * repeated checks safe; stale, missing or unverified data never allocates.
 * This sends no alerts of any kind. It only runs while the server process is
 * alive and is not a multi-worker production scheduler.
 */

const g = globalThis as typeof globalThis & { __ffScheduler?: { timer: ReturnType<typeof setInterval>; running: boolean } };

/** `onlySessionIds` restricts a tick to specific sessions (used by tests so they never touch other sessions). */
export async function runSchedulerTick(options: { onlySessionIds?: string[] } = {}): Promise<{ checked: number; error: string | null }> {
  let checked = 0;
  let error: string | null = null;
  const now = new Date();
  try {
    await ensureSchema();
    const forecast = await getLiveForecast();
    const since = new Date(now.getTime() - config.sessionActiveHours * 3_600_000);
    const active = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.mode, "live"),
          gt(sessions.lastActiveAt, since),
          options.onlySessionIds ? inArray(sessions.id, options.onlySessionIds) : undefined,
        ),
      )
      .orderBy(desc(sessions.lastActiveAt))
      .limit(100);
    for (const s of active) {
      try {
        await evaluateForecast(s.id, forecast, { trigger: "scheduler", dedupe: true });
        checked++;
      } catch (err) {
        error = `Session check failed: ${err instanceof Error ? err.message : "unknown error"}`;
      }
    }
    if (forecast.status !== "fresh" && !error) {
      error = `Live forecast is ${forecast.status}; no allocation can be made. ${forecast.statusReason}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown scheduler error.";
  }
  try {
    const base = { lastRunAt: now, sessionsChecked: checked };
    const values = error ? { ...base, lastError: error, lastErrorAt: now } : { ...base, lastSuccessAt: now, lastError: null };
    await db.insert(schedulerState).values({ id: 1, ...values }).onConflictDoUpdate({ target: schedulerState.id, set: values });
  } catch (err) {
    console.error("[floodfund] scheduler state could not be saved", err instanceof Error ? err.message : err);
  }
  if (error) console.warn(`[floodfund] scheduler: ${error}`);
  return { checked, error };
}

export function startScheduler(): void {
  if (!config.liveSchedulerEnabled || g.__ffScheduler) return;
  const tick = async () => {
    const s = g.__ffScheduler;
    if (!s || s.running) return;
    s.running = true;
    try {
      await runSchedulerTick({});
    } finally {
      s.running = false;
    }
  };
  const timer = setInterval(tick, config.liveRefreshMinutes * 60_000);
  timer.unref?.();
  g.__ffScheduler = { timer, running: false };
  const first = setTimeout(tick, 20_000);
  first.unref?.();
  console.info(`[floodfund] live scheduler started (every ${config.liveRefreshMinutes} min)`);
}
