import { getLiveForecast } from "@/lib/floodfund/forecast";
import { buildDashboard, evaluateForecast } from "@/lib/floodfund/funding";
import { handle, ok, sessionIdFrom, type SessionContext } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

/**
 * Fetch the real forecast and evaluate the simulated funding rule.
 * Stale, unverified, invalid or unavailable data is recorded as
 * "cannot evaluate" and never allocates.
 */
export async function POST(_req: Request, ctx: SessionContext) {
  return handle(async () => {
    const sessionId = await sessionIdFrom(ctx);
    const forecast = await getLiveForecast();
    await evaluateForecast(sessionId, forecast, { trigger: "manual" });
    return ok(await buildDashboard(sessionId, { liveForecast: forecast }));
  });
}
