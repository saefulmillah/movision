/* Tipe WIM Monitoring (/api/admin/wim-monitor/*). Envelope: { data, meta }. */

export interface WimSummary {
  total_sites: number;
  online_sites: number;
  warning_sites: number;
  offline_sites: number;
  unknown_sites: number;
  sites_with_data: number;
  sites_without_data: number;
  total_devices: number;
  total_devices_online: number;
  total_devices_offline: number;
  total_devices_warning: number;
  monitor_date?: string | null;
  refresh_interval_ms?: number;
  [key: string]: unknown;
}

export type WimDeviceStatus = "online" | "warning" | "offline" | "unknown";

/* Heatmap Kesehatan Site × Hari (/api/admin/wim-monitor/heatmap). */
export type WimHeatmapStatus = "ok" | "warning" | "critical" | "kosong";

export interface WimHeatmapDay {
  date: string;
  status: WimHeatmapStatus;
  device_status: WimDeviceStatus | null;
  device_total: number;
  device_online: number;
  device_offline: number;
  device_warning: number;
  has_daily_data: boolean;
  daily_data_count: number;
  last_error_message: string | null;
}

export interface WimHeatmapRow {
  site_code: string;
  site_name: string;
  branch_id: number | null;
  branch_name: string | null;
  availability_pct: number;
  days: WimHeatmapDay[];
}

export interface WimDeviceItem {
  id: string;
  name: string;
  type: string | null;
  status: string;
}

export interface WimMonitorLog {
  check_type: string;
  request_url: string | null;
  http_status: number | null;
  is_success: boolean;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

export interface WimSiteStatus {
  id: number;
  site_code: string;
  site_name: string;
  branch_id: number | null;
  branch_code: string | null;
  branch_name: string | null;
  base_url?: string | null;
  monitor_date?: string | null;
  device_status: WimDeviceStatus;
  device_total: number;
  device_online: number;
  device_offline: number;
  device_warning: number;
  has_daily_data: boolean;
  daily_data_count: number;
  last_device_check_at: string | null;
  last_data_check_at: string | null;
  last_success_at: string | null;
  last_error_message: string | null;
  [key: string]: unknown;
}

/** Detail satu site (GET /sites/:code) — WimSiteStatus + perangkat & log. */
export interface WimSiteDetail extends WimSiteStatus {
  devices?: WimDeviceItem[];
  logs?: WimMonitorLog[];
}
