"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { MapContainer, Marker, Rectangle, ScaleControl, TileLayer, Tooltip } from "react-leaflet";

export interface LeafletMapProps {
  center: [number, number];
  areaName: string;
  grid: { latitude: number; longitude: number } | null;
  satelliteUrl: string | null;
  satelliteAttribution: string;
  maxNativeZoom: number;
  opacity: number;
  onBaseTileLoad: () => void;
  onBaseTileError: () => void;
  onSatelliteTileLoad: () => void;
  onSatelliteTileError: () => void;
}

/** Interactive map: OpenStreetMap base tiles (no key) + optional NASA GIBS IMERG overlay. */
export default function LeafletMap(props: LeafletMapProps) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="ff-marker"><span class="ff-marker-ring"></span><span class="ff-marker-ring ff-marker-ring-2"></span><span class="ff-marker-dot"></span></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [],
  );
  const half = 0.125; // AIFS grid spacing is 0.25°

  return (
    <MapContainer center={props.center} zoom={6} minZoom={3} maxZoom={11} scrollWheelZoom={false} worldCopyJump className="h-full w-full" attributionControl>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        className="ff-basemap"
        eventHandlers={{ tileload: props.onBaseTileLoad, tileerror: props.onBaseTileError }}
      />
      {props.satelliteUrl && (
        <TileLayer
          key={props.satelliteUrl}
          url={props.satelliteUrl}
          attribution={props.satelliteAttribution}
          opacity={props.opacity}
          maxNativeZoom={props.maxNativeZoom}
          zIndex={5}
          eventHandlers={{ tileload: props.onSatelliteTileLoad, tileerror: props.onSatelliteTileError }}
        />
      )}
      {props.grid && (
        <Rectangle
          bounds={[
            [props.grid.latitude - half, props.grid.longitude - half],
            [props.grid.latitude + half, props.grid.longitude + half],
          ]}
          pathOptions={{ color: "#a78bfa", weight: 1.5, dashArray: "5 5", fillColor: "#a78bfa", fillOpacity: 0.06 }}
        >
          <Tooltip sticky>AIFS model grid cell, approx. 0.25° (about 28 km). Not an administrative boundary.</Tooltip>
        </Rectangle>
      )}
      <Marker position={props.center} icon={icon} keyboard title={`${props.areaName}, selected area`} alt={`${props.areaName}, selected area`}>
        <Tooltip direction="top" offset={[0, -18]}>
          {props.areaName} · selected area · {props.center[0].toFixed(4)}°N, {props.center[1].toFixed(4)}°E
        </Tooltip>
      </Marker>
      <ScaleControl position="bottomright" imperial={false} />
    </MapContainer>
  );
}
