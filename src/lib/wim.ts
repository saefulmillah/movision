import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type { WimSiteStatus, WimSummary } from "@/types/wim";

/* WIM Monitoring — read-only + refresh manual. `branch_id` opsional (kosong = semua ruas). */

export function fetchWimSummary(branchId?: number | null): Promise<WimSummary> {
  return api.get<WimSummary>(`/admin/wim-monitor/summary${buildQuery({ branch_id: branchId ?? undefined })}`);
}

export function fetchWimSummaryTrend(branchId?: number | null, days = 30): Promise<unknown> {
  return api.get<unknown>(`/admin/wim-monitor/summary-trend${buildQuery({ branch_id: branchId ?? undefined, days })}`);
}

export function fetchWimHeatmap(branchId?: number | null, days = 30): Promise<unknown> {
  return api.get<unknown>(`/admin/wim-monitor/heatmap${buildQuery({ branch_id: branchId ?? undefined, days })}`);
}

export interface WimSitesParams {
  branch_id?: number | null;
  status?: string;
  has_daily_data?: string;
  search?: string;
}

export function fetchWimSites(params: WimSitesParams = {}): Promise<WimSiteStatus[]> {
  return api.get<WimSiteStatus[]>(`/admin/wim-monitor/sites${buildQuery({ ...params, branch_id: params.branch_id ?? undefined })}`);
}

export function fetchWimSite(siteCode: string): Promise<WimSiteStatus> {
  return api.get<WimSiteStatus>(`/admin/wim-monitor/sites/${encodeURIComponent(siteCode)}`);
}

export function fetchWimSiteTrend(siteCode: string, days = 30): Promise<unknown> {
  return api.get<unknown>(`/admin/wim-monitor/sites/${encodeURIComponent(siteCode)}/trend${buildQuery({ days })}`);
}

/** Refresh manual (super_admin/admin/superuser). */
export function refreshWim(): Promise<unknown> {
  return api.post<unknown>("/admin/wim-monitor/refresh", {});
}
