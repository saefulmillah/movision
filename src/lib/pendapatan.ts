import { api, BASE_URL, getToken } from "@/lib/api";
import type { ImportResult, Period, PeriodData } from "@/types/pendapatan";

/**
 * Daftar periode untuk dropdown.
 * Backend mengembalikan objek { latest, periods:[...] }; toleran juga terhadap
 * bentuk array langsung.
 */
export async function getPeriods(): Promise<Period[]> {
  const data = await api.get<Period[] | { periods?: Period[] }>("/pendapatan/periods");
  if (Array.isArray(data)) return data;
  return data?.periods ?? [];
}

/** Data satu periode (KPI bulan/SD + grafik LHR & Pendapatan per ruas).
 *  `scope` opsional (presentasi multi-scope); "divisi"/kosong → data penuh. */
export function getPeriod(periodKey: string, scope?: string | null): Promise<PeriodData> {
  const q = scope && scope !== "divisi" ? `?scope=${encodeURIComponent(scope)}` : "";
  return api.get<PeriodData>(`/pendapatan/${encodeURIComponent(periodKey)}${q}`);
}

/**
 * Impor periode baru — unggah dua workbook (.xlsx) PROG II + Evaluasi dengan
 * bulan & tahun. Backend memproses (parse → simpan) lalu membalas { period_key }.
 */
export function importPeriod(
  progIi: File,
  evaluasi: File,
  month: string,
  year: number | string
): Promise<ImportResult> {
  const form = new FormData();
  form.append("prog_ii", progIi);
  form.append("evaluasi", evaluasi);
  form.append("month", month);
  form.append("year", String(year));
  return api.post<ImportResult>("/pendapatan/import", form);
}

export type LhrUploadResult = {
  scope_key: string;
  periods: string[];
  period_count: number;
  ruas_count: number;
  row_count: number;
  latest: string | null;
};
export type LhrPeriod = { period_key: string; period_label: string; source_file: string | null; uploaded_at: string | null; ruas_count: number };

/** Upload LHR ke LINGKUP terpilih (sheet "LHR" + metadata Bulan/Tahun). Periode
 *  diambil OTOMATIS dari file. divisi → scope 'divisi'; regional → scope-nya.
 *  Pendapatan (KPI + Tol per-ruas) tetap dari file kinerja L/R (menu Laba Rugi). */
export function uploadLhrScoped(scope: string, file: File): Promise<LhrUploadResult> {
  const form = new FormData();
  form.append("file", file);
  return api.post<LhrUploadResult>(`/pendapatan/lhr-upload?scope=${encodeURIComponent(scope)}`, form);
}

/** Daftar periode (bulan) yang sudah ada data LHR untuk lingkup — dropdown periode. */
export function getLhrPeriods(scope: string): Promise<{ scope_key: string; periods: LhrPeriod[] }> {
  return api.get(`/pendapatan/lhr-periods?scope=${encodeURIComponent(scope)}`);
}

/** Hapus (flush) LHR untuk lingkup + periode (agar bisa upload ulang bersih). */
export function deleteLhr(scope: string, periodKey: string): Promise<{ deleted: number }> {
  return api.delete(`/pendapatan/lhr?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(periodKey)}`);
}

/** Unduh template Excel LHR (daftar ruas menyesuaikan lingkup). */
export async function downloadLhrTemplate(scope?: string): Promise<void> {
  const token = getToken();
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const res = await fetch(`${BASE_URL}/pendapatan/lhr-template${q}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error("Gagal mengunduh template");
  // Nama file dari server (disesuaikan lingkup), fallback bila header tak terbaca.
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const filename = m ? decodeURIComponent(m[1].replace(/"/g, "")) : "Template_LHR.xlsx";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
