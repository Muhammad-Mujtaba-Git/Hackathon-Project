import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { config } from "@/lib/config";
import { getSchedulerStatus } from "@/lib/floodfund/funding";
import { loadArtifacts, teamModelStatus } from "@/lib/floodfund/models";
import { handle, ok } from "@/lib/floodfund/respond";
import type { HealthResponse, SchedulerStatus } from "@/lib/floodfund/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    let database: HealthResponse["database"] = "ok";
    let scheduler: SchedulerStatus | null = null;
    try {
      await ensureSchema();
      await db.execute(sql`select 1`);
      scheduler = await getSchedulerStatus();
    } catch {
      database = "error";
    }
    const trained = teamModelStatus(await loadArtifacts()).trained;
    const body: HealthResponse = {
      status: database === "ok" ? "ok" : "degraded",
      service: "FloodFund Karachi API",
      time: new Date().toISOString(),
      appEnv: config.appEnv,
      database,
      scheduler,
      teamModels: trained ? "trained" : "not-trained",
      funding: "simulated-only",
    };
    return ok(body, database === "ok" ? 200 : 503);
  });
}
