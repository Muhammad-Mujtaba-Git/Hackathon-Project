"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Ban, Banknote, Check, ChevronDown, CircleCheck, CircleDashed, CircleX, CloudOff, Database, FlaskConical, History, Hourglass,
  Info, ListChecks, Minus, Radio, RefreshCw, ShieldAlert, ShieldCheck, TriangleAlert, Wallet,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import type { AuditRecord, Dashboard, DataStatus, Decision, DecisionStatus, Forecast, Policy, SatelliteLayer, ScenarioId } from "@/lib/floodfund/types";
import type { Busy } from "./ControlRoom";
import { AnimatedNumber, Glass, Pill, fmtPkr, fmtPkt, fmtUtc, type Tone } from "./ui";

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

const STATUS_META: Record<DataStatus, { tone: Tone; label: string; Icon: IconType }> = {
  fresh: { tone: "ok", label: "Fresh · verified", Icon: ShieldCheck },
  stale: { tone: "warn", label: "Stale", Icon: Hourglass },
  unverified: { tone: "warn", label: "Unverified", Icon: ShieldAlert },
  unavailable: { tone: "crit", label: "Unavailable", Icon: CloudOff },
  invalid: { tone: "crit", label: "Invalid data", Icon: TriangleAlert },
};

const DECISION_META: Record<DecisionStatus, { tone: Tone; title: string; Icon: IconType; color: string }> = {
  allocated: { tone: "ok", title: "Simulated allocation recorded", Icon: Banknote, color: "text-emerald-300" },
  already_allocated: { tone: "info", title: "Already allocated for this event", Icon: CircleCheck, color: "text-cyan-300" },
  below_threshold: { tone: "muted", title: "No allocation · below threshold", Icon: Minus, color: "text-slate-300" },
  insufficient_budget: { tone: "crit", title: "No allocation · simulated budget too low", Icon: Wallet, color: "text-red-300" },
  policy_inactive: { tone: "warn", title: "No allocation · policy inactive", Icon: Ban, color: "text-amber-300" },
  cannot_evaluate: { tone: "warn", title: "Cannot evaluate · data not usable", Icon: ShieldAlert, color: "text-amber-300" },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="ff-num mt-0.5 break-words text-[0.8rem] text-slate-200">{children}</dd>
    </div>
  );
}

/* ----------------------------- Forecast ----------------------------- */

