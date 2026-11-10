import { config } from "@/lib/config";
import { ok } from "@/lib/floodfund/respond";
import type { AreasResponse } from "@/lib/floodfund/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const body: AreasResponse = { areas: [{ ...config.area }] };
  return ok(body);
}
