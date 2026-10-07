import { api, ApiError, BASE_URL, getToken } from "@/lib/api";
import type { PaginationMeta } from "@/lib/api";
import type { NewsFormValues, NewsItem } from "@/types/modules";

function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/** Opsi kategori berita (news_type). */
export const NEWS_CATEGORIES: { value: string; label: string }[] = [
  { value: "1", label: "Sorotan" },
  { value: "2", label: "Berita" }
];

export function newsCategoryLabel(category: number | null | undefined): string {
  if (category === null || category === undefined) return "—";
  return NEWS_CATEGORIES.find((c) => c.value === String(category))?.label ?? `Tipe ${category}`;
}

export interface NewsListParams {
  page?: number;
  per_page?: number;
  status?: string;
  approval_status?: string;
  category?: string;
  search?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function buildQuery(params: Record<string, unknown> | object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

function paged<T>(data: T[], meta?: PaginationMeta, fallbackPage = 1, fallbackPer = 20): PagedResult<T> {
  const p = meta?.pagination;
  return {
    items: data ?? [],
    total: p?.total ?? (data?.length ?? 0),
    page: p?.page ?? fallbackPage,
    perPage: p?.per_page ?? fallbackPer,
    totalPages: p?.total_pages ?? 1
  };
}

export async function fetchNews(params: NewsListParams = {}): Promise<PagedResult<NewsItem>> {
  const { data, meta } = await api.getWithMeta<NewsItem[]>(`/admin/news${buildQuery(params)}`);
  return paged(data, meta, params.page, params.per_page);
}

export async function fetchNewsDetail(id: number): Promise<NewsItem> {
  return first(await api.get<NewsItem[] | NewsItem>(`/admin/news/${id}`));
}

function toPayload(v: NewsFormValues): Record<string, unknown> {
  // Catatan: `status`/`published_at` TIDAK dikirim lagi — publikasi hanya lewat
  // approval (approve). Create selalu draft; edit tidak boleh menyentuh is_open.
  return {
    title: v.title,
    content: v.content,
    category: v.category === "" ? undefined : Number(v.category),
    source: v.source || undefined,
    author: v.author || undefined,
    image: v.image || undefined
  };
}

/** Unggah file gambar; kembalikan { image, url } (URL absolut siap dipanggil mobile). */
export async function uploadNewsImage(file: File): Promise<{ image: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return first(await api.post<Array<{ image: string; url: string }> | { image: string; url: string }>("/admin/news/upload", fd));
}

/**
 * Unggah gambar dengan progress (pakai XHR karena fetch tak mengekspos progress upload).
 * `onProgress` menerima persentase 0–100 (atau -1 saat indeterminate/tahap server).
 */
export function uploadNewsImageWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ image: string; url: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/admin/news/upload`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        // Sisakan 100% untuk saat respons server benar-benar diterima.
        onProgress(pct >= 100 ? 99 : pct);
      } else {
        onProgress(-1);
      }
    };

    xhr.onload = () => {
      let json: { message?: string; data?: unknown } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = json?.data;
        const item = (Array.isArray(data) ? data[0] : data) as { image: string; url: string };
        onProgress(100);
        resolve(item);
      } else {
        reject(new ApiError(xhr.status, json?.message || `Gagal mengunggah (${xhr.status})`, json?.data ?? null));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Gagal mengunggah gambar"));
    xhr.onabort = () => reject(new ApiError(0, "Unggahan dibatalkan"));

    xhr.send(fd);
  });
}

export async function createNews(v: NewsFormValues): Promise<NewsItem> {
  return first(await api.post<NewsItem[] | NewsItem>("/admin/news", toPayload(v)));
}

export async function updateNews(id: number, v: NewsFormValues): Promise<NewsItem> {
  return first(await api.put<NewsItem[] | NewsItem>(`/admin/news/${id}`, toPayload(v)));
}

export async function setNewsPublish(id: number, status: number): Promise<NewsItem> {
  return first(await api.patch<NewsItem[] | NewsItem>(`/admin/news/${id}/publish`, { status }));
}

export function deleteNews(id: number): Promise<unknown> {
  return api.delete(`/admin/news/${id}`);
}

/* ---------------- Approval workflow (maker–checker) ---------------- */

/** Maker mengajukan berita. Wajib scope: salah satu branch_id ATAU regional_id. */
export async function submitNews(
  id: number,
  body: { branch_id?: number; regional_id?: number; note?: string }
): Promise<NewsItem> {
  return first(await api.patch<NewsItem[] | NewsItem>(`/admin/news/${id}/submit`, body));
}

/** Checker menyetujui berita (pending → published, tampil di mobile). */
export async function approveNews(id: number): Promise<NewsItem> {
  return first(await api.patch<NewsItem[] | NewsItem>(`/admin/news/${id}/approve`, {}));
}

/** Checker menolak berita (pending → rejected). Catatan wajib. */
export async function rejectNews(id: number, note: string): Promise<NewsItem> {
  return first(await api.patch<NewsItem[] | NewsItem>(`/admin/news/${id}/reject`, { note }));
}

export { buildQuery, paged };
export type { PaginationMeta };
