import { api } from "@/lib/api";
import type { ImportResult, Period, PeriodData } from "@/types/labaRugi";

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