export function ForecastCard({ forecast, policy }: { forecast: Forecast; policy: Policy }) {
  const meta = STATUS_META[forecast.status];
  const demo = forecast.dataKind === "demo";
  const total = forecast.totalMm;
  const scaleMax = Math.max(120, total !== null ? Math.ceil((total * 1.15) / 20) * 20 : 120);
  const pct = total !== null ? Math.min(100, (total / scaleMax) * 100) : 0;
  const thresholdPct = (policy.thresholdMm / scaleMax) * 100;
  const meets = total !== null && total >= policy.thresholdMm;
  const StatusIcon = meta.Icon;
  const usable = forecast.status === "fresh";

  return (
    <Glass className="p-5 sm:p-6" aria-labelledby="forecast-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="ff-eyebrow">Rolling window · next 24 complete hours</p>
          <h2 id="forecast-title" className="mt-1 text-lg font-semibold text-white">Rainfall forecast · Karachi</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={demo ? "demo" : "info"} icon={demo ? <FlaskConical size={12} aria-hidden="true" /> : <Radio size={12} aria-hidden="true" />}>
            {demo ? "Demo · synthetic" : "Live · real data"}
          </Pill>
          <Pill tone={meta.tone} icon={<StatusIcon size={12} aria-hidden="true" />}>{meta.label}</Pill>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-3" aria-live="polite">
        <p className="ff-num text-6xl font-semibold leading-none text-white sm:text-7xl">
          {total !== null ? <AnimatedNumber value={total} decimals={1} /> : <span className="text-slate-600">—</span>}
        </p>
        <div className="pb-1">
          <p className="ff-num text-xl text-slate-300">mm</p>
          <p className="text-xs text-slate-400">{total === null ? "no value available" : "forecast total, 24 h"}</p>
        </div>
      </div>

      <div className="mt-5" role="img" aria-label={total === null ? "No forecast total available" : `Forecast ${total} millimetres against the ${policy.thresholdMm} millimetre example threshold: ${meets ? "at or above" : "below"} the threshold`}>
        <div className="relative h-3 rounded-full bg-white/[0.07]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ${meets ? "bg-gradient-to-r from-cyan-400 via-amber-300 to-red-400" : demo ? "bg-gradient-to-r from-violet-400 to-cyan-300" : "bg-gradient-to-r from-teal-300 to-cyan-400"}`}
            style={{ width: `${pct}%` }}
          />
          <div className="absolute -top-1.5 h-6 w-0.5 rounded bg-amber-300" style={{ left: `${thresholdPct}%` }} />
        </div>
        <div className="ff-num relative mt-2 h-4 text-[0.68rem] text-slate-400">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-amber-200" style={{ left: `${thresholdPct}%` }}>
            {policy.thresholdMm} mm example rule
          </span>
          <span className="absolute right-0">{scaleMax}</span>
        </div>
      </div>

      <p className={`mt-4 rounded-xl border p-3 text-[0.82rem] leading-relaxed ${usable ? "border-white/10 bg-white/[0.03] text-slate-300" : forecast.status === "unavailable" || forecast.status === "invalid" ? "border-red-400/35 bg-red-500/10 text-red-100" : "border-amber-400/35 bg-amber-400/10 text-amber-100"}`}>
        {forecast.statusReason}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
        <Field label="Forecast window (UTC)">{forecast.windowStart ? `${fmtUtc(forecast.windowStart)} → ${fmtUtc(forecast.windowEnd)}` : "—"}</Field>
        <Field label="Same window, Karachi time">{forecast.windowStart ? `${fmtPkt(forecast.windowStart)} → ${fmtPkt(forecast.windowEnd)}` : "—"}</Field>
        <Field label="Source">{forecast.source}</Field>
        <Field label="Model">{forecast.model}</Field>
        <Field label={demo ? "Simulated model run" : "Model run (initialised)"}>{forecast.modelRunAt ? `${fmtUtc(forecast.modelRunAt)}${forecast.runAgeHours !== null ? ` · ${forecast.runAgeHours} h old` : ""}` : "not verified"}</Field>
        <Field label="Available at provider">{forecast.providerAvailableAt ? fmtUtc(forecast.providerAvailableAt) : demo ? "not applicable" : "not verified"}</Field>
        <Field label="Retrieved by backend">{fmtUtc(forecast.retrievedAt)}</Field>
        <Field label="Model grid point">{forecast.gridLocation ? `${forecast.gridLocation.latitude.toFixed(2)}°N ${forecast.gridLocation.longitude.toFixed(2)}°E` : demo ? "not applicable" : "—"}</Field>
      </dl>

      {forecast.notes.length > 0 && (
        <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[0.8rem] text-slate-300">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 font-medium text-slate-200">
            <span className="flex items-center gap-2"><Info size={14} aria-hidden="true" className="text-cyan-300" /> What this number can and cannot tell you</span>
            <ChevronDown size={15} aria-hidden="true" className="transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2 list-disc space-y-1.5 pb-2 pl-5 leading-relaxed text-slate-400">
            {forecast.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </details>
      )}
    </Glass>
  );
}

export function HourlyTable({ forecast }: { forecast: Forecast }) {
  if (forecast.hourly.length === 0) return null;
  return (
    <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[0.8rem]">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-medium text-slate-200">
        Show the 24 hourly values as a table
        <ChevronDown size={15} aria-hidden="true" className="transition group-open:rotate-180" />
      </summary>
      <div className="ff-scroll mt-2 max-h-64 overflow-auto pb-2" tabIndex={0}>
        <table className="ff-num w-full text-left text-xs text-slate-300">
          <thead className="text-slate-500">
            <tr><th scope="col" className="py-1 pr-3 font-medium">Interval (UTC)</th><th scope="col" className="py-1 text-right font-medium">Rain (mm)</th></tr>
          </thead>
          <tbody>
            {forecast.hourly.map((h) => (
              <tr key={h.intervalEnd} className="border-t border-white/5">
                <td className="py-1 pr-3">{fmtUtc(h.intervalStart).replace(" UTC", "")} → {h.intervalEnd.slice(11, 16)}</td>
                <td className="py-1 text-right">{h.precipitationMm.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* ----------------------------- Forecast → funding link ----------------------------- */

export function FlowLink({ decision, policy }: { decision: Decision | null; policy: Policy }) {
  const s = decision?.status;
  const active = s === "allocated" || s === "already_allocated";
  const blocked = s === "cannot_evaluate" || s === "policy_inactive" || s === "insufficient_budget";
  const stroke = active ? "#34d399" : blocked ? "#fbbf24" : "#64748b";
  return (
    <div className="relative flex h-14 items-center justify-center" aria-hidden="true">
      <svg width="24" height="56" viewBox="0 0 24 56" className="overflow-visible">
        <line x1="12" y1="0" x2="12" y2="56" stroke={stroke} strokeOpacity="0.25" strokeWidth="2" />
        <line x1="12" y1="0" x2="12" y2="56" stroke={stroke} strokeWidth="2" strokeLinecap="round" className={active ? "ff-flow" : ""} strokeDasharray={active ? undefined : "2 6"} />
      </svg>
      <span className="ff-num absolute rounded-full border bg-[#071226] px-3 py-1 text-[0.62rem] uppercase tracking-[0.14em]" style={{ borderColor: `${stroke}66`, color: active ? "#a7f3d0" : blocked ? "#fde68a" : "#94a3b8" }}>
        Rule · fresh data · ≥ {policy.thresholdMm} mm
      </span>
    </div>
  );
}

/* ----------------------------- Decision + budget ----------------------------- */

export function DecisionCard({ dashboard, busy }: { dashboard: Dashboard; busy: Busy }) {
  const { decision, budget, allocations, policy } = dashboard;
  const meta = decision ? DECISION_META[decision.status] : null;
  const Icon = meta?.Icon ?? CircleDashed;
  const remainingPct = budget.initialPkr > 0 ? (budget.remainingPkr / budget.initialPkr) * 100 : 0;

  return (
    <Glass className="flex-1 p-5 sm:p-6" aria-labelledby="decision-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="ff-eyebrow">Funding rule outcome</p>
          <h2 id="decision-title" className="mt-1 text-lg font-semibold text-white">Decision and simulated budget</h2>
        </div>
        <Pill tone="demo" icon={<Wallet size={12} aria-hidden="true" />}>Simulated money</Pill>
      </div>

      <div aria-live="polite" className="mt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={decision ? `${decision.id}` : "none"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className={`rounded-2xl border p-4 ${decision?.status === "allocated" ? "border-emerald-400/40 bg-emerald-400/[0.08] shadow-[0_0_50px_-18px_rgba(52,211,153,0.7)]" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="flex items-start gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#071226] ${meta?.color ?? "text-slate-400"}`}>
                <Icon size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">{busy === "live" && !decision ? "Checking the live forecast…" : (meta?.title ?? "Not evaluated yet")}</p>
                <p className="mt-1 text-[0.84rem] leading-relaxed text-slate-300">
                  {decision ? decision.reason : "Run a live check or choose a demo scenario to evaluate the rule. Viewing this page never creates an allocation."}
                </p>
              </div>
            </div>
            {decision && (
              <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 border-t border-white/10 pt-3 sm:grid-cols-3">
                <Field label="Event ID">{decision.eventId ?? "none"}</Field>
                <Field label="Evaluated">{fmtUtc(decision.evaluatedAt)}</Field>
                <Field label="Triggered by">{decision.trigger === "scheduler" ? "automatic check" : decision.trigger === "scenario" ? "demo scenario" : "manual live check"}</Field>
              </dl>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">Simulated budget remaining</p>
            <p className="ff-num mt-1 text-3xl font-semibold text-white sm:text-4xl">
              <span className="mr-2 text-base font-medium text-slate-400">PKR</span>
              <AnimatedNumber value={budget.remainingPkr} />
            </p>
          </div>
          <p className="ff-num pb-1 text-right text-xs text-slate-400">
            of {fmtPkr(budget.initialPkr)}
            <br />
            {budget.allocationCount} allocation{budget.allocationCount === 1 ? "" : "s"} · {fmtPkr(budget.allocatedPkr)}
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={`${Math.round(remainingPct)} percent of the simulated budget remains`}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 transition-[width] duration-700" style={{ width: `${remainingPct}%` }} />
        </div>
      </div>

      {allocations.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {allocations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[0.8rem]">
              <span className="ff-num flex items-center gap-2 text-slate-200">
                <Banknote size={14} aria-hidden="true" className="text-emerald-300" /> #{a.id} · {a.eventId}
              </span>
              <span className="ff-num text-slate-400">{a.forecastTotalMm.toFixed(1)} mm · {fmtUtc(a.createdAt)}</span>
              <span className="ff-num font-semibold text-white">{fmtPkr(a.amountPkr)} <span className="ml-1 text-[0.62rem] font-medium tracking-[0.14em] text-violet-300">SIMULATED</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-white/12 px-3 py-3 text-[0.8rem] text-slate-400">No simulated allocations in this session.</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{policy.disclaimer}</p>
    </Glass>
  );
}

/* ----------------------------- Scenarios ----------------------------- */

export function ScenarioPanel({ dashboard, busy, onScenario, onLive }: { dashboard: Dashboard; busy: Busy; onScenario: (s: ScenarioId) => void; onLive: () => void }) {
  const live = dashboard.mode === "live";
  return (
    <Glass className="h-full p-5 sm:p-6" aria-labelledby="scenario-title">
      <p className="ff-eyebrow">Mode</p>
      <h2 id="scenario-title" className="mt-1 text-lg font-semibold text-white">Live check or demo scenario</h2>

      <button
        type="button"
        onClick={onLive}
        disabled={busy !== null}
        aria-pressed={live}
        className={`mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${live ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/12 bg-white/[0.03] hover:bg-white/[0.07]"}`}
      >
        <span>
          <span className="flex items-center gap-2 font-semibold text-white"><Radio size={16} aria-hidden="true" className="text-cyan-300" /> Check live forecast now</span>
          <span className="mt-0.5 block text-xs text-slate-400">Fetches the real AIFS forecast and evaluates the rule{live ? " · current mode" : ""}</span>
        </span>
        <RefreshCw size={17} aria-hidden="true" className={`shrink-0 text-cyan-200 ${busy === "live" ? "animate-spin" : ""}`} />
      </button>

      <p className="mt-5 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.14em] text-violet-300">
        <FlaskConical size={13} aria-hidden="true" /> Demo scenarios · synthetic values
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {dashboard.scenarios.map((s) => {
          const current = !live && dashboard.scenarioId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onScenario(s.id)}
              disabled={busy !== null}
              aria-pressed={current}
              className={`min-h-24 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${current ? "border-violet-300/60 bg-violet-500/20" : "border-white/12 bg-white/[0.03] hover:border-violet-300/40 hover:bg-violet-500/10"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{s.name}</span>
                <span className="ff-num text-sm text-violet-200">{s.totalMm} mm</span>
              </span>
              <span className="ff-num mt-1 block text-[0.66rem] uppercase tracking-[0.12em] text-slate-400">
                {s.dataStatus === "stale" ? "stale data" : "fresh data"}{busy === s.id ? " · running…" : current ? " · selected" : ""}
              </span>
              <span className="mt-1.5 block text-xs leading-snug text-slate-300">{s.expected}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Each scenario is one event per session, so running it twice does not allocate twice. Use Reset session to restore the simulated
        budget. The app never switches between live and demo data on its own.
      </p>
    </Glass>
  );
}

/* ----------------------------- Event timeline ----------------------------- */

type StepState = "pass" | "stop" | "skip" | "pending";
const STEP_META: Record<StepState, { Icon: IconType; ring: string; label: string }> = {
  pass: { Icon: Check, ring: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300", label: "passed" },
  stop: { Icon: CircleX, ring: "border-amber-400/50 bg-amber-400/10 text-amber-300", label: "stopped here" },
  skip: { Icon: Minus, ring: "border-white/15 bg-white/5 text-slate-400", label: "not reached" },
  pending: { Icon: CircleDashed, ring: "border-white/15 bg-white/5 text-slate-400", label: "pending" },
};

function buildSteps(d: Dashboard): { title: string; detail: string; state: StepState }[] {
  const f = d.forecast;
  const dec = d.decision;
  const p = d.policy;
  const steps: { title: string; detail: string; state: StepState }[] = [];
  const got = f.status !== "unavailable";
  steps.push({
    title: f.dataKind === "demo" ? "Demo scenario loaded" : "Forecast retrieved",
    detail: got ? `${f.source} · ${fmtUtc(f.retrievedAt)}` : f.statusReason,
    state: got ? "pass" : "stop",
  });
  steps.push({
    title: "Validity and freshness",
    detail: got ? `Data status: ${f.status}. ${f.status === "fresh" ? "24 valid hourly values from a verified model run." : "The rule cannot use this data."}` : "No data to check.",
    state: !got ? "skip" : f.status === "fresh" ? "pass" : "stop",
  });
  if (!dec) {
    for (const title of ["Rainfall threshold", "Budget and duplicate check", "Outcome"]) steps.push({ title, detail: "The rule has not been evaluated yet.", state: "pending" });
    return steps;
  }
  const reached = dec.status !== "cannot_evaluate" && dec.status !== "policy_inactive";
  steps.push({
    title: "Rainfall threshold",
    detail: reached ? `${dec.forecastTotalMm} mm against ${p.thresholdMm} mm: ${dec.status === "below_threshold" ? "below" : "at or above"} the example threshold.` : dec.status === "policy_inactive" ? "Policy is not active." : "Not checked because the data is not usable.",
    state: !reached ? "skip" : dec.status === "below_threshold" ? "stop" : "pass",
  });
  const budgetReached = reached && dec.status !== "below_threshold";
  steps.push({
    title: "Budget and duplicate check",
    detail: !budgetReached ? "Not needed." : dec.status === "allocated" ? `Budget sufficient and event ${dec.eventId} had no allocation.` : dec.status === "already_allocated" ? `Event ${dec.eventId} already has an allocation.` : "Simulated budget is below the allocation amount.",
    state: !budgetReached ? "skip" : dec.status === "allocated" ? "pass" : "stop",
  });
  steps.push({
    title: "Outcome",
    detail: dec.status === "allocated" ? `One simulated allocation of ${fmtPkr(p.allocationPkr)} recorded at ${fmtUtc(dec.evaluatedAt)}.` : `No allocation recorded (${fmtUtc(dec.evaluatedAt)}).`,
    state: dec.status === "allocated" ? "pass" : "skip",
  });
  return steps;
}

export function TimelinePanel({ dashboard }: { dashboard: Dashboard }) {
  const steps = buildSteps(dashboard);
  return (
    <Glass className="h-full p-5 sm:p-6" aria-labelledby="timeline-title">
      <p className="ff-eyebrow">Event timeline</p>
      <h2 id="timeline-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
        <ListChecks size={18} aria-hidden="true" className="text-cyan-300" /> How this decision was reached
      </h2>
      <ol className="mt-5">
        {steps.map((s, i) => {
          const m = STEP_META[s.state];
          return (
            <li key={s.title} className="relative flex gap-3.5 pb-5 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[1.06rem] top-9 h-[calc(100%-2.25rem)] w-px bg-white/12" />}
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${m.ring}`}>
                <m.Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-white">
                  {s.title} <span className="ff-num ml-1.5 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-slate-400">{m.label}</span>
                </p>
                <p className="mt-0.5 break-words text-[0.8rem] leading-relaxed text-slate-400">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Glass>
  );
}

/* ----------------------------- Audit ----------------------------- */

const AUDIT_META: Record<string, { tone: Tone; label: string }> = {
  session_created: { tone: "info", label: "Session" },
  evaluation: { tone: "muted", label: "Rule check" },
  simulated_allocation: { tone: "ok", label: "Simulated allocation" },
  session_reset: { tone: "warn", label: "Reset" },
};

export function AuditPanel({ records }: { records: AuditRecord[] }) {
  return (
    <Glass className="flex h-full flex-col p-5 sm:p-6" aria-labelledby="audit-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="ff-eyebrow">Audit history</p>
          <h2 id="audit-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
            <History size={18} aria-hidden="true" className="text-violet-300" /> Every check, with its inputs
          </h2>
        </div>
        <p className="ff-num text-xs text-slate-400">{records.length} record{records.length === 1 ? "" : "s"} · newest first · append-only</p>
      </div>
      {records.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-white/12 px-3 py-6 text-center text-sm text-slate-400">No audit records yet.</p>
      ) : (
        <ol className="ff-scroll mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Audit records">
          {records.map((r) => {
            const m = AUDIT_META[r.type] ?? { tone: "muted" as Tone, label: r.type };
            return (
              <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={m.tone}>{m.label}</Pill>
                  <time dateTime={r.createdAt} className="ff-num text-[0.7rem] text-slate-400">{fmtUtc(r.createdAt)}</time>
                  <span className="ff-num ml-auto text-[0.66rem] text-slate-600">#{r.id}</span>
                </div>
                <p className="mt-2 break-words text-[0.82rem] leading-relaxed text-slate-200">{r.message}</p>
                {r.details && (
                  <details className="group mt-1.5">
                    <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
                      Recorded inputs <ChevronDown size={13} aria-hidden="true" className="transition group-open:rotate-180" />
                    </summary>
                    <pre className="ff-num ff-scroll mt-1 max-h-56 overflow-auto rounded-lg border border-white/10 bg-[#040b18] p-3 text-[0.68rem] leading-relaxed text-slate-300">{JSON.stringify(r.details, null, 2)}</pre>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Glass>
  );
}

/* ----------------------------- Sources & limitations ----------------------------- */

export function SourcesPanel({ dashboard, satellite }: { dashboard: Dashboard; satellite: SatelliteLayer | null }) {
  const [open, setOpen] = useState(false);
  const f = dashboard.forecast;
  const sch = dashboard.scheduler;
  const rows: [string, string, string, string][] = [
    ["Rainfall forecast", "ECMWF AIFS Single 0.25° via Open-Meteo (keyless)", "Live", f.dataKind === "live" ? `status: ${f.status}` : "demo scenario is active; live forecast not shown"],
    ["Satellite rainfall layer", "NASA GIBS · GPM IMERG daily precipitation rate (keyless)", "Live", satellite ? `${satellite.status}${satellite.observationTime ? ` · ${satellite.observationTime}` : ""}` : "not loaded"],
    ["Training reference", "NASA POWER · IMERG_PRECTOT daily, UTC (keyless)", "Offline training", "used for the model benchmark only"],
    ["Base map", "OpenStreetMap standard tiles (keyless)", "Live", "© OpenStreetMap contributors"],
    ["Funding, budget, allocations", "This application's database", "Simulated", "no real money, bank or payment provider"],
    ["Demo scenarios", "Deterministic synthetic values", "Simulated", "always labelled DEMO"],
  ];
  return (
    <Glass className="p-5 sm:p-6" aria-labelledby="sources-title">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="sources-body" className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="ff-eyebrow block">Transparency</span>
          <span id="sources-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
            <Database size={18} aria-hidden="true" className="text-teal-300" /> Data sources, automatic checks and limitations
          </span>
        </span>
        <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="sources-body" className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Where each thing comes from</h3>
            <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
              {rows.map(([what, source, kind, state]) => (
                <li key={what} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{what}</p>
                    <Pill tone={kind === "Simulated" ? "demo" : kind === "Live" ? "ok" : "muted"}>{kind}</Pill>
                  </div>
                  <p className="mt-1 text-[0.8rem] text-slate-300">{source}</p>
                  <p className="ff-num mt-0.5 text-[0.7rem] text-slate-500">{state}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Automatic live checks</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-white/10 p-3">
                <Field label="Scheduler">{sch.enabled ? `on · every ${sch.intervalMinutes} min` : "off"}</Field>
                <Field label="Last run">{fmtUtc(sch.lastRunAt)}</Field>
                <Field label="Last successful check">{fmtUtc(sch.lastSuccessAt)}</Field>
                <Field label="Sessions checked">{sch.sessionsChecked}</Field>
              </dl>
              {sch.lastError && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs leading-relaxed text-amber-100">Last issue ({fmtUtc(sch.lastErrorAt)}): {sch.lastError}</p>}
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{sch.note}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Limitations</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.82rem] leading-relaxed text-slate-300">
                <li>The 80 mm threshold is an example, not a validated flood warning level.</li>
                <li>Heavy rainfall does not guarantee flooding, and flooding can happen below the threshold.</li>
                <li>AIFS has a grid of about 28 km and 6-hourly output; it is not a street-level product.</li>
                <li>Satellite imagery is a delayed estimate of past rain. It does not affect the rule.</li>
                <li>The event ID is a demonstration mechanism, not a validated way to identify real storms.</li>
                <li>The session ID isolates demo state. It is not authentication.</li>
              </ul>
              <p className="ff-num mt-3 break-all text-[0.68rem] text-slate-600">session {dashboard.sessionId} · policy {dashboard.policy.id}</p>
            </div>
          </div>
        </div>
      )}
    </Glass>
  );
}
