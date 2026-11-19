/* ============================================================
   Klien API Dashboard Manajemen (GET /api/dashboard/management-summary).
   Bearer ditangani api.ts; envelope { status, message, data } dibongkar jadi `data`.

   Gate backend: module `dashboard` (READ) — sama seperti menu dashboard.
   ============================================================ */

import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type { ManagementSummary } from "@/types/dashboardManajemen";

export interface ManagementSummaryParams {
  /** YYYY-MM-DD; default backend 7 hari terakhir (WIB). */
  start_date?: string;
  end_date?: string;
  /** Target SLA response (menit); default backend 15. */
  sla_response_minutes?: number;
}

export function getManagementSummary(params: ManagementSummaryParams): Promise<ManagementSummary> {
  return api.get<ManagementSummary>(`/dashboard/management-summary${buildQuery(params)}`);
}
