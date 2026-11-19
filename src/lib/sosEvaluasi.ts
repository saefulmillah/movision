/* ============================================================
   Klien API Evaluasi SOS (/api/sos-tickets/*). Bearer ditangani api.ts.

   Gate backend: permission `sos.ticket.view`.
   Envelope sukses endpoint ini: { status, message, data, meta? }.
   - /summary → `data` objek ringkasan (api.get membongkar `data`).
   - /history → `data` array + `meta` paginasi flat (dibaca via getWithMeta).
   ============================================================ */

import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type {
  SosEvalStatus,
  SosHistoryMeta,
  SosHistoryResult,
  SosHistoryRow,
  SosSummary
} from "@/types/sosEvaluasi";
import { SOS_STATUS_CODE } from "@/types/sosEvaluasi";

/* ---------------- Ringkasan (A–C) ---------------- */

export interface SosSummaryParams {
  start_date?: string;
  end_date?: string;
  /** Target SLA response (menit); default backend 15. */
  sla_response_minutes?: number;
}

export function getSosSummary(params: SosSummaryParams): Promise<SosSummary> {
  return api.get<SosSummary>(`/sos-tickets/summary${buildQuery(params)}`);
}

/* ---------------- Riwayat tiket (D) ---------------- */

export interface SosHistoryParams {
  start_date?: string;
  end_date?: string;
  /** Kode angka status (1/2/3) — gunakan statusCode() dari string. */
  status?: number;
  incident_type?: string;
  id_ruas?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/** String status → kode angka query (1=dispatched, 3=in_handling, 2=completed). */
export function statusCode(status: SosEvalStatus): number {
  return SOS_STATUS_CODE[status];
}

export async function getSosHistory(params: SosHistoryParams): Promise<SosHistoryResult> {
  const { data, meta } = await api.getWithMeta<SosHistoryRow[]>(`/sos-tickets/history${buildQuery(params)}`);
  // Meta /history flat ({ page, limit, total, total_page }), bukan { pagination }.
  return { rows: data ?? [], meta: (meta as unknown as SosHistoryMeta) ?? null };
}
