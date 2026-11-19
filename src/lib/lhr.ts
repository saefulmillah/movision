/* ============================================================
   Klien API modul LHR Tertimbang (/api/admin/lhr/*).

   Semua endpoint butuh Bearer (ditangani api.ts). Envelope sukses
   { data, meta }; endpoint berpaginasi-ringkasan memakai getWithMeta
   agar `meta` ringkasan (bukan pagination) ikut terbaca.
   ============================================================ */

import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type {
  LhrIngestResult,
  LhrKelengkapanMeta,
  LhrKelengkapanResult,
  LhrKelengkapanRow,
  LhrKoridor,
  LhrMeta,
  LhrOdCommitResult,
  LhrOdPreviewResult,
  LhrOdSession,
  LhrRow,
  LhrShiftMeta,
  LhrShiftResult,
  LhrShiftRow,
  LhrTertimbangResult
} from "@/types/lhr";

export const GOLONGAN = [1, 2, 3, 4, 5] as const;
export const GOLONGAN_LABEL: Record<number, string> = {
  1: "Golongan I", 2: "Golongan II", 3: "Golongan III", 4: "Golongan IV", 5: "Golongan V"
};
export const GOL_SHORT: Record<number, string> = { 1: "Gol I", 2: "Gol II", 3: "Gol III", 4: "Gol IV", 5: "Gol V" };

/* ---------------- Koridor ---------------- */

export function listKoridor(): Promise<LhrKoridor[]> {
  return api.get<LhrKoridor[]>("/admin/lhr/koridor");
}

/* ---------------- Hasil LHR (A) ---------------- */

export interface LhrRangeParams {
  kode_koridor: string;
  start_date?: string;
  end_date?: string;
  /** alternatif rentang: satu tanggal tunggal. */
  tanggal?: string;
}

export async function getLhrTertimbang(params: LhrRangeParams): Promise<LhrTertimbangResult> {
  const { data, meta } = await api.getWithMeta<LhrRow[]>(`/admin/lhr/tertimbang${buildQuery(params)}`);
  return { rows: data ?? [], meta: (meta as unknown as LhrMeta) ?? null };
}

/* ---------------- Monitoring Kelengkapan (B) ---------------- */

export async function getLhrKelengkapan(params: LhrRangeParams): Promise<LhrKelengkapanResult> {
  const { data, meta } = await api.getWithMeta<LhrKelengkapanRow[]>(`/admin/lhr/kelengkapan${buildQuery(params)}`);
  return { rows: data ?? [], meta: (meta as unknown as LhrKelengkapanMeta) ?? null };
}

/** Breakdown per shift untuk satu gerbang (on-demand saat baris gerbang dipilih). */
export async function getLhrKelengkapanShift(
  params: { kode_koridor: string; kode_gerbang: string; start_date?: string; end_date?: string }
): Promise<LhrShiftResult> {
  const { data, meta } = await api.getWithMeta<LhrShiftRow[]>(`/admin/lhr/kelengkapan/shift${buildQuery(params)}`);
  return { rows: data ?? [], meta: (meta as unknown as LhrShiftMeta) ?? null };
}

/* ---------------- Ingest otomatis (C) ---------------- */

export function ingestLhr(body: { kode_koridor: string; start_date?: string; end_date?: string; tanggal?: string }): Promise<LhrIngestResult> {
  return api.post<LhrIngestResult>("/admin/lhr/ingest", body);
}

/* ---------------- Upload AT6 manual (C) — preview → commit ---------------- */

/** Multipart: kirim banyak file .xls AT6 sekaligus. */
export function previewAt6(params: { kode_koridor: string; integrator?: string; files: File[] }): Promise<LhrOdPreviewResult> {
  const fd = new FormData();
  fd.append("kode_koridor", params.kode_koridor);
  if (params.integrator) fd.append("integrator", params.integrator);
  // Field name harus cocok dgn multer backend (.array("files")) — tanpa kurung siku,
  // kalau tidak backend membalas MulterError "Unexpected field".
  for (const f of params.files) fd.append("files", f);
  return api.post<LhrOdPreviewResult>("/admin/lhr/od/preview", fd);
}

export function commitAt6(importSessionId: string): Promise<LhrOdCommitResult> {
  return api.post<LhrOdCommitResult>("/admin/lhr/od/commit", { import_session_id: importSessionId });
}

export function getAt6Session(importSessionId: string): Promise<LhrOdSession> {
  return api.get<LhrOdSession>(`/admin/lhr/od/sessions/${encodeURIComponent(importSessionId)}`);
}
