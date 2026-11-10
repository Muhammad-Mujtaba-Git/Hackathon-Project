"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ----------------------------- Logo ----------------------------- */

/** Original FloodFund mark: a raindrop holding radar arcs, crossed by the trigger line. */
export function Logo({ size = 36, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FloodFund logo" className="shrink-0">
        <defs>
          <linearGradient id="ff-logo-g" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#99f6e4" />
            <stop offset="0.5" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path d="M24 3.5C24 3.5 8.5 20.4 8.5 30a15.5 15.5 0 0 0 31 0C39.5 20.4 24 3.5 24 3.5Z" fill="url(#ff-logo-g)" fillOpacity="0.14" stroke="url(#ff-logo-g)" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M17 31a7 7 0 0 1 7-7" fill="none" stroke="#a5f3fc" strokeWidth="2" strokeLinecap="round" />
        <path d="M12.8 31A11.2 11.2 0 0 1 24 19.8" fill="none" stroke="#a5f3fc" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="24" cy="31" r="2.7" fill="#ecfeff" />
        <path d="M27.5 31h9.2" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M30.5 36.2h4.6" stroke="#fbbf24" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.05rem] font-semibold tracking-tight text-white">
            Flood<span className="text-cyan-300">Fund</span>
          </span>
          <span className="ff-num mt-1 text-[0.58rem] tracking-[0.34em] text-slate-400">KARACHI</span>
        </span>
      )}
    </span>
  );
}

/* ----------------------------- Background ----------------------------- */

const PARTICLES = [
  [8, 12, 22], [18, 64, 30], [27, 30, 26], [36, 82, 34], [44, 18, 28], [52, 52, 24], [61, 74, 32],
  [68, 26, 27], [76, 60, 36], [84, 14, 25], [90, 44, 31], [95, 80, 29], [13, 88, 33], [58, 8, 23],
];

/** Decorative atmosphere: glows, topographic contour lines and slow particles. Purely visual. */
export function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_12%_-10%,rgba(34,211,238,0.16),transparent_60%),radial-gradient(900px_600px_at_95%_8%,rgba(139,92,246,0.14),transparent_60%),radial-gradient(1000px_700px_at_50%_115%,rgba(13,148,136,0.14),transparent_60%),linear-gradient(180deg,#030814_0%,#051022_55%,#030814_100%)]" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.22]" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#38bdf8" strokeWidth="1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path
              key={i}
              strokeOpacity={0.5 - i * 0.045}
              d={`M-40 ${150 + i * 46} C 220 ${60 + i * 52}, 420 ${260 + i * 30}, 700 ${170 + i * 48} S 1180 ${80 + i * 60}, 1500 ${210 + i * 40}`}
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={`e${i}`} cx="1130" cy="690" rx={70 + i * 58} ry={34 + i * 30} strokeOpacity={0.4 - i * 0.06} transform="rotate(-14 1130 690)" />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(148,197,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(148,197,255,0.6)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      {PARTICLES.map(([left, top, dur], i) => (
        <span key={i} className="ff-particle" style={{ left: `${left}%`, top: `${top}%`, animationDuration: `${dur}s`, animationDelay: `${-i * 2.3}s` }} />
      ))}
    </div>
  );
}

/* ----------------------------- Primitives ----------------------------- */

export function Glass({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`ff-glass ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export type Tone = "ok" | "info" | "warn" | "crit" | "demo" | "muted";
const TONES: Record<Tone, string> = {
  ok: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
  info: "border-cyan-400/35 bg-cyan-400/10 text-cyan-200",
  warn: "border-amber-400/45 bg-amber-400/10 text-amber-200",
  crit: "border-red-400/45 bg-red-500/10 text-red-200",
  demo: "border-violet-400/45 bg-violet-500/15 text-violet-200",
  muted: "border-white/12 bg-white/5 text-slate-300",
};

/** Status pill: always icon + text, never colour alone. */
export function Pill({ tone = "muted", icon, children, className = "" }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`ff-num inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.66rem] font-medium uppercase tracking-[0.12em] ${TONES[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, reduce]);
  return <span className={className}>{display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

/* ----------------------------- Formatting ----------------------------- */

export function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`;
}

export function fmtPkt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} PKT`;
}

export function fmtPkr(amount: number): string {
  return `PKR ${amount.toLocaleString("en-US")}`;
}

export function fmtMm(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}
