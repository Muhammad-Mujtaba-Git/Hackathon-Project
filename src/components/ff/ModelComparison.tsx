"use client";

import { BrainCircuit, ChevronDown, Globe, Info, RefreshCw, Scale, Trees, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { BenchmarkReport, BenchmarkResponse, ComparisonResponse, MaeDifference, ModelId, ModelInfo, ModelMetrics } from "@/lib/floodfund/types";
import { Glass, Pill, fmtUtc } from "./ui";

const ICONS: Record<ModelId, typeof Globe> = { "ecmwf-aifs": Globe, "random-forest": Trees, "neural-network": BrainCircuit };
const COLORS: Record<ModelId, string> = { "ecmwf-aifs": "#22d3ee", "random-forest": "#34d399", "neural-network": "#a78bfa" };
const SHORT: Record<ModelId, string> = { "ecmwf-aifs": "ECMWF AIFS (raw)", "random-forest": "Our Random Forest", "neural-network": "Our neural network" };

const n2 = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : v.toFixed(2));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(0)}%`);

function MetricsTable({ metrics, threshold, caption }: { metrics: ModelMetrics[]; threshold: number; caption: string }) {
  return (
    <div className="ff-scroll overflow-x-auto rounded-xl border border-white/10" tabIndex={0} role="region" aria-label={caption}>
      <table className="ff-num w-full min-w-[760px] text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-white/[0.04] text-[0.66rem] uppercase tracking-[0.08em] text-slate-400">
          <tr>
            {["Model", "MAE mm", "RMSE mm", "MAE on wet days", `Reference ≥ ${threshold}`, `Predicted ≥ ${threshold}`, "Precision", "Recall", "False triggers"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.modelId} className="border-t border-white/10 text-slate-200">
              <th scope="row" className="px-3 py-2.5 text-left font-medium">
                <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLORS[m.modelId] }} aria-hidden="true" />
                {SHORT[m.modelId]}
              </th>
              <td className="px-3 py-2.5">{n2(m.maeMm)}</td>
              <td className="px-3 py-2.5">{n2(m.rmseMm)}</td>
              <td className="px-3 py-2.5">{n2(m.maeWetReferenceDaysMm)} <span className="text-slate-500">(n={m.nWetReferenceDays})</span></td>
              <td className="px-3 py-2.5">{m.referenceAtOrAboveThreshold}</td>
              <td className="px-3 py-2.5">{m.predictedAtOrAboveThreshold}</td>
              <td className="px-3 py-2.5">{pct(m.precision)}</td>
              <td className="px-3 py-2.5">{pct(m.recall)}</td>
              <td className="px-3 py-2.5">{m.falseTriggers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function diffSentence(d: MaeDifference): string {
  if (d.maeDifferenceMm === null) return `${SHORT[d.modelId]}: difference not available.`;
  const dir = d.maeDifferenceMm > 0 ? "higher" : "lower";
  const base = `${SHORT[d.modelId]}: MAE ${Math.abs(d.maeDifferenceMm).toFixed(2)} mm ${dir} than raw AIFS`;
  if (d.ci95LowMm === null || d.ci95HighMm === null) return `${base} (no interval).`;
  const includesZero = d.ci95LowMm <= 0 && d.ci95HighMm >= 0;
  const verdict = includesZero ? "not distinguishable from raw AIFS on this sample" : d.maeDifferenceMm > 0 ? "worse than raw AIFS on this sample" : "better than raw AIFS on this sample";
  return `${base} (95% interval ${d.ci95LowMm.toFixed(2)} to ${d.ci95HighMm.toFixed(2)} mm): ${verdict}.`;
}

function BenchmarkView({ r }: { r: BenchmarkReport }) {
  const test = r.test.metrics;
  const maxMae = Math.max(...test.map((m) => m.maeMm ?? 0), 0.001);
  const lowest = [...test].sort((a, b) => (a.maeMm ?? Infinity) - (b.maeMm ?? Infinity))[0];
  const t = r.splits.test;
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-white">Held-out test period · measured results</h4>
        <p className="ff-num mt-1 text-xs text-slate-400">
          {t.start} → {t.end} · {t.nExamples} location-days on {t.nDates} dates · {r.locations.length} locations · same rows for all three: {r.sameRowsVerified ? "verified" : "not verified"}
        </p>
        <div className="mt-3 space-y-2" role="img" aria-label={`Test mean absolute error: ${test.map((m) => `${SHORT[m.modelId]} ${n2(m.maeMm)} millimetres`).join(", ")}. Lower is better.`}>
          {test.map((m) => (
            <div key={m.modelId} className="grid grid-cols-[9.5rem_minmax(0,1fr)_4.2rem] items-center gap-3 text-xs">
              <span className="truncate text-slate-200">{SHORT[m.modelId]}</span>
              <span className="h-3 overflow-hidden rounded-full bg-white/[0.07]">
                <span className="block h-full rounded-full" style={{ width: `${((m.maeMm ?? 0) / maxMae) * 100}%`, background: COLORS[m.modelId] }} />
              </span>
              <span className="ff-num text-right text-slate-200">{n2(m.maeMm)} mm</span>
            </div>
          ))}
          <p className="text-xs text-slate-500">Mean absolute error against NASA IMERG estimates. Shorter bar = smaller error. Lowest on this test set: {SHORT[lowest.modelId]}.</p>
        </div>
      </div>

      <MetricsTable metrics={test} threshold={r.thresholdMm} caption="Test-set metrics for the three models" />
      <p className="text-xs leading-relaxed text-slate-500">
        “n/a” means the metric is undefined, for example precision when no model predicted ≥ {r.thresholdMm} mm, or recall when no reference day reached it.
        Precision and recall describe agreement with a satellite rainfall estimate at an example threshold. They are not flood prediction accuracy.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-white"><Scale size={15} aria-hidden="true" className="text-cyan-300" /> Did our models beat raw AIFS?</h4>
        <ul className="mt-2 space-y-1.5 text-[0.82rem] leading-relaxed text-slate-300">
          {r.test.differencesVsAifs.map((d) => <li key={d.modelId}>{diffSentence(d)}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">{r.test.differencesVsAifs[0]?.method}</p>
      </div>

      <div className={`rounded-xl border p-4 ${r.recommendation.reliable ? "border-emerald-400/35 bg-emerald-400/10" : "border-amber-400/35 bg-amber-400/[0.08]"}`}>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
          <TriangleAlert size={15} aria-hidden="true" className="text-amber-300" />
          Validation leader: {SHORT[r.recommendation.validationLeader]} · reliable ranking: {r.recommendation.reliable ? "yes" : "no"}
        </h4>
        <p className="mt-1 text-xs text-slate-400">{r.recommendation.basis}. The test set was not used for this choice.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.82rem] leading-relaxed text-slate-300">
          {r.recommendation.reasons.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-slate-200">
          <strong className="font-semibold text-white">Live dashboard model: {SHORT[r.recommendation.liveDashboardModel]}.</strong> {r.recommendation.liveDashboardReason}
        </p>
      </div>

      <details className="group rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-200">
          Validation results, data splits and assumptions
          <ChevronDown size={16} aria-hidden="true" className="transition group-open:rotate-180" />
        </summary>
        <div className="space-y-4 pb-3 pt-2">
          <p className="ff-num text-xs text-slate-400">
            Validation {r.splits.validation.start} → {r.splits.validation.end} · {r.splits.validation.nExamples} location-days · team models fitted on {r.validation.fittedOn}
          </p>
          <MetricsTable metrics={r.validation.metrics} threshold={r.thresholdMm} caption="Validation metrics for the three models" />
          <ul className="space-y-1 text-[0.8rem] text-slate-300">{r.validation.differencesVsAifs.map((d) => <li key={d.modelId}>{diffSentence(d)}</li>)}</ul>
          <dl className="grid gap-3 text-[0.8rem] sm:grid-cols-3">
            {(["train", "validation", "test"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-white/10 p-3">
                <dt className="text-[0.66rem] uppercase tracking-[0.12em] text-slate-500">{k}</dt>
                <dd className="ff-num mt-1 text-slate-200">{r.splits[k].start} → {r.splits[k].end}</dd>
                <dd className="ff-num text-slate-400">{r.splits[k].nDates} dates · {r.splits[k].nExamples} examples</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 text-[0.8rem] leading-relaxed text-slate-300">
            <p><strong className="text-white">Dataset.</strong> {r.datasetExamples} location-days. Locations: {r.locations.map((l) => l.name).join(", ")}. {r.splitMethod}</p>
            <p><strong className="text-white">Selection.</strong> {r.selection}</p>
            <p><strong className="text-white">Features (same for both team models).</strong> <span className="ff-num text-xs">{r.features.join(", ")}</span></p>
            <p><strong className="text-white">Models.</strong> {r.models.map((m) => `${m.name}: ${m.version}${m.trainingSeconds !== null ? `, trained in ${m.trainingSeconds} s` : ""}`).join(" · ")}</p>
            <p><strong className="text-white">Forecast availability.</strong> {r.availabilityAssumption}</p>
            <p><strong className="text-white">Reference data.</strong> {r.reference}. {r.referenceLimitations.join(" ")}</p>
            <p><strong className="text-white">Also note.</strong> {r.caveats.join(" ")}</p>
            <p className="ff-num text-xs text-slate-500">Report generated {fmtUtc(r.generatedAt)} · models trained {fmtUtc(r.trainedAt)} · {Object.entries(r.libraries).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function ModelComparison() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [date, setDate] = useState("");
  const [cmp, setCmp] = useState<ComparisonResponse | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, b] = await Promise.all([api.models(), api.benchmark()]);
      setModels(m.models);
      setBenchmark(b);
      setDate((d) => d || b.report?.splits.test.end || new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Model information could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash === "#models") setOpen(true);
  }, []);
  useEffect(() => {
    if (open && !models && !loading && !error) void load();
  }, [open, models, loading, error, load]);

  const compare = async () => {
    if (!date) return;
    setCmpLoading(true);
    setCmpError(null);
    try {
      setCmp(await api.comparison(date));
    } catch (err) {
      setCmp(null);
      setCmpError(err instanceof Error ? err.message : "The comparison failed.");
    } finally {
      setCmpLoading(false);
    }
  };

  return (
    <Glass id="models" className="scroll-mt-24 p-5 sm:p-6" aria-labelledby="models-title">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="models-body" className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="ff-eyebrow block">For judges · optional</span>
          <span id="models-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
            <Scale size={18} aria-hidden="true" className="text-violet-300" /> Model comparison: ECMWF AIFS vs our two post-processors
          </span>
        </span>
        <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="models-body" className="mt-5 space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-4 text-[0.82rem] leading-relaxed text-slate-200">
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-300" />
            <p>
              <strong className="font-semibold text-white">ECMWF trained AIFS. Our team trained only the Random Forest and the neural network.</strong> Both
              of ours take the AIFS forecast as input, so they are AIFS post-processors, not independent weather models. The benchmark
              uses a <strong className="font-semibold text-white">fixed UTC calendar day</strong>; the dashboard above uses the{" "}
              <strong className="font-semibold text-white">rolling next 24 hours</strong>. These are different windows and are labelled separately.
            </p>
          </div>

          {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw size={15} aria-hidden="true" className="animate-spin" /> Loading model information…</p>}
          {error && (
            <div role="alert" className="rounded-xl border border-red-400/35 bg-red-500/10 p-4 text-sm text-red-100">
              <p>{error}</p>
              <button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200/40 px-3 text-xs font-semibold hover:bg-red-200/10">
                <RefreshCw size={13} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {models && (
            <ul className="grid gap-3 md:grid-cols-3">
              {models.map((m) => {
                const Icon = ICONS[m.id];
                return (
                  <li key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[#071226]" style={{ color: COLORS[m.id] }}>
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <Pill tone={m.status === "not-trained" ? "warn" : m.status === "trained" ? "ok" : "info"}>
                        {m.status === "not-trained" ? "Not trained" : m.status === "trained" ? "Trained by us" : "External model"}
                      </Pill>
                    </div>
                    <h4 className="mt-3 font-semibold text-white">{m.name}</h4>
                    <p className="ff-num mt-0.5 text-[0.7rem] text-slate-400">{m.kind}</p>
                    <p className="mt-2 text-[0.8rem] leading-relaxed text-slate-300">{m.description}</p>
                    <p className="ff-num mt-2 text-[0.68rem] text-slate-500">
                      Trained by: {m.trainedBy}
                      {m.version ? ` · ${m.version}` : ""}
                      {m.trainingSeconds !== null ? ` · ${m.trainingSeconds} s` : ""}
                    </p>
                    {m.statusReason && <p className="mt-2 text-xs text-amber-200">{m.statusReason}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {benchmark && benchmark.status === "unavailable" && (
            <div role="status" className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">
              <strong className="font-semibold">No benchmark results available.</strong> {benchmark.reason} No numbers are shown because none were measured.
            </div>
          )}
          {benchmark?.report && <BenchmarkView r={benchmark.report} />}

          {models && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-sm font-semibold text-white">Compare all three for one fixed UTC day</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Uses the archived AIFS run from 12:00 UTC on the previous day. Read-only: this never creates a funding allocation.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-xs text-slate-400">
                  Target day (UTC)
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ff-num mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-[#071226] px-3 text-sm text-white [color-scheme:dark] sm:w-48" />
                </label>
                <button type="button" onClick={() => void compare()} disabled={!date || cmpLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
                  <RefreshCw size={15} aria-hidden="true" className={cmpLoading ? "animate-spin" : ""} /> Compare
                </button>
              </div>
              {cmpError && <p role="alert" className="mt-3 text-sm text-red-200">{cmpError}</p>}
              {cmp && cmp.status === "unavailable" && <p role="status" className="mt-3 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-100">Not available for {cmp.date}: {cmp.reason}</p>}
              {cmp && cmp.status === "available" && (
                <div className="mt-4" aria-live="polite">
                  <p className="ff-num text-xs text-slate-400">
                    {fmtUtc(cmp.windowStart)} → {fmtUtc(cmp.windowEnd)} · AIFS run {fmtUtc(cmp.modelRunAt)} · availability {cmp.availability}
                  </p>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {cmp.predictions.map((p) => (
                      <li key={p.modelId} className="rounded-xl border border-white/10 bg-[#071226] p-3">
                        <p className="text-xs text-slate-400">{SHORT[p.modelId]}</p>
                        <p className="ff-num mt-1 text-2xl font-semibold" style={{ color: p.rainfallMm === null ? "#64748b" : COLORS[p.modelId] }}>
                          {p.rainfallMm === null ? "—" : p.rainfallMm.toFixed(1)} <span className="text-sm text-slate-400">{p.rainfallMm === null ? "" : "mm"}</span>
                        </p>
                        <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{p.status === "not-trained" ? `Not trained. ${p.note ?? ""}` : p.note}</p>
                      </li>
                    ))}
                    <li className="rounded-xl border border-dashed border-white/20 p-3">
                      <p className="text-xs text-slate-400">NASA IMERG estimate (reference)</p>
                      <p className="ff-num mt-1 text-2xl font-semibold text-white">
                        {cmp.reference.valueMm === null ? "—" : cmp.reference.valueMm.toFixed(1)} <span className="text-sm text-slate-400">{cmp.reference.valueMm === null ? "" : "mm"}</span>
                      </p>
                      <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{cmp.reference.note}</p>
                    </li>
                  </ul>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
                    <li>{cmp.windowLabel}</li>
                    {cmp.notes.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Glass>
  );
}
