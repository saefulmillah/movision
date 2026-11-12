/* Tipe WIM Monitoring (/api/admin/wim-monitor/*). Envelope: { data, meta }. */

export interface WimSummary {
  total?: number;
  healthy?: number;
  online?: number;
  offline?: number;
  warning?: number;
  error?: number;
  no_data?: number;
  [key: string]: unknown;
}

export interface WimSiteStatus {
  site_code: string;
  site_name?: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  status?: string | null;
  has_daily_data?: boolean | number | null;
  last_data_at?: string | null;
  health_score?: number | null;
  [key: string]: unknown;
}

export interface WimMeta {
  branch_id?: number;
  total?: number;
  [key: string]: unknown;
}
