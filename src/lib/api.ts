/* ============================================================
   Klien HTTP untuk backend cctv-backend.

   - Menyisipkan bearer token pada tiap permintaan.
   - Membongkar envelope { status, message, data } → mengembalikan data.
   - 401 → membersihkan sesi & memancarkan event "auth:unauthorized"
     (ditangkap AuthContext untuk redirect ke /login).
   - 403 / 400 dilempar sebagai ApiError berisi status + payload.
   ============================================================ */

import type { ApiEnvelope } from "@/types/api";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

// Origin backend untuk aset statis (mis. /static/vehicle-types/*.svg dari payload).
const BACKEND_URL = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_PROXY_TARGET as string | undefined) ||
  ""
).replace(/\/$/, "");

/** Bangun URL absolut aset backend dari path relatif payload (mis. icon_path). */
export function backendAsset(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const TOKEN_KEY = "tollsentra.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** Dipancarkan saat backend menjawab 401 agar shell bisa logout + redirect. */
export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

function emitUnauthorized(): void {
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set false untuk permintaan tanpa bearer (mis. login). */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });

  if (res.status === 401) {
    setToken(null);
    emitUnauthorized();
    throw new ApiError(401, "Sesi berakhir. Silakan masuk kembali.");
  }

  let json: ApiEnvelope<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const message = json?.message || `Permintaan gagal (${res.status})`;
    throw new ApiError(res.status, message, json?.data ?? null);
  }

  // Envelope { status, message, data } → kembalikan data.
  return (json ? json.data : (undefined as unknown)) as T;
}

/** Meta paginasi sibling pada envelope list (backend modul News/Incident/Feedback). */
export interface PaginationMeta {
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface WithMeta<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * Seperti request GET, tetapi mengembalikan { data, meta } penuh agar
 * `meta.pagination` dari list berpaginasi-server bisa dibaca (api.get biasa
 * hanya mengembalikan `data`).
 */
async function requestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<WithMeta<T>> {
  const { auth = true, headers, body: _body, ...rest } = options;
  void _body;
  const finalHeaders = new Headers(headers);
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...rest, method: "GET", headers: finalHeaders });

  if (res.status === 401) {
    setToken(null);
    emitUnauthorized();
    throw new ApiError(401, "Sesi berakhir. Silakan masuk kembali.");
  }

  let json: (ApiEnvelope<T> & { meta?: PaginationMeta }) | null = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const message = json?.message || `Permintaan gagal (${res.status})`;
    throw new ApiError(res.status, message, json?.data ?? null);
  }

  return { data: (json ? json.data : undefined) as T, meta: json?.meta };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  getWithMeta: <T>(path: string, options?: RequestOptions) => requestWithMeta<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" })
};

export { BASE_URL };
