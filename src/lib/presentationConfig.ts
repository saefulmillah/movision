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
  updated_by: number | null;
  updated_at: string | null;
}

export function getAgenda(): Promise<AgendaResponse> {
  return api.get<AgendaResponse>("/presentation-agenda");
}

export function saveAgenda(config: PresentationConfig): Promise<AgendaResponse> {
  return api.put<AgendaResponse>("/presentation-agenda", { config });
}
