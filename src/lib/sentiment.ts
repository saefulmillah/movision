import { api } from "@/lib/api";
import type {
  SentimentPeriod,
  SentimentScopeData,
  SentimentTree,
  SentimentDashboard,
  SentimentUploadResult,
  SentimentRecommendation,
  UpsertRecoInput
} from "@/types/sentiment";

// ?scope= menyekat agregasi per lingkup (divisi/regional:<id>/cabang:<id>).
function sq(scope?: string | null): string {
  return scope && scope !== "divisi" ? `?scope=${encodeURIComponent(scope)}` : "";
}
function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/** Daftar periode yang sudah diunggah (dropdown). */
export async function getPeriods(): Promise<SentimentPeriod[]> {
  const data = await api.get<SentimentPeriod[] | { periods?: SentimentPeriod[] }>("/sentiment/periods");
  if (Array.isArray(data)) return data;
  return data?.periods ?? [];
}

/** Agregat satu scope + rekomendasi (Ringkasan & Isu). */
export function getScope(periodKey: string, scope?: string | null): Promise<SentimentScopeData> {
  return api.get<SentimentScopeData>(`/sentiment/${encodeURIComponent(periodKey)}${sq(scope)}`);
}

/** Kartu status anak-scope (Peta Wilayah), urut terburuk dulu. */
export function getTree(periodKey: string, scope?: string | null): Promise<SentimentTree> {
  return api.get<SentimentTree>(`/sentiment/${encodeURIComponent(periodKey)}/tree${sq(scope)}`);
}

/** Pohon drill lengkap (1 slide dashboard): root + keturunan, agregat per node. */
export function getDashboard(periodKey: string, scope?: string | null): Promise<SentimentDashboard> {
  return api.get<SentimentDashboard>(`/sentiment/${encodeURIComponent(periodKey)}/dashboard${sq(scope)}`);
}

/** Upload raw mention (.xlsx vendor). Hanya admin lingkup-penuh. Periode diambil
 *  otomatis dari kolom Date, atau paksa via argumen `period`. WRITE. */
export function uploadSentiment(file: File, period?: string | null): Promise<SentimentUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return api.post<SentimentUploadResult>(`/sentiment/upload${q}`, form);
}

/** Flush: hapus seluruh data mentah sentimen satu periode. Hanya admin divisi. WRITE. */
export function flushPeriod(periodKey: string): Promise<{ period_key: string; deleted: number }> {
  return api.delete<{ period_key: string; deleted: number }>(`/sentiment/${encodeURIComponent(periodKey)}`);
}

// --- Tindak lanjut (rekomendasi) per periode × scope ---
function recoQuery(periodKey: string, scope?: string | null): string {
  const params = new URLSearchParams({ period: periodKey });
  if (scope && scope !== "divisi") params.set("scope", scope);
  return params.toString();
}

export async function listRecommendations(periodKey: string, scope?: string | null): Promise<SentimentRecommendation[]> {
  const data = await api.get<{ recommendations?: SentimentRecommendation[] }>(`/sentiment/recommendations?${recoQuery(periodKey, scope)}`);
  return data?.recommendations ?? [];
}

export async function upsertRecommendation(periodKey: string, scope: string | null | undefined, body: UpsertRecoInput): Promise<SentimentRecommendation> {
  return first(await api.post<SentimentRecommendation[] | SentimentRecommendation>(`/sentiment/recommendations?${recoQuery(periodKey, scope)}`, body));
}

export function deleteRecommendation(id: number): Promise<unknown> {
  return api.delete(`/sentiment/recommendations/${id}`);
}
