import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";

/**
 * CORS for /api/v1, driven by CORS_ORIGINS. The bundled frontend is served
 * from the same origin and needs none of this; it only matters when another
 * site is explicitly allowed to call the API.
 */
function allow(res: NextResponse, origin: string) {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "600");
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = !!origin && (appConfig.corsOrigins.includes("*") || appConfig.corsOrigins.includes(origin));
  const res = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  if (allowed && origin) allow(res, origin);
  return res;
}

export const config = { matcher: "/api/v1/:path*" };
