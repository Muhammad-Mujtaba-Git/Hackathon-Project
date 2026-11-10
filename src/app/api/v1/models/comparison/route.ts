import { config } from "@/lib/config";
import { getComparison } from "@/lib/floodfund/models";
import { fail, handle, ok } from "@/lib/floodfund/respond";
import { utcDayStart } from "@/lib/floodfund/time";

export const dynamic = "force-dynamic";

/** All three models for the SAME fixed UTC day. Read-only: never creates a funding allocation. */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const areaId = url.searchParams.get("areaId") ?? config.area.id;
    const date = url.searchParams.get("date") ?? "";
    if (areaId !== config.area.id) return fail(404, "area_not_found", `Unknown area "${areaId}". Available: ${config.area.id}.`);
    if (utcDayStart(date) === null) return fail(400, "invalid_date", "date must be a real calendar day in the form YYYY-MM-DD (UTC).");
    return ok(await getComparison(date));
  });
}
