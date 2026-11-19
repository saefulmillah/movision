/* ============================================================
   Tipe modul LHR Tertimbang (/api/admin/lhr/*).

   LHR Tertimbang = rata-rata volume lalu lintas per segmen tol
   dibobot panjang seksi, per golongan, per hari. Sumber hibrida:
   otomatis dari DB eoj + upload manual laporan AT6 sebagai backup.
   Envelope sukses { data, meta }, error { message }.
   ============================================================ */

/** GET /lhr/koridor → dropdown koridor. */
export interface LhrKoridor {
  kode_koridor: string;
  nama: string;
  /** true bila data otomatis tersedia dari DB eoj untuk koridor ini. */
  eoj_source: boolean;
  is_active: boolean;
}

/* ---------------- Hasil LHR (bagian A) ---------------- */

/** Satu baris harian hasil LHR tertimbang. */
export interface LhrRow {
  tanggal: string;
  lhr_gol1: number | null;
  lhr_gol2: number | null;
  lhr_gol3: number | null;
  lhr_gol4: number | null;
  lhr_gol5: number | null;
  lhr_total: number | null;
  /** Opsional — pendapatan realisasi harian (Rupiah) dari eoj (gross semua operator). */
  pendapatan?: number;
  /** Opsional (sistem terbuka) — porsi Hutama Karya dari bagi hasil (Rupiah). */
  pendapatan_hk?: number;
  /** ada kontribusi data otomatis (eoj) pada hari ini. */
  ada_auto: boolean;
  /** ada kontribusi data manual (AT6) pada hari ini. */
  ada_manual: boolean;
  /** Opsional — false bila ada gerbang exit aktif tanpa data OD pada tanggal ini. */
  lengkap?: boolean;
  /** Opsional — kode gerbang exit aktif yang kosong pada tanggal ini. */
  gerbang_kosong?: string[];
}

export interface LhrRataRata {
  gol1: number | null;
  gol2: number | null;
  gol3: number | null;
  gol4: number | null;
  gol5: number | null;
  total: number | null;
  /** Opsional — rata-rata pendapatan Rp/hari (gross). */
  pendapatan?: number | null;
  /** Opsional (sistem terbuka) — rata-rata pendapatan HK Rp/hari. */
  pendapatan_hk?: number | null;
}

export interface LhrMeta {
  kode_koridor: string;
  start_date: string;
  end_date: string;
  /** null untuk sistem terbuka (tak ada segmen; LHR = total lintasan harian). */
  panjang_total_km: number | null;
  jumlah_hari: number | null;
  rata_rata: LhrRataRata;
  /** Opsional — total pendapatan sebulan (Rupiah, gross). */
  pendapatan_total?: number | null;
  /** Opsional — tipe sistem ruas: "tertutup" (LHR tertimbang panjang) | "terbuka" (total lintasan). */
  jenis_sistem?: "tertutup" | "terbuka";
  /** Opsional (sistem terbuka) — total pendapatan HK sebulan (Rupiah). */
  pendapatan_hk_total?: number | null;
}

export interface LhrTertimbangResult {
  rows: LhrRow[];
  meta: LhrMeta | null;
}

/* ---------------- Monitoring Kelengkapan (bagian B) ---------------- */

export interface LhrGerbang {
  kode: string;
  nama: string;
}

/** Jumlah (volume) per golongan pada satu sel gerbang-exit di satu hari. */
export interface LhrKelengkapanJumlah {
  total: number | null;
  gol1: number | null;
  gol2: number | null;
  gol3: number | null;
  gol4: number | null;
  gol5: number | null;
}

/** Satu baris harian kelengkapan sel (tanggal × gerbang-exit). */
export interface LhrKelengkapanRow {
  tanggal: string;
  terisi_auto: string[];
  terisi_manual: string[];
  kosong: string[];
  /** Opsional — gerbang exit yang terisi tetapi sebagian shift-nya kosong (belum lengkap) pada tanggal ini.
   *  Dipakai mewarnai sel kuning di awal tanpa perlu expand. */
  terisi_sebagian?: string[];
  /** Opsional — jumlah per golongan per gerbang (kunci = kode_gerbang).
   *  Dipakai menampilkan angka di tiap sel; bila kosong, sel jatuh ke penanda A/M/·. */
  jumlah?: Record<string, LhrKelengkapanJumlah>;
}

export interface LhrKelengkapanRingkasan {
  total_sel: number;
  auto: number;
  manual: number;
  kosong: number;
  persen_lengkap: number;
  /** Opsional — jumlah sel "belum lengkap" (terisi tapi sebagian shift kosong). */
  sebagian?: number;
}

export interface LhrKosongDetail {
  tanggal: string;
  kode_gerbang: string;
  nama: string;
}

export interface LhrKelengkapanMeta {
  gerbang_aktif: LhrGerbang[];
  gerbang_nonaktif: LhrGerbang[];
  ringkasan: LhrKelengkapanRingkasan;
  kosong_detail: LhrKosongDetail[];
  /** 2 anjuran cara melengkapi (hubungi integrator / upload AT6). */
  cara_melengkapi: string[];
}

export interface LhrKelengkapanResult {
  rows: LhrKelengkapanRow[];
  meta: LhrKelengkapanMeta | null;
}

/* ---- Breakdown per shift (on-demand, saat satu gerbang dipilih) ---- */

export interface LhrShiftDetail {
  shift: number;
  status: "ada" | "kosong";
  total: number | null;
  gol1: number | null;
  gol2: number | null;
  gol3: number | null;
  gol4: number | null;
  gol5: number | null;
}

export interface LhrShiftRow {
  tanggal: string;
  sumber_lhr: "auto" | "manual" | "kosong";
  total: number | null;
  shift_kosong: number[];
  shifts: LhrShiftDetail[];
}

export interface LhrShiftMeta {
  kode_koridor: string;
  kode_gerbang: string;
  nama_gerbang: string;
  is_active: boolean;
  shift_list: number[];
  catatan: string;
}

export interface LhrShiftResult {
  rows: LhrShiftRow[];
  meta: LhrShiftMeta | null;
}

/* ---------------- Ingest otomatis (bagian C, opsional) ---------------- */

export interface LhrIngestResult {
  status?: string;
  [key: string]: unknown;
}

/* ---------------- Upload AT6 (bagian C) — preview → commit ---------------- */

export type LhrOdAction = "INSERT" | "UPDATE" | "SKIP" | "ERROR";

export interface LhrOdPreviewItem {
  file_name: string;
  gerbang_exit_nama: string | null;
  kode_gerbang_tujuan: string | null;
  asal_nama: string | null;
  kode_gerbang_asal: string | null;
  tanggal: string | null;
  gol: number | null;
  action_type: LhrOdAction;
  is_valid: boolean;
  error_message: string | null;
}

export interface LhrOdSummary {
  file_count: number;
  total_baris: number;
  insert: number;
  update: number;
  error: number;
  tanggal_set: string[];
  gerbang_tujuan_set: string[];
}

export interface LhrOdPreviewResult {
  import_session_id: string;
  status: string;
  summary: LhrOdSummary;
  preview: LhrOdPreviewItem[];
}

export interface LhrOdCommitResult {
  status: string;
  committed_rows: number;
}

export interface LhrOdSession {
  import_session_id: string;
  status: string;
  [key: string]: unknown;
}
