import { api } from "@/lib/api";
import { buildQuery } from "@/lib/news";
import type { WimSiteStatus, WimSummary } from "@/types/wim";

/* WIM Monitoring — read-only + refresh manual. Semua endpoint ringkasan wajib `branch_id`. */

export function fetchWimSummary(branchId: number): Promise<WimSummary> {
  return api.get<WimSummary>(`/admin/wim-monitor/summary${buildQuery({ branch_id: branchId })}`);
}

export function fetchWimSummaryTrend(branchId: number, days = 30): Promise<unknown> {
  return api.get<unknown>(`/admin/wim-monitor/summary-trend${buildQuery({ branch_id: branchId, days })}`);
}

export function fetchWimHeatmap(branchId: number, days = 30): Promise<unknown> {
  return api.get<unknown>(`/admin/wim-monitor/heatmap${buildQuery({ branch_id: branchId, days })}`);
}

export interface WimSitesParams {
  branch_id: number;
  status?: string;
  has_daily_data?: string;
  search?: string;
}

export function fetchWimSites(params: WimSitesParams): Promise<WimSiteStatus[]> {
  return api.get<WimSiteStatus[]>(`/admin/wim-monitor/sites${buildQuery(params)}`);
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
