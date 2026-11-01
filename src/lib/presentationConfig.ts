/* ============================================================
   Agenda presentasi BERSAMA — klien API.
   Konfigurasi builder (urutan/aktif/judul/subjudul/sampul kustom/periode/
   field rapat) disimpan di server agar semua user melihat deck yang sama.
   localStorage tetap dipakai sebagai cache per-browser.
   ============================================================ */
import { api } from "@/lib/api";

export interface PresentationConfig {
  order: string[];
  enabled: Record<string, boolean>;
  period: string;
  meetingTitle: string;
  meetingSubtitle: string;
  meetingDate: string;
  titles: Record<string, string>;
  subtitles: Record<string, string>;
  auto: boolean;
  autoSec: number;
}

export interface AgendaResponse {
  config: PresentationConfig | null;
  /** true bila scope ini memakai override sendiri (bukan bawaan divisi). */
  isOverride?: boolean;
  scope?: string;
  updated_by: number | null;
  updated_at: string | null;
}

function scopeQuery(scope?: string | null): string {
  return scope && scope !== "divisi" ? `?scope=${encodeURIComponent(scope)}` : "";
}

/** Agenda efektif untuk sebuah scope (override scope bila ada, jika tidak bawaan divisi). */
export function getAgenda(scope?: string | null): Promise<AgendaResponse> {
  return api.get<AgendaResponse>(`/presentation-agenda${scopeQuery(scope)}`);
}

/** Simpan agenda untuk scope aktif. Divisi → bawaan (base); lainnya → override scope. */
export function saveAgenda(scope: string | null, config: PresentationConfig): Promise<AgendaResponse> {
  return api.put<AgendaResponse>(`/presentation-agenda${scopeQuery(scope)}`, { config });
}

/** Hapus override sebuah scope → kembali ke bawaan divisi. */
export function resetAgenda(scope: string): Promise<AgendaResponse> {
  return api.delete<AgendaResponse>(`/presentation-agenda?scope=${encodeURIComponent(scope)}`);
}
