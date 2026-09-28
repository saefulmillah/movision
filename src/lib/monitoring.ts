import { api } from "@/lib/api";
import type { Branch, GateAlert, MapAsset, MonitoringSummary, SosTicket } from "@/types/monitoring";
import type { LiveVehicle, NetworkArc, WeatherPoint } from "@/types/map";

/** Ringkasan KPI Dashboard (agregasi backend). */
export function fetchMonitoringSummary(): Promise<MonitoringSummary> {
  return api.get<MonitoringSummary>("/monitoring/summary");
}

/** Peringatan gerbang tol. Endpoint membungkus { data, meta }; klien mengembalikan data. */
export function fetchGateAlerts(): Promise<GateAlert[]> {
  return api.get<GateAlert[]>("/map/gate-alerts");
}

/** Daftar ruas beserta koordinat pusat. */
export function fetchBranches(): Promise<Branch[]> {
  return api.get<Branch[]>("/map/branches");
}

/** Snapshot aset CCTV & VMS untuk peta. */
export function fetchMapAssets(types = "cctv,vms"): Promise<MapAsset[]> {
  return api.get<MapAsset[]>(`/map-assets?type=${encodeURIComponent(types)}`);
}

/** Tiket SOS terbuka. */
export function fetchOpenSosTickets(): Promise<SosTicket[]> {
  return api.get<SosTicket[]>("/sos-tickets/open");
}

/** Koneksi Jaringan FO (untuk polyline/arc). */
export function fetchNetworkArcs(): Promise<NetworkArc[]> {
  return api.get<NetworkArc[]>("/map/network-arcs");
}

/** Titik pemantauan cuaca. */
export function fetchWeatherPoints(): Promise<WeatherPoint[]> {
  return api.get<WeatherPoint[]>("/map/weather");
}

/** Posisi kendaraan live (GPS). */
export function fetchLiveVehicles(): Promise<LiveVehicle[]> {
  return api.get<LiveVehicle[]>("/vehicles/live");
}
