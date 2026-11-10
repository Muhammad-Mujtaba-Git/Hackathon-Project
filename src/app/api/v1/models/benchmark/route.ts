import { getBenchmark } from "@/lib/floodfund/models";
import { handle, ok } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

/** The real saved benchmark report, or an explicit "unavailable" status. Never invented numbers. */
export async function GET() {
  return handle(async () => ok(await getBenchmark()));
}
