import { api, BASE_URL, getToken } from "@/lib/api";
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

// ?scope= untuk menyekat risiko per lingkup (divisi/regional:<id>/cabang:<id>).
function sq(scope?: string | null): string {
  return scope && scope !== "divisi" ? `?scope=${encodeURIComponent(scope)}` : "";
}

/** Daftar periode (per lingkup) untuk dropdown. */
export async function getPeriods(scope?: string | null): Promise<PeriodMeta[]> {
  const data = await api.get<PeriodMeta[] | { periods?: PeriodMeta[] }>(`/risk/periods${sq(scope)}`);
  if (Array.isArray(data)) return data;
  return data?.periods ?? [];
}

/** Data satu periode (periode + risks[]) untuk lingkup. */
export function getPeriod(periodKey: string, scope?: string | null): Promise<PeriodData> {
  return api.get<PeriodData>(`/risk/${encodeURIComponent(periodKey)}${sq(scope)}`);
}

/** Buat periode baru (draft) untuk lingkup. WRITE. */
export async function createPeriod(body: CreatePeriodInput, scope?: string | null): Promise<PeriodMeta> {
  return first(await api.post<PeriodMeta[] | PeriodMeta>(`/risk/periods${sq(scope)}`, body));
}

/**
 * Upsert satu risiko + assessment tiap stage pada lingkup. Kunci upsert = `id`
 * bila ada, jika tidak `rank`. Backend menghitung cell & level. WRITE.
 */
export async function upsertItem(periodKey: string, body: UpsertItemInput, scope?: string | null): Promise<RiskItem> {
  return first(await api.put<RiskItem[] | RiskItem>(`/risk/${encodeURIComponent(periodKey)}/items${sq(scope)}`, body));
}

/** Hapus satu risiko (assessment ikut terhapus). WRITE. */
export function deleteItem(itemId: number): Promise<unknown> {
  return api.delete(`/risk/items/${itemId}`);
}

/** Publikasikan periode (draft → published) untuk lingkup. WRITE. */
export async function publishPeriod(periodKey: string, scope?: string | null): Promise<PeriodMeta> {
  return first(await api.post<PeriodMeta[] | PeriodMeta>(`/risk/${encodeURIComponent(periodKey)}/publish${sq(scope)}`));
}

export type RiskImportResult = { period_key: string; scope: string; period_label: string; item_count: number };

/** Upload Top Risk (.xlsx) — MENGGANTI daftar risiko periode+lingkup. WRITE. */
export async function uploadRisk(periodKey: string, file: File, scope?: string | null): Promise<RiskImportResult> {
  const form = new FormData();
  form.append("file", file);
  return first(await api.post<RiskImportResult[] | RiskImportResult>(`/risk/${encodeURIComponent(periodKey)}/upload${sq(scope)}`, form));
}

/** Unduh template Top Risk (prefill data periode bila ada). */
export async function downloadRiskTemplate(scope?: string | null, periodKey?: string | null): Promise<void> {
  const token = getToken();
  const params = new URLSearchParams();
  if (scope && scope !== "divisi") params.set("scope", scope);
  if (periodKey) params.set("period", periodKey);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${BASE_URL}/risk/template${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Gagal mengunduh template");
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const filename = m ? decodeURIComponent(m[1].replace(/"/g, "")) : "Template_TopRisk.xlsx";
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
