"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { FlaskConical, MapPin, Radio, RefreshCw, RotateCcw, TriangleAlert, WifiOff, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, BackendUnreachableError, api } from "@/lib/api-client";
import type { Dashboard, SatelliteLayer, ScenarioId } from "@/lib/floodfund/types";
import MapPanel from "./MapPanel";
import ModelComparison from "./ModelComparison";
import { AuditPanel, DecisionCard, FlowLink, ForecastCard, HourlyTable, ScenarioPanel, SourcesPanel, TimelinePanel } from "./panels";
import { Atmosphere, Glass, Logo, Pill } from "./ui";

const ForecastChart = dynamic(() => import("./ForecastChart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/5" aria-label="Loading chart" />,
});

const SESSION_KEY = "floodfund.sessionId";
const SCENARIOS: ScenarioId[] = ["calm", "severe-storm", "exact-threshold", "stale-data"];
const RECENT_CHECK_MS = 10 * 60 * 1000;

type Conn = "connecting" | "ready" | "offline";
export type Busy = null | "live" | "reset" | ScenarioId;

function storage(action: "get" | "set" | "remove", value?: string): string | null {
  try {
    if (action === "get") return window.localStorage.getItem(SESSION_KEY);
    if (action === "set" && value) window.localStorage.setItem(SESSION_KEY, value);
    if (action === "remove") window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage may be blocked; the session then lasts for this page view */
  }
  return null;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
});

