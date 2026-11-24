/* Konfigurasi & pemetaan data layer Peta Aset.
   Layer WIM sengaja dihilangkan pada fase ini. */

import { backendAsset } from "@/lib/api";
import { MARKER_COLORS, labeledMarkerDataUri, markerDataUri } from "@/lib/markerIcon";
import type { GateAlert, GateLocation, MapAsset, SosTicket } from "@/types/monitoring";
import type { LiveVehicle, NetworkArc, NetworkNode, WeatherPoint } from "@/types/map";
import { normGate } from "./arusResolver";

export type LayerKey = "cctv" | "vms" | "fo" | "gps" | "gate" | "weather" | "sos" | "gateloc";

export interface LayerMeta {
  key: LayerKey;
  name: string;
  icon: string;
  /** Token warna CSS marker. */
  colorVar: string;
  /** Warna hex fallback untuk marker Google Maps (SVG symbol). */
  color: string;
  hasList: boolean;
  defaultOn: boolean;
}

export const LAYERS: LayerMeta[] = [
  { key: "cctv", name: "CCTV", icon: "cctv", colorVar: "--sem-green", color: "#34D399", hasList: true, defaultOn: false },
  { key: "vms", name: "VMS", icon: "monitor", colorVar: "--sem-amber", color: "#FBBF24", hasList: true, defaultOn: false },
  { key: "fo", name: "Jaringan FO", icon: "share-2", colorVar: "--sem-cyan", color: "#22D3EE", hasList: true, defaultOn: false },
  { key: "gps", name: "GPS Kendaraan", icon: "truck", colorVar: "--st-blue", color: "#5A8DFF", hasList: true, defaultOn: true },
  { key: "gate", name: "Gerbang Tol", icon: "building-2", colorVar: "--sem-red", color: "#F43F5E", hasList: true, defaultOn: true },
  { key: "weather", name: "Cuaca", icon: "cloud", colorVar: "--sem-sky", color: "#38BDF8", hasList: true, defaultOn: false },
  { key: "sos", name: "SOS", icon: "siren", colorVar: "--sem-rose", color: "#FB7185", hasList: true, defaultOn: true },
  // Lokasi gerbang dari master (titik abu-abu, tanpa klaim status) — melengkapi
  // layer "Gerbang Tol" untuk gerbang yang belum ada datanya di feed status.
  { key: "gateloc", name: "Lokasi Gerbang", icon: "map-pin", colorVar: "--st-gray", color: "#94A3B8", hasList: false, defaultOn: false }
];

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  layer: LayerKey;
  color: string;
  critical: boolean;
  /** URL ikon marker (mis. dari payload). Bila ada, dipakai menggantikan simbol default. */
  iconUrl?: string;
  /** Ukuran & anchor ikon kustom (mis. ikon berlabel yang lebih lebar). */
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  /** Untuk popup info: nama perangkat + label tipe. */
  name?: string;
  typeLabel?: string;
  /** Khusus GPS: jenis kendaraan (untuk segmentasi donut cluster multi-kategori). */
  vehicleType?: string;
}

const LAYER_TYPE_LABEL: Record<LayerKey, string> = {
  cctv: "CCTV",
  vms: "VMS",
  fo: "Jaringan FO",
  gps: "GPS Kendaraan",
  gate: "Gerbang Tol",
  weather: "Cuaca",
  sos: "SOS",
  gateloc: "Lokasi Gerbang"
};

export interface ListItem {
  id: string;
  title: string;
  desc: string;
  status: string;
  lat?: number;
  lng?: number;
  /** Data mentah untuk panel detail. */
  raw: unknown;
}

const CRITICAL = new Set(["error", "offline", "critical"]);

function isCritical(status?: string): boolean {
  return CRITICAL.has(String(status || "").toLowerCase());
}

/* ---- CCTV / VMS ---- */
export function assetToPoint(a: MapAsset, layer: LayerKey): MapPoint | null {
  if (!a.lat || !a.lng) return null;
  const critical = !a.is_online || isCritical(a.status);
  const base = layer === "vms" ? MARKER_COLORS.vms : MARKER_COLORS.cctv;
  const color = critical ? MARKER_COLORS.gray : base;
  return {
    id: `${layer}-${a.id}`,
    lat: a.lat,
    lng: a.lng,
    layer,
    color,
    critical,
    iconUrl: markerDataUri(layer === "vms" ? "monitor" : "cctv", color),
    name: a.asset_name || a.asset_code,
    typeLabel: LAYER_TYPE_LABEL[layer]
  };
}
export function assetToItem(a: MapAsset): ListItem {
  return {
    id: String(a.id),
    title: a.asset_name || a.asset_code,
    desc: a.asset_code,
    status: a.is_online ? "online" : "offline",
    lat: a.lat,
    lng: a.lng,
    raw: a
  };
}

