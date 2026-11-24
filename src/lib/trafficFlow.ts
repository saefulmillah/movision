/* ============================================================
   Klien & tipe untuk modul Arus Lalin (traffic_flow) backend.
   Endpoint: /api/traffic-flow/*  — lihat cctv-backend.
   ============================================================ */

import { api } from "@/lib/api";

export type Arah = string; // palembang | pekanbaru | padang | medan | bengkulu | lainnya
export type Level = "lancar" | "ramai" | "padat" | "kritis" | "anomali" | "data" | "n/a";

export const ARAH_UTAMA: Arah[] = ["palembang", "pekanbaru", "padang", "medan"];

export const ARAH_LABEL: Record<string, string> = {
  palembang: "Palembang",
  pekanbaru: "Pekanbaru",
  padang: "Padang",
  medan: "Medan/Sumut",
  bengkulu: "Bengkulu",
  lainnya: "Lainnya"
};

export function arahLabel(a: string): string {
  return ARAH_LABEL[a] ?? a.charAt(0).toUpperCase() + a.slice(1);
}

/** Warna & label tiap level kepadatan/status. */
export const LEVEL_META: Record<Level, { label: string; color: string }> = {
  lancar: { label: "Lancar", color: "#22c55e" },
  ramai: { label: "Ramai", color: "#eab308" },
  padat: { label: "Padat", color: "#f97316" },
  kritis: { label: "Kritis", color: "#ef4444" },
  anomali: { label: "Diduga Hambatan", color: "#a855f7" },
  data: { label: "Data Terputus", color: "#64748b" },
  "n/a": { label: "—", color: "#64748b" }
};

export function levelMeta(level: string | null | undefined) {
  return LEVEL_META[(level as Level) ?? "n/a"] ?? LEVEL_META["n/a"];
}

// ---- Tipe payload ----

export interface SeriesPoint { bin15: string; vll: number; }

export interface ThroughputItem {
  arah: Arah;
  kode_bujt?: string;
  gb_tujuan?: string;
  is_open_system?: boolean;
  vll_60m: number;
  vll_prev_60m: number;
  tren_60m: number;
  vll_bin_last: number;
  last_bin: string | null;
  series: SeriesPoint[];
}
export interface ThroughputResp {
  group: string; arah: string; series_hours: number; count: number; items: ThroughputItem[];
}

export interface HealthResp {
  last_ingest: string | null;
  last_bin: string | null;
  lag_minutes: number | null;
  poll_interval_minutes: number;
  hari_ini: { bins: number; vll: number };
  gerbang_belum_terpetakan: { kode_bujt: string; gb_tujuan: string; vll: number }[];
}

export interface HourlyItem { arah: Arah; jam: number; vll: number; is_partial: boolean; }
export interface BaselineItem { arah: Arah; jam: number; avg: number; weight: number; }
export interface HourlyResp {
  tanggal: string; jam_berjalan: number; count: number; items: HourlyItem[]; baseline: BaselineItem[];
}

export interface DensityItem {
  kode_bujt: string; gb_tujuan: string; arah: Arah; is_open_system: boolean;
  rate_now: number; rate_smp_now: number;
  kapasitas_jam: number; kapasitas_smp_jam: number; metode: string | null;
  rho: number | null; tren: number | null; level: Level;
  rho_smp: number | null; tren_smp: number | null; level_smp: Level;
  smp_ratio: number | null;
  gardu_ref: number; gardu_aktif: number | null; kapasitas_per_gardu: number;
  kapasitas_dinamis: number | null; rho_dinamis: number | null; tren_dinamis: number | null;
  level_dinamis?: Level;
  kapasitas_desain?: number | null; pct_desain?: number | null;
  // Bukti antrian (A+C): jenuh bertahan / waktu tempuh naik → status "kritis = antri".
  antri?: boolean;
  antri_alasan?: string[];
  sat_bins?: number;
  avg_tt_now?: number | null;
  avg_tt_base?: number | null;
  tt_ratio?: number | null;
  butuh_mobile_reader?: boolean;
  last_bin: string | null;
}
export interface DensityResp { arah: string; count: number; items: DensityItem[]; }
export interface RankingResp { min_level: string; count: number; items: DensityItem[]; }

export interface CapacityItem {
  kode_bujt: string; gb_tujuan: string; arah: Arah; is_open_system: boolean;
  kapasitas_jam: number; kapasitas_smp_jam: number; gardu_ref: number;
  kapasitas_per_gardu: number; kapasitas_desain?: number;
  gardu_reversible?: number; kapasitas_contraflow?: number;
  metode: string; sample_jam: number; updated_at: string | null;
}
export interface CapacityResp { count: number; items: CapacityItem[]; }

