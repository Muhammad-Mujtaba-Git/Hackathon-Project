import { ArrowRight, Banknote, CloudRain, Database, Info, ListChecks, Play, Radar, Satellite, ShieldCheck, TriangleAlert, Zap } from "lucide-react";
import Link from "next/link";
import { Atmosphere, Glass, Logo, Pill } from "@/components/ff/ui";

const STEPS = [
  { n: "01", title: "Forecast", icon: Radar, tone: "text-cyan-300", body: "A real ECMWF AIFS rainfall forecast for Karachi is fetched through Open-Meteo and pinned to a verified model run. The next 24 complete hours are summed." },
  { n: "02", title: "Observe", icon: Satellite, tone: "text-teal-300", body: "NASA GPM IMERG satellite precipitation from NASA GIBS is drawn on the map as context for what has already fallen. It is an observation, not a forecast." },
  { n: "03", title: "Trigger", icon: Zap, tone: "text-amber-300", body: "A pre-agreed rule is checked: fresh data and at least 80 mm in 24 hours. Stale, missing or unverified data can never trigger it." },
  { n: "04", title: "Act", icon: Banknote, tone: "text-violet-300", body: "One simulated PKR 500,000 allocation is recorded, exactly once per event, with every input written to an audit trail." },
];

const LIVE = [
  ["Rainfall forecast", "ECMWF AIFS via Open-Meteo", "Real, verified model run"],
  ["Satellite rainfall layer", "NASA GIBS · GPM IMERG", "Real, observation date from NASA metadata"],
  ["Model benchmark", "Archived AIFS runs vs NASA POWER IMERG", "Real measured results"],
];
const SIM = [
  ["Funding, budget and allocations", "Database records only. No bank, wallet, insurer or payment gateway is connected."],
  ["Demo scenarios", "Deterministic synthetic rainfall, always labelled DEMO, used to show the rule firing on a calm day."],
  ["The 80 mm threshold", "An example value for demonstration, not a validated flood warning level."],
];

