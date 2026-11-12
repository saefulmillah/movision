import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type {
  TariffBranch,
  TariffCommitResult,
  TariffGrid,
  TariffImportOptions,
  TariffMeta,
  TariffPreviewItem,
  TariffPreviewResult,
  TariffRow
} from "@/types/tariff";

export const GOLONGAN = [1, 2, 3, 4, 5] as const;
export const GOLONGAN_LABEL: Record<number, string> = { 1: "Golongan I", 2: "Golongan II", 3: "Golongan III", 4: "Golongan IV", 5: "Golongan V" };

/* ---------------- Matriks (read-only) ---------------- */

export function listTariffBranches(): Promise<TariffBranch[]> {
  return api.get<TariffBranch[]>("/admin/tariff/branches");
}

export interface TariffMatrixParams {
  branch_id?: string | number;
  gol_id?: string | number;
  is_open?: string | number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TariffMatrixResult {
  items: TariffRow[];
  meta: TariffMeta;
}

export async function listTariffMatrix(params: TariffMatrixParams = {}): Promise<TariffMatrixResult> {
  const { data, meta } = await api.getWithMeta<TariffRow[]>(`/admin/tariff/matrix${buildQuery(params)}`);
  const m = (meta as unknown as TariffMeta) ?? null;
  return {
    items: data ?? [],
    meta: m ?? { page: params.page ?? 1, limit: params.limit ?? 50, total: data?.length ?? 0, total_page: 1 }
  };
}

export function getTariffGrid(params: { branch_id: number; gol_id: number; is_open?: string | number }): Promise<TariffGrid> {
  return api.get<TariffGrid>(`/admin/tariff/matrix/grid${buildQuery(params)}`);
}

/* ---------------- Upload / import ---------------- */

export function previewTariffImport(file: File, options: TariffImportOptions = {}): Promise<TariffPreviewResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (options.is_open !== undefined) fd.append("is_open", String(options.is_open));
  if (options.tariff_mode) fd.append("tariff_mode", options.tariff_mode);
  if (options.sheet_name) fd.append("sheet_name", options.sheet_name);
  if (options.allow_same_origin_destination !== undefined) fd.append("allow_same_origin_destination", String(options.allow_same_origin_destination));
  if (options.generate_reverse_od !== undefined) fd.append("generate_reverse_od", String(options.generate_reverse_od));
  fd.append("preview_limit", String(options.preview_limit ?? 100));
  return api.post<TariffPreviewResult>("/admin/tariff/import/preview", fd);
}

export interface PreviewItemsResult {
  preview: TariffPreviewItem[];
  meta: TariffMeta;
}

export async function listPreviewItems(
  sessionId: string,
  params: { page?: number; limit?: number; action?: string; source?: string } = {}
): Promise<PreviewItemsResult> {
  const { data, meta } = await api.getWithMeta<{ preview: TariffPreviewItem[] }>(
    `/admin/tariff/import/preview/${encodeURIComponent(sessionId)}/items${buildQuery(params)}`
  );
  const m = (meta as unknown as TariffMeta) ?? null;
  return {
    preview: (data as { preview?: TariffPreviewItem[] })?.preview ?? [],
    meta: m ?? { page: params.page ?? 1, limit: params.limit ?? 100, total: 0, total_page: 0 }
  };
}

export function commitTariffImport(importSessionId: string): Promise<TariffCommitResult> {
  return api.post<TariffCommitResult>("/admin/tariff/import/commit", { import_session_id: importSessionId });
}

export function getImportSession(importSessionId: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>(`/admin/tariff/import/sessions/${encodeURIComponent(importSessionId)}`);
}