/* ---- Gerbang ---- */
/** Status kepadatan gerbang "jadi perhatian" (dari ranking traffic-flow). */
export interface GateConcern {
  label: string;
  color: string;
  pct: string;
  /** Antrian terdeteksi (jenuh bertahan / waktu tempuh naik). */
  antri?: boolean;
  /** Disarankan menurunkan mobile reader (jenuh bertahan). */
  reader?: boolean;
  /** Catatan ringkas untuk tooltip (mis. "tt +42%"). */
  note?: string;
}

export function gateToPoint(g: GateAlert, concern?: Map<string, GateConcern>): MapPoint | null {
  if (!g.lat || !g.lng) return null;
  const critical = isCritical(g.status);
  const color = critical ? MARKER_COLORS.gray : MARKER_COLORS.gate;
  // Status kepadatan bila gerbang ini sedang jadi perhatian: hanya cincin warna
  // level pada marker — teks kepadatan ditampilkan lewat tooltip persisten.
  const dens = concern?.get(normGate(g.gate_name));
  const status = dens ? { color: dens.color } : undefined;
  // Marker gerbang menyertakan label nama (teks ber-outline) + cincin level.
  const labeled = labeledMarkerDataUri("building-2", color, g.gate_name, status);
  return {
    id: `gate-${g.gate_id}`,
    lat: g.lat,
    lng: g.lng,
    layer: "gate",
    color,
    critical,
    iconUrl: labeled.url,
    iconSize: labeled.size,
    iconAnchor: labeled.anchor,
    name: g.gate_name,
    typeLabel: dens ? gateDensityLabel(dens) : LAYER_TYPE_LABEL.gate
  };
}

/** Label tooltip gerbang: level + penanda antrian & saran mobile reader. */
function gateDensityLabel(d: GateConcern): string {
  const parts = [LAYER_TYPE_LABEL.gate, d.label];
  if (d.antri) parts.push(d.note ? `Antri (${d.note})` : "Antri");
  if (d.reader) parts.push("⚑ Mobile reader");
  return parts.join(" · ");
}
export function gateToItem(g: GateAlert): ListItem {
  const s = g.device_summary;
  const note = s?.error ? `${s.error} error` : s?.offline ? `${s.offline} offline` : s?.warning ? `${s.warning} warning` : "normal";
  return {
    id: String(g.gate_id),
    title: g.gate_name,
    desc: note,
    status: String(g.status),
    lat: g.lat,
    lng: g.lng,
    raw: g
  };
}

/* ---- GPS Kendaraan ---- */
export function vehicleToPoint(v: LiveVehicle): MapPoint | null {
  if (!v.latitude || !v.longitude) return null;
  // Nama jenis kendaraan: utamakan referensi master (type_name), lalu string mentah.
  const vtype = v.vehicle_type_ref?.type_name || v.vehicle_type || "Tidak diketahui";
  return {
    id: `gps-${v.vehicle_id}`,
    lat: v.latitude,
    lng: v.longitude,
    layer: "gps",
    color: "#5A8DFF",
    critical: false,
    // Ikon marker dari payload (vehicle_type_ref.icon_path) + prefix URL backend.
    iconUrl: backendAsset(v.vehicle_type_ref?.icon_path),
    name: v.label || v.node,
    typeLabel: vtype,
    vehicleType: vtype
  };
}
export function vehicleToItem(v: LiveVehicle): ListItem {
  const spd = v.speed !== undefined ? `${Math.round(v.speed)} km/j` : "";
  return {
    id: String(v.vehicle_id),
    title: v.label || v.node,
    desc: [v.vehicle_type, spd].filter(Boolean).join(" · "),
    status: v.movement_status || v.gps_status || "unknown",
    lat: v.latitude,
    lng: v.longitude,
    raw: v
  };
}

