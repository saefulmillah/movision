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
