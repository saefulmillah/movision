/* ============================================================
   Tipe entitas master data admin (/api/admin/...).
   Field "branch_" dan "regional_" adalah read-only hasil join —
   jangan dikirim saat create/update (cukup branch_id).
   ============================================================ */

export type MasterRow = Record<string, unknown> & { id: number };

export interface RuasRow extends MasterRow {
  branch_code: string;
  branch_name: string;
  is_active: number;
  regional_id: number | null;
  regional_code: string | null;
  regional_name: string | null;
  no_tarif: string | null;
  tarif_date: string | null;
  created_at: string | null;
}

export interface GerbangRow extends MasterRow {
  gate_code: string;
  gate_name: string;
  branch_id: number;
  branch_code: string | null;
  branch_name: string | null;
  regional_id: number | null;
  regional_code: string | null;
  regional_name: string | null;
  gate_lat: number | null;
  gate_lon: number | null;
  is_active: number;
}

export interface CameraRow extends MasterRow {
  cctv_name: string;
  cctv_desc: string | null;
  cctv_url: string | null;
  antmedia_id: string | null;
  antmedia_url: string | null;
  cctv_lat: number | null;
  cctv_lon: number | null;
  branch_id: number;
  branch_code: string | null;
  branch_name: string | null;
  sort: number | null;
  is_active: number;
  is_active_web: number;
  is_external: number;
  information: string | null;
  is_hide: number;
  created_at: string | null;
  created_by: string | null;
}

/** VMS / FO / Rakom berbagi bentuk tabel m_alat_elektronik. */
export interface AlatRow extends MasterRow {
  branch_id: number;
  branch_code: string | null;
  branch_name: string | null;
  category: string | null;
  asset_name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: number;
  ip: string | null;
  url: string | null;
  update_at: string | null;
}

export interface WeatherPointRow extends MasterRow {
  point_code: string;
  point_name: string;
  branch_id: number | null;
  branch_code: string | null;
  branch_name: string | null;
  corridor_name: string | null;
  segment_name: string | null;
  latitude: number;
  longitude: number;
  marker_lat: number | null;
  marker_lng: number | null;
  display_order: number;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface NetworkNodeRow extends MasterRow {
  node_code: string;
  node_name: string;
  node_type: "gate" | "branch_office" | "head_office" | "custom";
  branch_id: number | null;
  gate_id: number | null;
  latitude: number | null;
  longitude: number | null;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface NetworkEdgeRow extends MasterRow {
  edge_code: string;
  edge_name: string;
  source_node_id: number;
  target_node_id: number;
  connection_type: "fiber" | "logical" | "backup";
  status: "normal" | "warning" | "error" | "inactive";
  bandwidth_label: string | null;
  distance_km: number | null;
  display_order: number;
  is_active: number;
  source_branch_id: number | null;
  target_branch_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WimSiteRow extends MasterRow {
  site_code: string;
  site_name: string;
  branch_id: number | null;
  branch_code: string | null;
  branch_name: string | null;
  base_url: string;
  dashboard_url: string | null;
  username: string | null;
  /** ⚠️ plaintext dari backend — mask di UI, jangan tampilkan di tabel/log. */
  password: string | null;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
}
