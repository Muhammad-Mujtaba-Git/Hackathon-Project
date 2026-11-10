import { buildDashboard, evaluateForecast } from "@/lib/floodfund/funding";
import { fail, handle, ok, sessionIdFrom, type SessionContext } from "@/lib/floodfund/respond";
import { SCENARIO_IDS, buildScenarioForecast, isScenarioId } from "@/lib/floodfund/scenarios";

export const dynamic = "force-dynamic";

/** Evaluate a deterministic DEMO scenario (synthetic values, always labelled DEMO). */
export async function POST(req: Request, ctx: SessionContext) {
  return handle(async () => {
    const sessionId = await sessionIdFrom(ctx);
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      /* handled below */
    }
    const scenarioId = (body as { scenarioId?: unknown } | null)?.scenarioId;
    if (!isScenarioId(scenarioId)) {
      return fail(400, "invalid_scenario", `scenarioId must be one of: ${SCENARIO_IDS.join(", ")}.`);
    }
    await evaluateForecast(sessionId, buildScenarioForecast(scenarioId, Date.now()), { trigger: "scenario" });
    return ok(await buildDashboard(sessionId));
  });
}
