/* ============================================================
   Tipe kontrak API Dashboard Manajemen
   (GET /api/dashboard/management-summary).

   Gate backend: module `dashboard` (READ).
   Envelope standar { status, message, data } — `data` dibongkar oleh api.ts.

   Catatan domain:
   - `kpi` / `lalin_pendapatan` / `sos` mengikuti rentang periode.
   - `operasional` adalah snapshot real-time (TIDAK tergantung periode).
   - `sumber_bermasalah.*` true → sumber gagal dimuat, tampilkan degradasi.
   ============================================================ */

export interface DashPeriode {
  start_date: string;
  end_date: string;
  hari: number;
  pembanding: { start_date: string; end_date: string };
}

/** KPI dengan perbandingan periode sebelumnya; delta_persen bisa null. */
export interface KpiDelta {
  nilai: number;
  sebelumnya: number;
  delta_persen: number | null;
}

export interface KpiInsidenSos extends KpiDelta {
  /** Insiden masih terbuka (real-time-ish untuk periode). */
  terbuka: number;
  /** Rata-rata response time (detik); null bila tak ada sampel. */
  avg_response_seconds: number | null;
  /** Kepatuhan SLA response (0..100); null bila tak ada sampel. */
  sla_persen: number | null;
}

export interface KpiAset {
  wim_online: number;
  wim_offline: number;
  wim_total: number;
  cctv_online: number;
  cctv_offline: number;
  vms_online: number;
  vms_offline: number;
  gerbang_alert: number;
}

export interface DashKpi {
  pendapatan: KpiDelta;
  lalin: KpiDelta;
  insiden_sos: KpiInsidenSos;
  aset: KpiAset;
}

/** Snapshot operasional real-time (tidak tergantung periode). */
export interface DashOperasional {
  ruas: { active: number; total: number };
  cctv: { online: number; offline: number; total: number };
  vms: { online: number; offline: number; total: number };
  gates: { alerts: number; error: number; warning: number; offline: number };
  vehicles: { total: number; live: number; moving: number };
  sos_terbuka: number;
  wim: {
    total_sites: number;
    online_sites: number;
    warning_sites: number;
    offline_sites: number;
    total_devices: number;
    total_devices_online: number;
    total_devices_offline: number;
  };
}

export interface DashRuasRow {
  id_ruas: number;
  kode_ruas: string;
  nama_ruas: string;
  total_lln: number;
  total_rp: number;
}

export interface DashTrenHarian {
  tanggal: string;
  total_lln: number;
  total_rp: number;
}

export interface DashLalinPendapatan {
  total_lln: number;
  total_rp: number;
  manual_rp: number;
  selisih_rp_eoj_manual: number;
  /** Sudah terurut total_rp desc. */
  per_ruas: DashRuasRow[];
  /** Terurut tanggal asc. */
  tren_harian: DashTrenHarian[];
}

/* ---- Blok SOS (= output analitik SOS penuh) ---- */

export interface DashSosRingkasan {
  total: number;
  dispatched: number;
  in_handling: number;
  completed: number;
  avg_response_seconds: number | null;
  avg_resolution_seconds: number | null;
  sla_terpenuhi: number;
  sla_dari: number;
  sla_persen: number | null;
}

export interface DashSosPerJenis {
  incident_type: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface DashSosPerRuas {
  id_ruas: number;
  kode_ruas: string;
  nama_ruas: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface DashSosTrenHarian {
  tanggal: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface DashSos {
  ringkasan: DashSosRingkasan;
  per_jenis: DashSosPerJenis[];
  per_ruas: DashSosPerRuas[];
  tren_harian: DashSosTrenHarian[];
}

/* ---- Panel "Butuh Perhatian" ---- */

export type Severitas = "tinggi" | "sedang" | "rendah";

export interface ButuhPerhatianItem {
  severitas: Severitas;
  /** wim | gerbang | cctv | sos | rekonsiliasi | … (untuk drill-down). */
  tipe: string;
  judul: string;
  nilai: string | number | null;
  detail: string | null;
}

export interface SumberBermasalah {
  monitoring_operasi: boolean;
  wim: boolean;
  sos: boolean;
  rekonsiliasi: boolean;
}

export interface ManagementSummary {
  periode: DashPeriode;
  kpi: DashKpi;
  operasional: DashOperasional;
  lalin_pendapatan: DashLalinPendapatan;
  sos: DashSos;
  /** Sudah terurut severitas desc. */
  butuh_perhatian: ButuhPerhatianItem[];
  sumber_bermasalah: SumberBermasalah;
}
