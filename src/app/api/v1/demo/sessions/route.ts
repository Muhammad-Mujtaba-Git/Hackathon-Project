import { buildDashboard, createSession } from "@/lib/floodfund/funding";
import { handle, ok } from "@/lib/floodfund/respond";
import type { SessionCreated } from "@/lib/floodfund/types";

export const dynamic = "force-dynamic";

/** Create an isolated demo session: LIVE mode, full simulated budget, nothing evaluated yet. */
export async function POST() {
  return handle(async () => {
    const sessionId = await createSession();
    const body: SessionCreated = { sessionId, dashboard: await buildDashboard(sessionId) };
    return ok(body, 201);
  });
}