/* ---- Cuaca ---- */
export function weatherToPoint(w: WeatherPoint): MapPoint | null {
  if (!w.lat || !w.lng) return null;
  return {
    id: `weather-${w.id}`,
    lat: w.lat,
    lng: w.lng,
    layer: "weather",
    color: MARKER_COLORS.weather,
    critical: false,
    iconUrl: markerDataUri("cloud", MARKER_COLORS.weather),
    name: w.point_name,
    typeLabel: w.weather_label || LAYER_TYPE_LABEL.weather
  };
}

export function weatherToItem(w: WeatherPoint): ListItem {
  // Rincian inline: kondisi + suhu/kelembapan/angin (ringkas) langsung di daftar.
  const bits = [
    w.temperature_c != null ? `${Math.round(w.temperature_c)}°C` : "",
    w.humidity_pct != null ? `${Math.round(w.humidity_pct)}% RH` : "",
    w.wind_kph != null ? `${Math.round(w.wind_kph)} km/j` : ""
  ].filter(Boolean);
  return {
    id: String(w.id),
    title: w.point_name,
    desc: [w.weather_label, bits.join(" · ")].filter(Boolean).join(" — "),
    status: w.is_stale ? "stale" : w.weather_label || "normal",
    lat: w.lat,
    lng: w.lng,
    raw: w
  };
}

/* ---- Lokasi Gerbang (master, tanpa status) ---- */
export function gateLocToPoint(g: GateLocation): MapPoint | null {
  if (g.lat == null || g.lng == null) return null;
  const color = MARKER_COLORS.gray;
  // Marker berlabel nama gerbang, warna abu-abu netral, TANPA cincin status.
  const labeled = labeledMarkerDataUri("building-2", color, g.gate_name);
  return {
    id: `gateloc-${g.gate_code}`,
    lat: g.lat,
    lng: g.lng,
    layer: "gateloc",
    color,
    critical: false,
    iconUrl: labeled.url,
    iconSize: labeled.size,
    iconAnchor: labeled.anchor,
    name: g.gate_name,
    typeLabel: "Lokasi gerbang (tanpa data perangkat)"
  };
}

/* ---- SOS ---- */
export function sosToPoint(t: SosTicket): MapPoint | null {
  const lat = t.sos?.lat;
  const lng = t.sos?.lng;
  if (!lat || !lng) return null;
  return {
    id: `sos-${t.ticket_no}`,
    lat,
    lng,
    layer: "sos",
    color: MARKER_COLORS.sos,
    critical: true,
    // SOS: merah + cincin penekanan.
    iconUrl: markerDataUri("siren", MARKER_COLORS.sos, { ring: true }),
    name: t.ticket_no,
    typeLabel: t.incident_type || LAYER_TYPE_LABEL.sos
  };
}

/** Marker ikon pada node koneksi FO (dedup per node_id). */
export function arcNodesToPoints(arcs: NetworkArc[]): MapPoint[] {
  const seen = new Map<number, NetworkNode>();
  for (const e of arcs) {
    for (const n of [e.source, e.target]) {
      if (n && n.node_id != null && n.lat && n.lng && !seen.has(n.node_id)) seen.set(n.node_id, n);
    }
  }
  const icon = markerDataUri("share-2", MARKER_COLORS.fo);
  return [...seen.values()].map((n) => ({
    id: `fo-node-${n.node_id}`,
    lat: n.lat,
    lng: n.lng,
    layer: "fo" as LayerKey,
    color: MARKER_COLORS.fo,
    critical: false,
    iconUrl: icon,
    name: n.node_name,
    typeLabel: LAYER_TYPE_LABEL.fo
  }));
}
export function sosToItem(t: SosTicket): ListItem {
  return {
    id: t.ticket_no,
    title: `${t.ticket_no} · ${t.incident_type || "SOS"}`,
    desc: (t.sos?.location as string) || t.sos?.branch_name || "",
    status: "sos",
    lat: t.sos?.lat,
    lng: t.sos?.lng,
    raw: t
  };
}

/* ---- FO (koneksi) ---- */
export function arcToItem(e: NetworkArc): ListItem {
  return {
    id: String(e.edge_id),
    title: `${e.source?.node_name ?? "?"} → ${e.target?.node_name ?? "?"}`,
    desc: [e.connection_type, e.bandwidth_label].filter(Boolean).join(" · "),
    status: e.status,
    raw: e
  };
}
