import { api } from "@/lib/api";
import { buildQuery, paged } from "@/lib/news";
import type { PagedResult } from "@/lib/news";
import type { CameraRow, MasterRow } from "@/types/masterData";

/** Admin master-data membungkus sebagian respons sebagai array; ambil elemen pertama. */
function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Factory CRUD untuk entitas admin yang berbentuk array envelope
 * `{ status, message, data: [...] }`. Detail/create/update dibungkus `[row]`.
 */
export function createCrud<T extends MasterRow = MasterRow>(endpoint: string) {
  return {
    list: (params: Record<string, unknown> = {}): Promise<T[]> =>
      api.get<T[]>(`${endpoint}${buildQuery(params)}`),
    detail: async (id: number | string): Promise<T> => first(await api.get<T[] | T>(`${endpoint}/${id}`)),
    create: async (body: Record<string, unknown>): Promise<T> =>
      first(await api.post<T[] | T>(endpoint, body)),
    update: async (id: number | string, body: Record<string, unknown>): Promise<T> =>
      first(await api.put<T[] | T>(`${endpoint}/${id}`, body)),
    remove: (id: number | string): Promise<unknown> => api.delete(`${endpoint}/${id}`)
  };
}

/* ---------------- Kamera: list berpaginasi (data.items + data.pagination) ---------------- */

interface CameraListEnvelope {
  items: CameraRow[];
  pagination: { page: number; limit: number; total_items: number; total_pages: number };
}

export interface CameraListParams {
  page?: number;
  limit?: number;
  branch_id?: string | number;
  is_active?: string | number;
  is_active_web?: string | number;
  q?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export async function fetchCameras(params: CameraListParams = {}): Promise<PagedResult<CameraRow>> {
  const env = await api.get<CameraListEnvelope>(`/admin/cameras${buildQuery(params)}`);
  const p = env?.pagination;
  const asMeta = p
    ? { pagination: { page: p.page, per_page: p.limit, total: p.total_items, total_pages: p.total_pages } }
    : undefined;
  return paged(env?.items ?? [], asMeta, params.page, params.limit);
}

export const cameraCrud = createCrud<CameraRow>("/admin/cameras");

/** Reorder kamera dalam satu branch (kirim SEMUA id kamera branch itu, tanpa duplikat). */
export function reorderCameras(branchId: number, cameraIds: number[]): Promise<unknown> {
  return api.put("/admin/cameras/reorder", { branch_id: branchId, camera_ids: cameraIds });
}
