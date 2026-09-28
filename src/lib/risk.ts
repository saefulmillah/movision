import { api } from "@/lib/api";
import type {
  CreatePeriodInput,
  PeriodData,
  PeriodMeta,
  RiskItem,
  RiskMatrix,
  UpsertItemInput
} from "@/types/risk";

function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/** Konfigurasi matriks appetite (render heat map & dropdown 1–5). */
export function getMatrix(): Promise<RiskMatrix> {
  return api.get<RiskMatrix>("/risk/matrix");
}

/** Daftar periode untuk dropdown. */
export async function getPeriods(): Promise<PeriodMeta[]> {
  const data = await api.get<PeriodMeta[] | { periods?: PeriodMeta[] }>("/risk/periods");
  if (Array.isArray(data)) return data;
  return data?.periods ?? [];
}

/** Data satu periode (periode + risks[]). */
export function getPeriod(periodKey: string): Promise<PeriodData> {
  return api.get<PeriodData>(`/risk/${encodeURIComponent(periodKey)}`);
}

/** Buat periode baru (draft). WRITE. */
export async function createPeriod(body: CreatePeriodInput): Promise<PeriodMeta> {
  return first(await api.post<PeriodMeta[] | PeriodMeta>("/risk/periods", body));
}

/**
 * Upsert satu risiko + assessment tiap stage. Kunci upsert = `id` bila ada,
 * jika tidak `rank`. Backend menghitung cell & level dari likelihood/impact. WRITE.
 */
export async function upsertItem(periodKey: string, body: UpsertItemInput): Promise<RiskItem> {
  return first(await api.put<RiskItem[] | RiskItem>(`/risk/${encodeURIComponent(periodKey)}/items`, body));
}

/** Hapus satu risiko (assessment ikut terhapus). WRITE. */
export function deleteItem(itemId: number): Promise<unknown> {
  return api.delete(`/risk/items/${itemId}`);
}

/** Publikasikan periode (draft → published). WRITE. */
export async function publishPeriod(periodKey: string): Promise<PeriodMeta> {
  return first(await api.post<PeriodMeta[] | PeriodMeta>(`/risk/${encodeURIComponent(periodKey)}/publish`));
}
