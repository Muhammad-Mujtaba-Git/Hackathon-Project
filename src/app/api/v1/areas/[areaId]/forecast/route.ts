import { config } from "@/lib/config";
import { getLiveForecast } from "@/lib/floodfund/forecast";
import { fail, handle, ok, type AreaContext } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

/** Real AIFS forecast for the next 24 complete hours. Read-only: never evaluates the funding rule. */
export async function GET(_req: Request, ctx: AreaContext) {
  return handle(async () => {
    const { areaId } = await ctx.params;
    if (areaId !== config.area.id) return fail(404, "area_not_found", `Unknown area "${areaId}". Available: ${config.area.id}.`);
    return ok(await getLiveForecast());
  });
}
