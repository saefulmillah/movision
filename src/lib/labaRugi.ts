import { api } from "@/lib/api";
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

/** Data satu periode untuk 3 tampilan. */
export function getPeriod(periodKey: string): Promise<PeriodData> {
  return api.get<PeriodData>(`/laba-rugi/${encodeURIComponent(periodKey)}`);
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
