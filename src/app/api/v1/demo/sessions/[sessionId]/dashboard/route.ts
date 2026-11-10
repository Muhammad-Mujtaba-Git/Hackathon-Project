import { buildDashboard } from "@/lib/floodfund/funding";
import { handle, ok, sessionIdFrom, type SessionContext } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

/** Read-only snapshot. Performs no writes, so it can never create an allocation. */
export async function GET(_req: Request, ctx: SessionContext) {
  return handle(async () => ok(await buildDashboard(await sessionIdFrom(ctx))));
}