export default function ControlRoom({ initialScenario }: { initialScenario: string | null }) {
  const [conn, setConn] = useState<Conn>("connecting");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [sat, setSat] = useState<SatelliteLayer | null>(null);
  const [satError, setSatError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const busyRef = useRef<Busy>(null);
  const booted = useRef(false);
  const scenarioConsumed = useRef(false);

  const markBusy = (b: Busy) => {
    busyRef.current = b;
    setBusy(b);
  };

  const loadSatellite = useCallback(async () => {
    setSatError(null);
    try {
      setSat(await api.satellite());
    } catch (err) {
      setSat(null);
      setSatError(err instanceof BackendUnreachableError ? "Backend not connected." : err instanceof Error ? err.message : "Satellite metadata could not be loaded.");
    }
  }, []);

  const boot = useCallback(async () => {
    setConn("connecting");
    setNotice(null);
    try {
      let id = storage("get");
      let d: Dashboard | null = null;
      if (id) {
        try {
          d = await api.getDashboard(id);
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) id = null;
          else throw err;
        }
      }
      if (!id || !d) {
        const created = await api.createSession();
        id = created.sessionId;
        d = created.dashboard;
        storage("set", id);
      }
      sessionRef.current = id;
      setDash(d);
      setConn("ready");
      void loadSatellite();

      // First action: the requested demo scenario, otherwise a live check (skipped if one was just recorded).
      const wanted = !scenarioConsumed.current ? SCENARIOS.find((s) => s === initialScenario) : undefined;
      scenarioConsumed.current = true;
      const recentlyChecked = d.decision !== null && Date.now() - Date.parse(d.decision.evaluatedAt) < RECENT_CHECK_MS;
      if (wanted) {
        markBusy(wanted);
        setDash(await api.runScenario(id, wanted));
        window.history.replaceState(null, "", "/dashboard");
      } else if (d.mode === "live" && !recentlyChecked) {
        markBusy("live");
        setDash(await api.evaluateLive(id));
      }
    } catch (err) {
      if (err instanceof BackendUnreachableError) setConn("offline");
      else {
        setConn((c) => (c === "ready" ? c : "offline"));
        setNotice(err instanceof Error ? err.message : "The request failed.");
      }
    } finally {
      markBusy(null);
    }
  }, [initialScenario, loadSatellite]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void boot();
  }, [boot]);

  // Read-only refresh so automatic scheduler checks appear without user action.
  useEffect(() => {
    if (conn !== "ready") return;
    const timer = setInterval(async () => {
      const id = sessionRef.current;
      if (!id || busyRef.current || document.hidden) return;
      try {
        const next = await api.getDashboard(id);
        if (!busyRef.current) setDash(next);
      } catch (err) {
        if (err instanceof BackendUnreachableError) setConn("offline");
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [conn]);

  const act = useCallback(
    async (kind: Exclude<Busy, null>, fn: (id: string) => Promise<Dashboard>) => {
      const id = sessionRef.current;
      if (!id || busyRef.current) return;
      markBusy(kind);
      setNotice(null);
      try {
        setDash(await fn(id));
      } catch (err) {
        if (err instanceof BackendUnreachableError) setConn("offline");
        else if (err instanceof ApiError && err.status === 404) {
          storage("remove");
          setNotice("That session no longer exists. A new session was created.");
          markBusy(null);
          await boot();
        } else setNotice(err instanceof Error ? err.message : "The request failed.");
      } finally {
        markBusy(null);
      }
    },
    [boot],
  );

  const onLive = () => act("live", (id) => api.evaluateLive(id));
  const onScenario = (s: ScenarioId) => act(s, (id) => api.runScenario(id, s));
  const onReset = () => act("reset", (id) => api.reset(id));

  const demo = dash?.mode === "demo";
  const scenarioName = dash?.scenarios.find((s) => s.id === dash.scenarioId)?.name;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen">
        <Atmosphere />

        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030814]/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <Link href="/" aria-label="Back to the FloodFund Karachi landing page">
              <Logo size={34} />
            </Link>
            <p className="ff-num hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
              <MapPin size={13} aria-hidden="true" className="text-cyan-300" />
              Karachi, Sindh · 24.8607°N 67.0011°E
            </p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {dash && (
                <Pill tone={demo ? "demo" : "ok"} icon={demo ? <FlaskConical size={12} aria-hidden="true" /> : <Radio size={12} aria-hidden="true" className="ff-blink" />}>
                  {demo ? "Demo scenario" : "Live mode"}
                </Pill>
              )}
              <span className="hidden sm:inline-flex">
                <Pill tone={conn === "ready" ? "muted" : conn === "offline" ? "crit" : "warn"}>
                  {conn === "ready" ? "Backend connected" : conn === "offline" ? "Backend not connected" : "Connecting"}
                </Pill>
              </span>
              <button
                type="button"
                aria-label="Reset session"
                onClick={onReset}
                disabled={!dash || conn !== "ready" || busy !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={15} aria-hidden="true" className={busy === "reset" ? "animate-spin" : ""} />
                Reset<span className="hidden sm:inline">&nbsp;session</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6">
          <h1 className="sr-only">FloodFund Karachi control room</h1>

          {conn === "offline" && (
            <Glass className="mx-auto mt-10 max-w-xl p-8 text-center" role="alert">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-red-400/40 bg-red-500/10 text-red-300">
                <WifiOff size={26} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold text-white">Backend not connected</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                The control room cannot reach its API, so no forecast, budget or audit data is shown. Nothing is replaced with
                placeholder or synthetic values.
              </p>
              {notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}
              <button type="button" onClick={() => void boot()} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-6 font-semibold text-slate-950 transition hover:brightness-110">
                <RefreshCw size={17} aria-hidden="true" /> Retry connection
              </button>
            </Glass>
          )}

          {conn === "connecting" && !dash && (
            <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
              <div className="text-center">
                <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto" aria-hidden="true">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#22d3ee" strokeOpacity="0.2" />
                  <circle className="ff-ring" cx="60" cy="60" r="52" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                  <circle className="ff-ring" style={{ animationDelay: "1.6s" }} cx="60" cy="60" r="52" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                  <circle cx="60" cy="60" r="5" fill="#ecfeff" />
                </svg>
                <p className="ff-eyebrow mt-6">Connecting to the control room</p>
                <p className="mt-2 text-sm text-slate-400">Creating a session and requesting the live forecast…</p>
              </div>
            </div>
          )}

          {conn !== "offline" && dash && (
            <>
              <AnimatePresence initial={false}>
                {demo && (
                  <motion.div key="demo-banner" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-violet-400/45 bg-violet-500/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex items-start gap-3 text-sm leading-relaxed text-violet-100">
                        <FlaskConical size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <span>
                          <strong className="font-semibold">DEMO SCENARIO{scenarioName ? ` · ${scenarioName}` : ""}.</strong> The rainfall values below are
                          synthetic and deterministic. They are not weather data. The map still shows real satellite context.
                        </span>
                      </p>
                      <button type="button" onClick={onLive} disabled={busy !== null} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200/40 bg-violet-200/10 px-4 text-sm font-semibold text-white transition hover:bg-violet-200/20 disabled:opacity-50">
                        <Radio size={15} aria-hidden="true" /> Return to live forecast
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {notice && (
                <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
                  <p className="flex items-start gap-3">
                    <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> {notice}
                  </p>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-12">
                <motion.div {...rise(0)} className="min-w-0 lg:col-span-7">
                  <MapPanel area={dash.area} forecast={dash.forecast} satellite={sat} satelliteError={satError} onRetrySatellite={() => void loadSatellite()} />
                </motion.div>
                <motion.div {...rise(0.08)} className="flex min-w-0 flex-col lg:col-span-5">
                  <ForecastCard forecast={dash.forecast} policy={dash.policy} />
                  <FlowLink decision={dash.decision} policy={dash.policy} />
                  <DecisionCard dashboard={dash} busy={busy} />
                </motion.div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                <motion.div {...rise(0.12)} className="min-w-0 lg:col-span-7">
                  <Glass className="h-full p-5 sm:p-6" aria-labelledby="hourly-title">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="ff-eyebrow">{demo ? "Demo · synthetic values" : "Live · ECMWF AIFS"}</p>
                        <h2 id="hourly-title" className="mt-1 text-lg font-semibold text-white">Hour by hour · 24 intervals</h2>
                      </div>
                      <p className="ff-num text-xs text-slate-400">
                        {dash.forecast.totalMm !== null ? `Σ ${dash.forecast.totalMm.toFixed(1)} mm · bars add up to the total` : "no values"}
                      </p>
                    </div>
                    <div className="mt-4">
                      <ForecastChart forecast={dash.forecast} />
                    </div>
                    <HourlyTable forecast={dash.forecast} />
                  </Glass>
                </motion.div>
                <motion.div {...rise(0.16)} className="min-w-0 lg:col-span-5">
                  <ScenarioPanel dashboard={dash} busy={busy} onScenario={onScenario} onLive={onLive} />
                </motion.div>
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                <motion.div {...rise(0.2)} className="min-w-0 lg:col-span-5">
                  <TimelinePanel dashboard={dash} />
                </motion.div>
                <motion.div {...rise(0.24)} className="min-w-0 lg:col-span-7">
                  <AuditPanel records={dash.audit} />
                </motion.div>
              </div>

              <ModelComparison />
              <SourcesPanel dashboard={dash} satellite={sat} />
            </>
          )}
        </main>

        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-2 text-xs leading-relaxed text-slate-500 sm:px-6">
          Weather data by Open-Meteo.com (ECMWF open data). Imagery and rainfall estimates courtesy of NASA EOSDIS GIBS, GPM IMERG and NASA
          POWER. Base map © OpenStreetMap contributors. All funding shown is simulated. This demonstration issues no alerts.
        </footer>
      </div>
    </MotionConfig>
  );
}
