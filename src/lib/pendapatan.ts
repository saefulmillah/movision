import { api } from "@/lib/api";
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

/** Data satu periode (KPI bulan/SD + grafik LHR & Pendapatan per ruas). */
export function getPeriod(periodKey: string): Promise<PeriodData> {
  return api.get<PeriodData>(`/pendapatan/${encodeURIComponent(periodKey)}`);
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
