import { listModels } from "@/lib/floodfund/models";
import { handle, ok } from "@/lib/floodfund/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ok(await listModels()));
}