export interface Cctv {
  id: number; name: string; is_gate: boolean; stream_url: string | null;
  antmedia_id: string | null; broadcast_status: string | null; lat: number | null; lon: number | null;
}
export interface AnomalyItem extends DensityItem {
  rho_prev: number | null; drop_ratio: number | null;
  avg_tt_now: number | null; avg_tt_base: number | null;
  status: Level; reasons: string[]; severitas: "tinggi" | "sedang" | null;
  cctv?: Cctv[];
}
export interface AnomalyResp {
  arah: string; threshold: Record<string, number>; count: number; anomali_count: number;
  anomali: AnomalyItem[]; items: AnomalyItem[];
}

export interface CctvGate { kode_bujt: string; gb_tujuan: string; arah: Arah; cctv: Cctv[]; }
export interface CctvResp { arah: string; gerbang_count: number; cctv_count: number; items: CctvGate[]; }

export interface PrediksiVsItem {
  arah: Arah; prediksi_kend: number | null; source: "resmi" | "baseline" | null;
  vll_kumulatif: number; porsi_jam: number;
  proyeksi_eod: number | null; progres_persen: number | null; flag_lampaui: boolean;
  overlay: { jam: number; prediksi_jam: number }[];
}
export interface PrediksiVsResp {
  tanggal: string; jam_berjalan: number; min_porsi_eod: number; flag_ratio: number;
  count: number; items: PrediksiVsItem[];
}

export interface PrediksiRow {
  scope_type: "arah" | "gerbang"; scope_value: string; tanggal: string;
  prediksi_kend: number; source: "resmi" | "baseline"; updated_at: string | null;
}
export interface PrediksiListResp { tanggal: string; count: number; items: PrediksiRow[]; }

export interface ArahMapItem {
  kode_bujt: string; gb_tujuan: string; arah: Arah;
  is_open_system: boolean; is_active: boolean;
}
export interface ArahMapResp { arah_utama: Arah[]; count: number; items: ArahMapItem[]; }

export type KondisiObservasi = "lancar" | "antri_ringan" | "antri_sedang" | "antri_parah";
export const KONDISI_META: Record<KondisiObservasi, { label: string; color: string }> = {
  lancar: { label: "Lancar", color: "#22c55e" },
  antri_ringan: { label: "Antri ringan", color: "#eab308" },
  antri_sedang: { label: "Antri sedang", color: "#f97316" },
  antri_parah: { label: "Antri parah", color: "#ef4444" }
};
export interface ObservasiRow {
  id: number; kode_bujt: string; gb_tujuan_norm: string; arah: string | null;
  observed_at: string; kondisi: KondisiObservasi; gardu_antri: number; catatan: string | null;
  snap_level: Level | null; snap_rho: number | string | null; snap_rate_now: number | null;
  snap_kapasitas_jam: number | null; snap_tt_avg: number | string | null;
  snap_antri: number | null; snap_last_bin: string | null; observer_name: string | null;
}
export interface ObservasiListResp { count: number; items: ObservasiRow[]; }
export interface ObservasiCreateBody {
  kode_bujt: string; gb_tujuan: string; arah?: string;
  kondisi: KondisiObservasi; gardu_antri?: number; catatan?: string;
}

// ---- Pemanggil ----

const B = "/traffic-flow";

export const trafficFlow = {
  throughput: (p?: { arah?: string; group?: string; series_hours?: number }) =>
    api.get<ThroughputResp>(`${B}/throughput${qs(p)}`),
  arahMap: () => api.get<ArahMapResp>(`${B}/arah-map`),
  health: () => api.get<HealthResp>(`${B}/health`),
  hourly: () => api.get<HourlyResp>(`${B}/hourly`),
  density: (arah?: string) => api.get<DensityResp>(`${B}/density${qs({ arah })}`),
  ranking: (p?: { min_level?: string; limit?: number }) => api.get<RankingResp>(`${B}/ranking${qs(p)}`),
  capacity: () => api.get<CapacityResp>(`${B}/capacity`),
  anomaly: (arah?: string) => api.get<AnomalyResp>(`${B}/anomaly${qs({ arah })}`),
  cctv: (p?: { arah?: string; gb_tujuan?: string }) => api.get<CctvResp>(`${B}/cctv${qs(p)}`),
  prediksiVs: (arah?: string) => api.get<PrediksiVsResp>(`${B}/prediksi-vs${qs({ arah })}`),
  prediksiList: (tanggal?: string) => api.get<PrediksiListResp>(`${B}/prediksi${qs({ tanggal })}`),
  prediksiUpsert: (rows: Omit<PrediksiRow, "source" | "updated_at">[]) =>
    api.post<{ upserted: number }>(`${B}/prediksi`, rows),
  observasiList: (p?: { kode_bujt?: string; gb_tujuan?: string; limit?: number }) =>
    api.get<ObservasiListResp>(`${B}/observasi${qs(p)}`),
  observasiCreate: (body: ObservasiCreateBody) =>
    api.post<{ id: number }>(`${B}/observasi`, body)
};

function qs(p?: Record<string, string | number | undefined | null>): string {
  if (!p) return "";
  const parts = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
