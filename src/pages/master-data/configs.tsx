import { StatusPill } from "@/components/ui";
import type { EntityConfig } from "@/components/data-table/types";
import type { MasterRow } from "@/types/masterData";

/** Pill Aktif/Nonaktif dari nilai 1/0. */
function activePill(row: MasterRow, key = "is_active") {
  const on = Number(row[key]) === 1;
  return <StatusPill label={on ? "Aktif" : "Nonaktif"} tone={on ? "green" : "gray"} dot />;
}

function coord(row: MasterRow, latKey: string, lonKey: string): string {
  const lat = row[latKey];
  const lon = row[lonKey];
  return lat != null && lon != null && lat !== "" && lon !== "" ? `${lat}, ${lon}` : "—";
}

/* ======================= Data Induk ======================= */

export const ruasConfig: EntityConfig = {
  key: "ruas",
  title: "Ruas",
  subtitle: "Master ruas tol (cabang). Tulis/hapus khusus super admin.",
  icon: "route",
  endpoint: "/admin/ruas",
  moduleCode: "ruas",
  superAdminWrite: true,
  searchable: true,
  titleKey: "branch_name",
  gridCols: "1.6fr 1fr 1fr 0.8fr",
  columns: [
    { key: "branch_name", label: "Ruas", sub: (r) => String(r.branch_code ?? "—") },
    { key: "regional_name", label: "Regional" },
    { key: "no_tarif", label: "No. Tarif", mono: true },
    { key: "is_active", label: "Status", render: (r) => activePill(r), align: "start" }
  ],
  formFields: [
    { name: "branch_code", label: "Kode Ruas", required: true, placeholder: "mis. JOR-S" },
    { name: "branch_name", label: "Nama Ruas", required: true, placeholder: "mis. Jakarta Outer Ring Road" },
    { name: "regional_id", label: "Regional ID", type: "number", placeholder: "opsional" },
    { name: "no_tarif", label: "No. Tarif", placeholder: "opsional" },
    { name: "tarif_date", label: "Tanggal Tarif", placeholder: "YYYY-MM-DD" },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

export const gerbangConfig: EntityConfig = {
  key: "gerbang",
  title: "Gerbang",
  subtitle: "Master gerbang tol per ruas.",
  icon: "door-open",
  endpoint: "/admin/gerbang",
  moduleCode: "gerbang",
  branchFilter: true,
  searchable: true,
  titleKey: "gate_name",
  gridCols: "1.4fr 1.2fr 1.2fr 0.8fr",
  columns: [
    { key: "gate_name", label: "Gerbang", sub: (r) => String(r.gate_code ?? "—") },
    { key: "branch_name", label: "Ruas" },
    { key: "regional_name", label: "Regional" },
    { key: "is_active", label: "Status", render: (r) => activePill(r) }
  ],
  formFields: [
    { name: "branch_id", label: "Ruas", branch: true, required: true },
    { name: "regional_id", label: "Regional ID", type: "number", help: "Harus cocok dengan ruas." },
    { name: "gate_code", label: "Kode Gerbang", required: true },
    { name: "gate_name", label: "Nama Gerbang", required: true },
    { name: "gate_lat", label: "Latitude", placeholder: "-6.xxxx" },
    { name: "gate_lon", label: "Longitude", placeholder: "106.xxxx" },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

export const kameraConfig: EntityConfig = {
  key: "kamera",
  title: "Kamera",
  subtitle: "Master kamera CCTV (list berpaginasi server).",
  icon: "cctv",
  endpoint: "/admin/cameras",
  moduleCode: "kamera",
  shape: "camera",
  searchable: true,
  titleKey: "cctv_name",
  gridCols: "1.6fr 1.2fr 0.8fr 0.8fr",
  columns: [
    { key: "cctv_name", label: "Kamera", sub: (r) => String(r.branch_name ?? r.branch_code ?? "—") },
    { key: "cctv_url", label: "URL", mono: true },
    { key: "is_active", label: "Aktif", render: (r) => activePill(r) },
    { key: "is_active_web", label: "Web", render: (r) => activePill(r, "is_active_web") }
  ],
  formFields: [
    { name: "branch_id", label: "Ruas", branch: true, required: true },
    { name: "cctv_name", label: "Nama Kamera", required: true },
    { name: "cctv_url", label: "URL Stream", full: true, help: "Jika kosong, backend mengisi dari env.", placeholder: "rtsp:// atau https://" },
    { name: "cctv_desc", label: "Deskripsi", full: true },
    { name: "antmedia_id", label: "AntMedia ID" },
    { name: "antmedia_url", label: "AntMedia URL" },
    { name: "cctv_lat", label: "Latitude" },
    { name: "cctv_lon", label: "Longitude" },
    { name: "is_active", label: "Aktif", type: "switch", defaultValue: "1" },
    { name: "is_active_web", label: "Tampil di Web", type: "switch", defaultValue: "1" }
  ]
};

/* VMS / FO / Rakom — satu bentuk (m_alat_elektronik), beda kategori/modul. */
function alatConfig(over: Partial<EntityConfig> & Pick<EntityConfig, "key" | "title" | "endpoint" | "moduleCode" | "icon">): EntityConfig {
  return {
    branchFilter: true,
    searchable: true,
    titleKey: "asset_name",
    gridCols: "1.6fr 1.2fr 0.9fr 0.7fr",
    columns: [
      { key: "asset_name", label: "Nama Alat", sub: (r) => String(r.branch_name ?? "—") },
      { key: "ip", label: "IP / URL", mono: true, render: (r) => String(r.ip ?? r.url ?? "—") },
      { key: "latitude", label: "Koordinat", render: (r) => coord(r, "latitude", "longitude") },
      { key: "status", label: "Status", render: (r) => activePill(r, "status") }
    ],
    formFields: [
      { name: "branch_id", label: "Ruas", branch: true, required: true },
      { name: "asset_name", label: "Nama Alat", required: true },
      { name: "description", label: "Deskripsi", full: true },
      { name: "ip", label: "IP" },
      { name: "url", label: "URL" },
      { name: "latitude", label: "Latitude" },
      { name: "longitude", label: "Longitude" },
      { name: "status", label: "Status Aktif", type: "switch", defaultValue: "1" }
    ],
    ...over
  } as EntityConfig;
}

export const vmsConfig = alatConfig({ key: "vms", title: "VMS", subtitle: "Variable Message Sign per ruas.", endpoint: "/admin/vms", moduleCode: "vms", icon: "monitor" });
export const foConfig = alatConfig({ key: "fo", title: "FO", subtitle: "Perangkat Fiber Optic. Berbagi akses modul dengan Jaringan.", endpoint: "/admin/fo", moduleCode: "fo", icon: "cable" });
export const rakomConfig = alatConfig({ key: "rakom", title: "Rakom", subtitle: "Radio komunikasi (modul `rakom` tersendiri).", endpoint: "/admin/rakom", moduleCode: "rakom", icon: "radio" });

export const cuacaConfig: EntityConfig = {
  key: "cuaca",
  title: "Titik Cuaca",
  subtitle: "Titik pemantauan cuaca per ruas.",
  icon: "cloud-sun",
  endpoint: "/admin/weather-points",
  moduleCode: "cuaca",
  branchFilter: true,
  searchable: true,
  titleKey: "point_name",
  gridCols: "1.4fr 1.2fr 1.2fr 0.7fr",
  columns: [
    { key: "point_name", label: "Titik", sub: (r) => String(r.point_code ?? "—") },
    { key: "branch_name", label: "Ruas" },
    { key: "latitude", label: "Koordinat", render: (r) => coord(r, "latitude", "longitude") },
    { key: "is_active", label: "Status", render: (r) => activePill(r) }
  ],
  formFields: [
    { name: "branch_id", label: "Ruas", branch: true, required: true },
    { name: "point_code", label: "Kode Titik", required: true },
    { name: "point_name", label: "Nama Titik", required: true },
    { name: "latitude", label: "Latitude", required: true },
    { name: "longitude", label: "Longitude", required: true },
    { name: "corridor_name", label: "Koridor" },
    { name: "segment_name", label: "Segmen" },
    { name: "display_order", label: "Urutan", type: "number", defaultValue: "0" },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

/* ======================= Jaringan (gated `fo`) ======================= */

const NODE_TYPES = [
  { value: "gate", label: "Gerbang" },
  { value: "branch_office", label: "Kantor Cabang" },
  { value: "head_office", label: "Kantor Pusat" },
  { value: "custom", label: "Custom" }
];

export const networkNodeConfig: EntityConfig = {
  key: "network-nodes",
  title: "Node Jaringan",
  subtitle: "Titik simpul jaringan (berbagi modul `fo`).",
  icon: "circle-dot",
  endpoint: "/admin/network/nodes",
  moduleCode: "fo",
  branchFilter: true,
  searchable: true,
  titleKey: "node_name",
  gridCols: "1.4fr 1fr 1.2fr 0.7fr",
  columns: [
    { key: "node_name", label: "Node", sub: (r) => String(r.node_code ?? "—") },
    { key: "node_type", label: "Tipe" },
    { key: "latitude", label: "Koordinat", render: (r) => coord(r, "latitude", "longitude") },
    { key: "is_active", label: "Status", render: (r) => activePill(r) }
  ],
  formFields: [
    { name: "node_code", label: "Kode Node", required: true },
    { name: "node_name", label: "Nama Node", required: true },
    { name: "node_type", label: "Tipe Node", type: "select", options: NODE_TYPES, required: true },
    { name: "branch_id", label: "Ruas", branch: true },
    { name: "gate_id", label: "Gate ID", type: "number" },
    { name: "latitude", label: "Latitude" },
    { name: "longitude", label: "Longitude" },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

const CONN_TYPES = [
  { value: "fiber", label: "Fiber" },
  { value: "logical", label: "Logical" },
  { value: "backup", label: "Backup" }
];
const EDGE_STATUS = [
  { value: "normal", label: "Normal" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "inactive", label: "Inactive" }
];

export const networkEdgeConfig: EntityConfig = {
  key: "network-edges",
  title: "Edge Jaringan",
  subtitle: "Koneksi antar-node (auto-scoped dari node; non-super admin: satu ruas).",
  icon: "spline",
  endpoint: "/admin/network/edges",
  moduleCode: "fo",
  searchable: true,
  titleKey: "edge_name",
  gridCols: "1.4fr 1fr 1fr 0.8fr",
  columns: [
    { key: "edge_name", label: "Edge", sub: (r) => String(r.edge_code ?? "—") },
    { key: "connection_type", label: "Tipe" },
    { key: "bandwidth_label", label: "Bandwidth" },
    { key: "status", label: "Status", render: (r) => <StatusPill label={String(r.status ?? "—")} tone={r.status === "normal" ? "green" : r.status === "warning" ? "amber" : r.status === "error" ? "red" : "gray"} dot /> }
  ],
  formFields: [
    { name: "edge_code", label: "Kode Edge", required: true },
    { name: "edge_name", label: "Nama Edge", required: true },
    { name: "source_node_id", label: "Source Node ID", type: "number", required: true },
    { name: "target_node_id", label: "Target Node ID", type: "number", required: true },
    { name: "connection_type", label: "Tipe Koneksi", type: "select", options: CONN_TYPES, defaultValue: "fiber" },
    { name: "status", label: "Status", type: "select", options: EDGE_STATUS, defaultValue: "normal" },
    { name: "bandwidth_label", label: "Label Bandwidth" },
    { name: "distance_km", label: "Jarak (km)", type: "number" },
    { name: "display_order", label: "Urutan", type: "number", defaultValue: "0" },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

/* ======================= WIM Sites ======================= */

export const wimSiteConfig: EntityConfig = {
  key: "wim-sites",
  title: "WIM Site",
  subtitle: "Inventaris perangkat Weigh-in-Motion.",
  icon: "scale",
  endpoint: "/admin/wim-sites",
  moduleCode: "wim",
  branchFilter: true,
  searchable: true,
  titleKey: "site_name",
  note: "Kredensial situs WIM bersifat sensitif — password hanya ditampilkan ter-mask di form.",
  gridCols: "1.4fr 1.2fr 1.4fr 0.7fr",
  columns: [
    { key: "site_name", label: "Site", sub: (r) => String(r.site_code ?? "—") },
    { key: "branch_name", label: "Ruas" },
    { key: "base_url", label: "Base URL", mono: true },
    { key: "is_active", label: "Status", render: (r) => activePill(r) }
  ],
  formFields: [
    { name: "site_code", label: "Kode Site", required: true },
    { name: "site_name", label: "Nama Site", required: true },
    { name: "base_url", label: "Base URL", full: true, required: true, placeholder: "https://…" },
    { name: "dashboard_url", label: "Dashboard URL", full: true },
    { name: "branch_id", label: "Ruas", branch: true },
    { name: "username", label: "Username" },
    { name: "password", label: "Password", type: "password", help: "Dikirim apa adanya ke backend. Kosongkan bila tak diubah." },
    { name: "is_active", label: "Status Aktif", type: "switch", defaultValue: "1" }
  ]
};

export const MASTER_DATA_CONFIGS: EntityConfig[] = [
  ruasConfig, gerbangConfig, kameraConfig, vmsConfig, cuacaConfig, foConfig, rakomConfig
];
export const NETWORK_CONFIGS = { nodes: networkNodeConfig, edges: networkEdgeConfig };
