"use client";

import { Eye, EyeOff, MapPin, RefreshCw, Satellite, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type { Area, Forecast, SatelliteLayer } from "@/lib/floodfund/types";
import { Glass, Pill, fmtUtc } from "./ui";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-[#050d1c]" role="status">
      <p className="ff-eyebrow">Loading map…</p>
    </div>
  ),
});

export default function MapPanel({
  area,
  forecast,
  satellite,
  satelliteError,
  onRetrySatellite,
}: {
  area: Area;
  forecast: Forecast;
  satellite: SatelliteLayer | null;
  satelliteError: string | null;
  onRetrySatellite: () => void;
}) {
  const [showSat, setShowSat] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [baseFailed, setBaseFailed] = useState(false);
  const [satTilesFailed, setSatTilesFailed] = useState(false);
  const [legendOk, setLegendOk] = useState(true);
  const baseLoaded = useRef(0);
  const satLoaded = useRef(0);

  const onBaseLoad = useCallback(() => {
    baseLoaded.current += 1;
    setBaseFailed(false);
  }, []);
  const onBaseError = useCallback(() => {
    if (baseLoaded.current === 0) setBaseFailed(true);
  }, []);
  const onSatLoad = useCallback(() => {
    satLoaded.current += 1;
    setSatTilesFailed(false);
  }, []);
  const onSatError = useCallback(() => {
    if (satLoaded.current === 0) setSatTilesFailed(true);
  }, []);

  const available = satellite?.status === "available" && !!satellite.tileUrlTemplate;
  const satUrl = available && showSat ? satellite.tileUrlTemplate : null;
  const loadingSat = satellite === null && satelliteError === null;

  return (
    <Glass className="flex h-full flex-col p-4 sm:p-5" aria-labelledby="map-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ff-eyebrow">Situational map</p>
          <h2 id="map-title" className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
            <MapPin size={18} aria-hidden="true" className="text-cyan-300" /> {area.name}, {area.region}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {loadingSat && <Pill tone="muted" icon={<RefreshCw size={12} aria-hidden="true" className="animate-spin" />}>Checking NASA layer</Pill>}
          {available && !satTilesFailed && (
            <Pill tone="ok" icon={<Satellite size={12} aria-hidden="true" />}>Satellite · {satellite.observationTime} UTC day</Pill>
          )}
          {(satellite?.status === "unavailable" || satelliteError || (available && satTilesFailed)) && (
            <Pill tone="warn" icon={<TriangleAlert size={12} aria-hidden="true" />}>Satellite layer unavailable</Pill>
          )}
        </div>
      </div>

      <div className="relative isolate z-0 mt-4 h-[400px] shrink-0 overflow-hidden rounded-2xl border border-white/10 sm:h-[460px] lg:h-auto lg:min-h-[560px] lg:flex-1">
        <LeafletMap
          center={[area.latitude, area.longitude]}
          areaName={area.name}
          grid={forecast.gridLocation}
          satelliteUrl={satUrl}
          satelliteAttribution={satellite?.attribution ?? ""}
          maxNativeZoom={satellite?.maxNativeZoom ?? 6}
          opacity={opacity}
          onBaseTileLoad={onBaseLoad}
          onBaseTileError={onBaseError}
          onSatelliteTileLoad={onSatLoad}
          onSatelliteTileError={onSatError}
        />
        {baseFailed && (
          <div role="status" className="absolute left-3 right-3 top-3 z-[1000] rounded-xl border border-amber-400/40 bg-[#071226]/95 p-3 text-xs leading-relaxed text-amber-100 sm:left-14">
            <strong className="font-semibold">Base map tiles could not be loaded.</strong> The marker still shows the selected area at{" "}
            <span className="ff-num">{area.latitude.toFixed(4)}°N, {area.longitude.toFixed(4)}°E</span>
            {satUrl ? ", with the NASA satellite layer on top." : "."}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-7 left-3 z-[1000] rounded-lg border border-white/10 bg-[#071226]/90 px-2.5 py-1.5">
          <p className="ff-num text-[0.62rem] leading-relaxed text-slate-300">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-cyan-300 align-middle" aria-hidden="true" />selected area
            {forecast.gridLocation && (
              <>
                <span className="mx-1.5 text-slate-600">|</span>
                <span className="mr-1.5 inline-block h-2 w-3 border border-dashed border-violet-300 align-middle" aria-hidden="true" />AIFS grid cell (approx.)
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0 text-[0.8rem] leading-relaxed text-slate-300">
          {available ? (
            <>
              <p>
                <strong className="font-semibold text-white">{satellite.layerTitle}.</strong> Observation: <span className="ff-num">{satellite.observationTime}</span> (one
                UTC day{satellite.observationAgeDays !== null ? `, ${satellite.observationAgeDays} day${satellite.observationAgeDays === 1 ? "" : "s"} ago` : ""}), date taken from
                NASA GIBS metadata and checked {fmtUtc(satellite.retrievedAt)}.
              </p>
              {satTilesFailed && <p className="mt-1 text-amber-200">Your browser could not load the NASA tiles, so the layer is not drawn.</p>}
              <p className="mt-1 text-slate-400">Observed context, not a forecast and not a flood map. It does not affect the funding rule.</p>
              <p className="ff-num mt-1 text-[0.68rem] text-slate-500">{satellite.attribution} · layer {satellite.layerName} · native zoom ≤ {satellite.maxNativeZoom}</p>
            </>
          ) : loadingSat ? (
            <p className="text-slate-400">Asking NASA GIBS for the latest available IMERG observation date…</p>
          ) : (
            <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-3 text-amber-100">
              <p><strong className="font-semibold">Satellite rainfall layer unavailable.</strong> {satelliteError ?? satellite?.statusReason}</p>
              <p className="mt-1 text-amber-100/80">The base map is still shown. No imagery has been substituted.</p>
              <button type="button" onClick={onRetrySatellite} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/40 px-3 text-xs font-semibold hover:bg-amber-200/10">
                <RefreshCw size={13} aria-hidden="true" /> Try again
              </button>
            </div>
          )}
        </div>

        {available && (
          <div className="flex flex-col gap-2.5 md:w-64">
            <button
              type="button"
              onClick={() => setShowSat((v) => !v)}
              aria-pressed={showSat}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              {showSat ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
              {showSat ? "Satellite layer on" : "Satellite layer off"}
            </button>
            <label className="flex items-center gap-3 text-xs text-slate-400">
              <span className="shrink-0">Opacity</span>
              <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} disabled={!showSat} className="h-11 w-full accent-cyan-300" aria-label="Satellite layer opacity" />
            </label>
            {satellite.legendUrl && legendOk && (
              <div className="rounded-lg border border-white/10 bg-white/90 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={satellite.legendUrl} alt="NASA colour legend for IMERG precipitation rate" className="h-auto w-full" onError={() => setLegendOk(false)} />
              </div>
            )}
          </div>
        )}
      </div>
    </Glass>
  );
}
