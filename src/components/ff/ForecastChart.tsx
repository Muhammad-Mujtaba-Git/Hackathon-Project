"use client";

import { useReducedMotion } from "framer-motion";
import { CloudOff } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Forecast } from "@/lib/floodfund/types";

interface Row {
  label: string;
  mm: number;
  start: string;
  end: string;
}

function renderTip(props: unknown) {
  const p = props as { active?: boolean; payload?: { payload: Row }[] };
  const row = p.active ? p.payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-[#0a1830] px-3 py-2 text-xs shadow-xl">
      <p className="ff-num text-slate-400">
        {row.start.slice(5, 10)} {row.start.slice(11, 16)} → {row.end.slice(11, 16)} UTC
      </p>
      <p className="ff-num mt-0.5 text-sm font-semibold text-white">{row.mm.toFixed(1)} mm</p>
    </div>
  );
}

export default function ForecastChart({ forecast }: { forecast: Forecast }) {
  const reduce = useReducedMotion();
  if (forecast.hourly.length === 0) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-dashed border-white/12 px-6 text-center">
        <div>
          <CloudOff size={26} aria-hidden="true" className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-200">No hourly values to show</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">{forecast.statusReason} Missing data is never drawn as zero.</p>
        </div>
      </div>
    );
  }
  const demo = forecast.dataKind === "demo";
  const data: Row[] = forecast.hourly.map((h) => ({ label: `${h.intervalEnd.slice(11, 13)}Z`, mm: h.precipitationMm, start: h.intervalStart, end: h.intervalEnd }));
  const max = Math.max(...data.map((d) => d.mm));
  const color = demo ? "#a78bfa" : "#22d3ee";
  const tick = { fill: "#8aa0b8", fontSize: 10, fontFamily: "var(--font-mono)" };

  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={`Bar chart of 24 hourly rainfall values, total ${forecast.totalMm} millimetres, highest hour ${max.toFixed(1)} millimetres`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke="rgba(148,197,255,0.09)" vertical={false} />
            <XAxis dataKey="label" tick={tick} interval={2} axisLine={false} tickLine={false} />
            <YAxis tick={tick} width={40} axisLine={false} tickLine={false} domain={[0, max > 0 ? "auto" : 1]} allowDecimals />
            <Tooltip cursor={{ fill: "rgba(148,197,255,0.07)" }} content={renderTip} />
            <Bar dataKey="mm" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.end} fill={color} fillOpacity={0.4 + 0.6 * (max > 0 ? d.mm / max : 0)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="ff-num mt-1 text-[0.68rem] text-slate-500">
        {max === 0 ? "All 24 hourly values are 0.0 mm. " : ""}
        Labels show the end of each hour (UTC). Each bar is the rain of the preceding hour, in mm.
      </p>
    </div>
  );
}
