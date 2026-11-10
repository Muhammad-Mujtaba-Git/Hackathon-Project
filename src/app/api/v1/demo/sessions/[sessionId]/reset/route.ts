import { buildDashboard, resetSession } from "@/lib/floodfund/funding";
import { handle, ok, sessionIdFrom, type SessionContext } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

/** Reset only this session: simulated budget restored, allocations cleared, back to LIVE mode. */
export async function POST(_req: Request, ctx: SessionContext) {
  return handle(async () => {
    const sessionId = await sessionIdFrom(ctx);
    await resetSession(sessionId);
    return ok(await buildDashboard(sessionId));
  });
}
