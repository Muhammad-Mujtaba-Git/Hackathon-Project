import { config } from "@/lib/config";
import { fail, handle, ok, type AreaContext } from "@/lib/floodfund/respond";
import { getSatelliteLayer } from "@/lib/floodfund/satellite";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: AreaContext) {
  return handle(async () => {
    const { areaId } = await ctx.params;
    if (areaId !== config.area.id) return fail(404, "area_not_found", `Unknown area "${areaId}". Available: ${config.area.id}.`);
    return ok(await getSatelliteLayer());
  });
}