function HeroVisual() {
  const R = 178;
  return (
    <figure className="relative mx-auto w-full max-w-[540px]">
      <svg viewBox="0 0 520 520" className="ff-float h-auto w-full" role="img" aria-label="Illustration of a stylised globe with a marker at Karachi, radar rings, an orbiting satellite and a storm system offshore">
        <defs>
          <radialGradient id="hv-globe" cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#12365f" />
            <stop offset="0.55" stopColor="#0a1f3d" />
            <stop offset="1" stopColor="#040b18" />
          </radialGradient>
          <radialGradient id="hv-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0.72" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="0.86" stopColor="#22d3ee" stopOpacity="0.22" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hv-storm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#67e8f9" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <clipPath id="hv-clip">
            <circle cx="260" cy="260" r={R} />
          </clipPath>
        </defs>

        <circle cx="260" cy="260" r="236" fill="url(#hv-glow)" />
        <ellipse cx="260" cy="260" rx="248" ry="86" transform="rotate(-22 260 260)" fill="none" stroke="#94c5ff" strokeOpacity="0.22" strokeDasharray="2 8" />
        <circle cx="260" cy="260" r={R} fill="url(#hv-globe)" stroke="#7dd3fc" strokeOpacity="0.35" />

        <g clipPath="url(#hv-clip)" fill="none">
          <g stroke="#7dd3fc" strokeOpacity="0.16">
            {[-132, -88, -44, 0, 44, 88, 132].map((dy) => (
              <ellipse key={dy} cx="260" cy={260 + dy} rx={Math.sqrt(R * R - dy * dy)} ry={Math.sqrt(R * R - dy * dy) * 0.16} />
            ))}
            {[26, 72, 118, 156].map((rx) => (
              <ellipse key={rx} cx="260" cy="260" rx={rx} ry={R} />
            ))}
          </g>
          {/* Abstract terrain contours (not a geographic boundary) */}
          <g stroke="#2dd4bf" strokeOpacity="0.3">
            <path d="M118 150c40-22 92-18 128 6s58 64 104 60 60-34 92-30" />
            <path d="M112 176c44-20 92-12 126 12s50 62 100 62 70-30 104-24" />
            <path d="M120 204c40-14 80-4 108 18s44 54 92 58 78-22 110-14" />
          </g>
          {/* Storm system offshore */}
          <g className="ff-sweep" style={{ transformOrigin: "318px 334px" }} stroke="url(#hv-storm)" strokeLinecap="round">
            <path d="M318 264a70 70 0 1 1-66 48" strokeWidth="5" strokeOpacity="0.5" />
            <path d="M318 286a48 48 0 1 1-45 33" strokeWidth="4" strokeOpacity="0.7" />
            <path d="M318 306a28 28 0 1 1-26 19" strokeWidth="3" strokeOpacity="0.9" />
            <path d="M388 334a70 70 0 0 1-30 57" strokeWidth="9" strokeOpacity="0.18" />
          </g>
          <circle cx="318" cy="334" r="5" fill="#e0f2fe" fillOpacity="0.9" />
        </g>

        {/* Karachi marker with radar rings */}
        <g>
          <circle className="ff-ring" cx="232" cy="232" r="44" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle className="ff-ring" style={{ animationDelay: "1.7s" }} cx="232" cy="232" r="44" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="232" cy="232" r="5.5" fill="#ecfeff" stroke="#22d3ee" strokeWidth="3" />
          <path d="M232 232 172 150H96" fill="none" stroke="#a5f3fc" strokeOpacity="0.7" />
          <text x="96" y="140" fill="#ecfeff" fontSize="15" fontWeight="600" fontFamily="var(--font-sans)">
            KARACHI
          </text>
          <text x="96" y="168" fill="#7dd3fc" fontSize="11" fontFamily="var(--font-mono)">
            24.86°N 67.00°E
          </text>
        </g>

        {/* Satellite on orbit */}
        <g transform="translate(452 148) rotate(-22)">
          <rect x="-7" y="-5" width="14" height="10" rx="2" fill="#cffafe" />
          <rect x="-25" y="-3.5" width="15" height="7" rx="1" fill="#8b5cf6" fillOpacity="0.85" />
          <rect x="10" y="-3.5" width="15" height="7" rx="1" fill="#8b5cf6" fillOpacity="0.85" />
          <circle className="ff-blink" cx="0" cy="9" r="2" fill="#fbbf24" />
        </g>
        <path d="M444 158 262 246" stroke="#a78bfa" strokeOpacity="0.28" strokeDasharray="3 7" />
      </svg>
      <figcaption className="ff-num mt-2 text-center text-[0.68rem] tracking-[0.14em] text-slate-500">
        ILLUSTRATION ONLY · NOT LIVE SATELLITE DATA
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="relative">
      <Atmosphere />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-400 focus:px-4 focus:py-2 focus:text-slate-950">
        Skip to content
      </a>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="FloodFund Karachi home">
          <Logo size={38} />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm text-slate-300 sm:gap-2">
          <a href="#how" className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:block">How it works</a>
          <a href="#data" className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:block">Live vs simulated</a>
          <a href="#limits" className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:block">Limits</a>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 font-medium text-cyan-100 transition hover:bg-cyan-400/20">
            Control Room <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pb-24 lg:pt-12">
          <div>
            <p className="ff-eyebrow">Climate intelligence · Simulated disaster finance</p>
            <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
              See the rain coming.
              <br />
              <span className="ff-gradient-text">Release funds before it lands.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              FloodFund Karachi helps a municipal disaster team prepare for heavy rainfall. It reads a real AI weather
              forecast for the next 24 hours, adds NASA satellite context, and applies a transparent, pre-agreed rule that
              records a <strong className="font-semibold text-white">simulated</strong> emergency allocation with a full audit trail.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="group inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-300 to-teal-300 px-7 text-base font-semibold text-slate-950 shadow-[0_0_40px_-8px_rgba(34,211,238,0.7)] transition hover:brightness-110">
                <Radar size={19} aria-hidden="true" /> Launch Control Room
                <ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/dashboard?scenario=severe-storm" className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl border border-violet-300/40 bg-violet-500/15 px-7 text-base font-semibold text-violet-100 transition hover:bg-violet-500/25">
                <Play size={18} aria-hidden="true" /> Run Storm Demo
              </Link>
            </div>

            <div role="note" className="mt-7 flex max-w-xl items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-4 text-sm leading-relaxed text-amber-100">
              <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" />
              <p>
                <strong className="font-semibold">Funding simulation only.</strong> No real money moves and no bank, wallet or insurer is
                connected. The 80 mm threshold is an example, not a validated flood warning. Heavy rainfall does not guarantee flooding.
              </p>
            </div>

            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["≥ 80 mm", "in 24 hours · example rule"],
                ["PKR 500,000", "simulated allocation"],
                ["PKR 2,000,000", "simulated budget"],
              ].map(([v, l]) => (
                <div key={v} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <dt className="ff-num text-[0.95rem] font-semibold text-white sm:text-lg">{v}</dt>
                  <dd className="mt-1 text-xs leading-snug text-slate-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroVisual />
        </section>

        {/* Four steps */}
        <section id="how" className="mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-14 sm:px-8">
          <p className="ff-eyebrow">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Forecast → Observe → Trigger → Act</h2>
          <ol className="relative mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div aria-hidden="true" className="absolute left-8 right-8 top-[3.1rem] hidden h-px bg-gradient-to-r from-cyan-400/50 via-amber-300/40 to-violet-400/50 xl:block" />
            {STEPS.map((s) => (
              <li key={s.n}>
                <Glass as="div" className="relative h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-[#071226] ${s.tone}`}>
                      <s.icon size={22} aria-hidden="true" />
                    </span>
                    <span className="ff-num text-xs tracking-[0.2em] text-slate-500">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.body}</p>
                </Glass>
              </li>
            ))}
          </ol>
        </section>

        {/* Rule */}
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-5 py-10 sm:px-8 lg:grid-cols-2">
          <Glass className="min-w-0 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} aria-hidden="true" className="text-cyan-300" />
              <h2 className="text-xl font-semibold text-white">The rule, in full</h2>
            </div>
            <pre className="ff-num ff-scroll mt-5 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-[#040b18] p-5 text-[0.8rem] leading-7 text-slate-300">
{`IF   forecast is valid and fresh
AND  rainfall (next 24 h) >= 80 mm
AND  policy is active
AND  simulated budget is sufficient
AND  this event has no allocation yet
THEN record ONE simulated PKR 500,000 allocation
ELSE record no allocation, and say why`}
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Budget and allocation change together in one database transaction, and a uniqueness constraint on session, policy and
              event makes double payment impossible, even under repeated or concurrent requests.
            </p>
          </Glass>
          <Glass className="min-w-0 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <ListChecks size={20} aria-hidden="true" className="text-violet-300" />
              <h2 className="text-xl font-semibold text-white">Three models, one honest comparison</h2>
            </div>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-slate-300">
              <li><strong className="text-white">ECMWF AIFS.</strong> Trained by ECMWF, not by us. It is the live forecast on the dashboard.</li>
              <li><strong className="text-white">Team Random Forest and team neural network.</strong> Trained by us with scikit-learn on archived AIFS forecasts and NASA IMERG rainfall estimates. Both take AIFS as input, so they are post-processors, not independent weather models.</li>
              <li><strong className="text-white">Same test rows for all three.</strong> Same locations, dates, cut-offs and reference values. The control room shows the measured results as they are, including where our models do not beat AIFS.</li>
            </ul>
            <Link href="/dashboard#models" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white transition hover:bg-white/5">
              See the measured benchmark <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Glass>
        </section>

        {/* Live vs simulated */}
        <section id="data" className="mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-14 sm:px-8">
          <p className="ff-eyebrow">What is real and what is not</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Live data, simulated money</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Glass className="min-w-0 p-6 sm:p-8">
              <Pill tone="ok" icon={<Database size={12} aria-hidden="true" />}>Live · real data</Pill>
              <ul className="mt-5 divide-y divide-white/10">
                {LIVE.map(([a, b, c]) => (
                  <li key={a} className="py-4 first:pt-0 last:pb-0">
                    <p className="font-medium text-white">{a}</p>
                    <p className="mt-1 text-sm text-slate-300">{b}</p>
                    <p className="ff-num mt-1 text-xs text-emerald-300/90">{c}</p>
                  </li>
                ))}
              </ul>
            </Glass>
            <Glass className="min-w-0 p-6 sm:p-8">
              <Pill tone="demo" icon={<CloudRain size={12} aria-hidden="true" />}>Simulated · demonstration</Pill>
              <ul className="mt-5 divide-y divide-white/10">
                {SIM.map(([a, b]) => (
                  <li key={a} className="py-4 first:pt-0 last:pb-0">
                    <p className="font-medium text-white">{a}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{b}</p>
                  </li>
                ))}
              </ul>
            </Glass>
          </div>
        </section>

        {/* Limits */}
        <section id="limits" className="mx-auto w-full max-w-7xl scroll-mt-8 px-5 pb-20 pt-6 sm:px-8">
          <Glass className="min-w-0 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Info size={20} aria-hidden="true" className="text-amber-300" />
              <h2 className="text-xl font-semibold text-white">Read this before relying on anything here</h2>
            </div>
            <ul className="mt-5 grid gap-x-10 gap-y-3 text-sm leading-relaxed text-slate-300 md:grid-cols-2">
              <li>AIFS is a global model on a grid of about 28 km. It cannot describe rainfall or flooding at street level.</li>
              <li>Rainfall is not flooding. Drainage, tides, soil and infrastructure decide whether water accumulates.</li>
              <li>The satellite layer shows estimated past rainfall with a delay. It is not a flood map.</li>
              <li>This is a hackathon demonstration. It issues no public alerts and must not be used for real decisions.</li>
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 font-semibold text-slate-950 transition hover:brightness-110">
                Launch Control Room <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/dashboard?scenario=severe-storm" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-300/40 bg-violet-500/15 px-6 font-semibold text-violet-100 transition hover:bg-violet-500/25">
                <Play size={16} aria-hidden="true" /> Run Storm Demo
              </Link>
            </div>
          </Glass>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-xs leading-relaxed text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo size={26} />
          <p className="max-w-3xl">
            Weather data by Open-Meteo.com (ECMWF open data). Satellite imagery and rainfall estimates courtesy of NASA EOSDIS GIBS,
            GPM IMERG and NASA POWER. Base map © OpenStreetMap contributors. All funding shown is simulated.
          </p>
        </div>
      </footer>
    </div>
  );
}
