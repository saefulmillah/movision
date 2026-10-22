import { api, BASE_URL, getToken } from "@/lib/api";
import type { BreakdownUploadResult, ImportResult, Period, PeriodData } from "@/types/labaRugi";

/**
 * Daftar periode untuk dropdown.
 * Backend mengembalikan objek { latest, periods:[...] }; kontrak lama memakai
 * array langsung. Toleran terhadap kedua bentuk.
 */
export async function getPeriods(): Promise<Period[]> {
  const data = await api.get<Period[] | { periods?: Period[] }>("/laba-rugi/periods");
  if (Array.isArray(data)) return data;
  return data?.periods ?? [];
}

/** Data satu periode untuk 3 tampilan. `scope` opsional (presentasi multi-scope);
 *  "divisi"/kosong → data penuh (dipakai halaman admin). */
export function getPeriod(periodKey: string, scope?: string | null): Promise<PeriodData> {
  const q = scope && scope !== "divisi" ? `?scope=${encodeURIComponent(scope)}` : "";
  return api.get<PeriodData>(`/laba-rugi/${encodeURIComponent(periodKey)}${q}`);
}

/**
 * Upload workbook (.xlsx) — satu langkah (parse → validasi → simpan bila lolos).
 * Bila validasi gagal, backend membalas 422; klien API melempar ApiError yang
 * `payload`-nya berisi ringkasan (termasuk `validation.checks`).
 */
export function importPeriod(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  return api.post<ImportResult>("/laba-rugi/import", form);
}

/**
 * Upload file breakdown detail untuk sebuah periode. Bila rekonsiliasi menemukan
 * selisih & `force` tidak diset, backend membalas 422 (ApiError.payload berisi
 * `mismatches`). Dengan `force=true`, tetap disimpan.
 */
export function uploadBreakdown(periodKey: string, file: File, force = false): Promise<BreakdownUploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (force) form.append("force", "true");
  return api.post<BreakdownUploadResult>(`/laba-rugi/${encodeURIComponent(periodKey)}/breakdown`, form);
}

export type LrScopeUploadResult = {
  scope_key: string;
  period_key: string;
  period_label: string;
  columns: string[];
  entity_count: number;
  value_count: number;
  source_file: string | null;
};

export type LrScopePeriod = {
  period_key: string;
  period_label: string;
  report_month: number;
  report_year: number;
  source_file: string | null;
  uploaded_at: string | null;
  updated_at: string | null;
};

/**
 * Upload file kinerja L/R (format kaya per-entitas) untuk sebuah SCOPE (fitur
 * "Laba Rugi Regional", alur pra-rakor). `scope` = regional:<id> atau divisi;
 * `periodKey` = bulan laporan (YYYY-MM). Satu file regional mengisi dataset
 * regional & tiap cabangnya.
 */
export function uploadLrScopeDataset(scope: string, periodKey: string, file: File): Promise<LrScopeUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const q = `?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(periodKey)}`;
  return api.post<LrScopeUploadResult>(`/laba-rugi-regional/upload${q}`, form);
}

/** Daftar periode dataset L/R per-scope yang sudah diunggah untuk `scope`. */
export function getLrScopePeriods(scope: string): Promise<{ scope_key: string; dataset_scope_key: string; periods: LrScopePeriod[] }> {
  return api.get(`/laba-rugi-regional/periods?scope=${encodeURIComponent(scope)}`);
}

/** Data L/R satu periode untuk sebuah scope (ringkasan + konsol + breakdown).
 *  Belum diunggah → payload kosong (meta.empty). Shape = PeriodData. */
export function getLrScopeView(periodKey: string, scope: string): Promise<PeriodData> {
  return api.get<PeriodData>(`/laba-rugi-regional/${encodeURIComponent(periodKey)}?scope=${encodeURIComponent(scope)}`);
}

export type LhrUploadResult = { scope_key: string; period_key: string; period_label: string; ruas_count: number; source_file: string | null };

/** Upload file LHR (format template: sheet "LHR" + metadata Bulan/Tahun) untuk
 *  sebuah scope regional. Periode diambil OTOMATIS dari file; satu file mengisi
 *  LHR regional & tiap cabangnya. */
export function uploadLhrDataset(scope: string, file: File): Promise<LhrUploadResult> {
  const form = new FormData();
  form.append("file", file);
  return api.post<LhrUploadResult>(`/laba-rugi-regional/lhr-upload?scope=${encodeURIComponent(scope)}`, form);
}

/** Unduh template Excel LHR (memicu download di browser). */
export async function downloadLhrTemplate(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/laba-rugi-regional/lhr-template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error("Gagal mengunduh template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Template_LHR.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Daftar periode LHR per-scope yang sudah diunggah. */
export function getLhrScopePeriods(scope: string): Promise<{ scope_key: string; dataset_scope_key: string; periods: LrScopePeriod[] }> {
  return api.get(`/laba-rugi-regional/lhr-periods?scope=${encodeURIComponent(scope)}`);
}
