import { listAudit } from "@/lib/floodfund/funding";
import { handle, ok, sessionIdFrom, type SessionContext } from "@/lib/floodfund/respond";
import type { AuditResponse } from "@/lib/floodfund/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: SessionContext) {
  return handle(async () => {
    const sessionId = await sessionIdFrom(ctx);
    const body: AuditResponse = { sessionId, records: await listAudit(sessionId) };
    return ok(body);
  });
}
