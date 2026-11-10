import type { Metadata } from "next";
import ControlRoom from "@/components/ff/ControlRoom";

export const metadata: Metadata = {
  title: "Control Room · FloodFund Karachi",
  description: "Live AIFS rainfall forecast, NASA satellite context, the simulated funding rule and its audit trail for Karachi.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ scenario?: string | string[] }> }) {
  const sp = await searchParams;
  const scenario = typeof sp.scenario === "string" ? sp.scenario : null;
  return <ControlRoom initialScenario={scenario} />;
}
