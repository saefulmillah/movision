/* ============================================================
   Gambar sampul presentasi per scope — klien API + resolusi blob URL.
   Tiap scope presentasi (divisi/regional/cabang) punya gambar sampulnya
   sendiri (isolasi penuh, tanpa warisan). File di-serve backend lewat
   endpoint ber-auth; dipakai sebagai background slide sampul pembuka.
   ============================================================ */
import { api, BASE_URL, getToken } from "@/lib/api";

export interface CoverMeta {
  id: number;
  scope: string;
  slot: string;
  original_name: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

/** Slot default = sampul pembuka. Disiapkan agar bisa diperluas ke sampul lain. */
export const COVER_SLOT_TITLE = "title";

function query(scope?: string | null, slot: string = COVER_SLOT_TITLE): string {
  const params = new URLSearchParams();
  if (scope && scope !== "divisi") params.set("scope", scope);
  if (slot && slot !== COVER_SLOT_TITLE) params.set("slot", slot);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/** Metadata gambar sampul scope+slot (null bila belum ada). */
export function getCoverMeta(scope?: string | null, slot = COVER_SLOT_TITLE): Promise<CoverMeta | null> {
  return api.get<CoverMeta | null>(`/presentation-cover${query(scope, slot)}`);
}

export function uploadCover(file: File, scope?: string | null, slot = COVER_SLOT_TITLE): Promise<CoverMeta> {
  const fd = new FormData();
  fd.append("file", file);
  if (slot && slot !== COVER_SLOT_TITLE) fd.append("slot", slot);
  return api.post<CoverMeta>(`/presentation-cover${query(scope, slot)}`, fd);
}

export function deleteCover(id: number): Promise<unknown> {
  return api.delete(`/presentation-cover/${id}`);
}

// ---- Resolusi blob URL (ber-auth) + cache per scope::slot ----
const urlCache = new Map<string, Promise<string | null>>();

function cacheKey(scope: string | null | undefined, slot: string): string {
  return `${scope || "divisi"}::${slot}`;
}

async function fetchCoverBlob(id: number): Promise<string> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/presentation-cover/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(`Gagal memuat gambar sampul (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** URL blob gambar sampul scope+slot (null bila belum ada). Di-cache. */
export function resolveCoverUrl(scope: string | null, slot = COVER_SLOT_TITLE): Promise<string | null> {
  const key = cacheKey(scope, slot);
  let pr = urlCache.get(key);
  if (!pr) {
    pr = getCoverMeta(scope, slot)
      .then((meta) => (meta ? fetchCoverBlob(meta.id) : null))
      .catch(() => null);
    urlCache.set(key, pr);
  }
  return pr;
}

/** Buang cache (+revoke blob) agar di-fetch ulang setelah unggah/hapus. */
export function invalidateCoverUrl(scope: string | null, slot = COVER_SLOT_TITLE): void {
  const key = cacheKey(scope, slot);
  const pr = urlCache.get(key);
  if (pr) {
    void pr.then((url) => url && URL.revokeObjectURL(url)).catch(() => {});
    urlCache.delete(key);
  }
}
