/* Tipe data layar operasi (Dashboard, Peta, SOS). */

export interface MonitoringSummary {
  branches: { active: number; total: number };
  cctv: { online: number; offline: number; total: number };
  vms: { online: number; offline: number; total: number };
  sos: { open: number };
  vehicles: { total: number; live: number; moving: number };
  gates: { alerts: number; error: number; warning: number; offline: number };
}

export type AssetStatus = "normal" | "warning" | "error" | "offline" | string;

export interface Branch {
  id: number;
  branch_code: string;
  branch_name: string;
  center_lat: number;
  center_lng: number;
}

export interface GateAlert {
  gate_id: number;
  gate_code: string;
  gate_name: string;
  branch_id: number;
  lat: number;
  lng: number;
  status: AssetStatus;
  severity: string;
  pulse?: boolean;
  device_summary?: {
    total: number;
    normal: number;
    warning: number;
    error: number;
    offline: number;
  };
  last_event_at?: string | null;
}

export interface MapAsset {
  id: number;
  asset_type: "cctv" | "vms" | string;
  asset_code: string;
  asset_name: string;
  branch_id: number;
  lat: number;
  lng: number;
  status: AssetStatus;
  is_online: boolean;
  has_live_stream?: boolean;
  stream_play_url?: string | null;
}

export interface SosTicket {
  ticket_no: string;
  status: number | string;
  status_label?: string;
  incident_type?: string;
  sos?: {
    branch_id?: number;
    branch_name?: string;
    location?: string;
    lat?: number;
    lng?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
