/* ============================================================
   Tipe modul Pendapatan (grup Rapat Direktorat).
   Bentuk data identik dengan sample-output/pendapatan-2026-08.json
   di paket backend. Satuan sumber Rp juta; KPI ditampilkan Rp miliar
   (juta ÷ 1000) oleh frontend.
   ============================================================ */

/** Sel KPI / bar ruas: nilai RKAP, Realisasi, dan %ACH (Realisasi ÷ RKAP). */
export interface KpiCell {
  rkap: number;
  real: number;
  ach: number;
}

/** Satu blok KPI (bulan atau SD): tiga kategori pendapatan. */
export interface KpiBlockData {
  tol: KpiCell;
  usaha_lainnya: KpiCell;
  total: KpiCell;
}

/** Satu batang grafik per ruas (LHR atau Pendapatan). */
export interface RuasBar {
  ruas: string;
  regional: string | null;
  rkap: number;
  real: number;
  ach: number;
}

/** Item periode untuk dropdown (GET /api/pendapatan/periods). */
export interface Period {
  key: string;
  label_month?: string | null;
  label_sd?: string | null;
  unit?: string;
  uploaded_at?: string | null;
  updated_at?: string | null;
}

export interface PeriodMeta {
  period_key: string;
  period_label_month: string;
  period_label_sd: string;
  unit_source: string;
  unit_kpi_display: string;
  [key: string]: unknown;
}

/** GET /api/pendapatan/:periodKey → data. */
export interface PeriodData {
  meta: PeriodMeta;
  kpi_month: KpiBlockData;
  kpi_sd: KpiBlockData;
  lhr: RuasBar[];
  pendapatan_ruas: RuasBar[];
}

/** POST /api/pendapatan/import → data. */
export interface ImportResult {
  period_key: string;
  period_label_month?: string;
  period_label_sd?: string;
  lhr_count?: number;
  pendapatan_ruas_count?: number;
  [key: string]: unknown;
}
