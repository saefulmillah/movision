/* Katalog RBAC — di-hardcode di frontend (backend belum menyediakan endpoint
   master role/permission/module). Sinkron dengan constants/permissions.js backend. */

export interface RoleMeta {
  code: string;
  label: string;
  icon: string;
  description: string;
  permissions: string[];
}

export const ROLE_CATALOG: RoleMeta[] = [
  {
    code: "super_admin",
    label: "Super Admin",
    icon: "shield-check",
    description: "Akses penuh seluruh modul, seluruh ruas, dan manajemen pengguna.",
    permissions: [
      "feature.cctv.view", "feature.asset.view", "feature.sos.view", "branch.select", "branch.view.all",
      "branch.view.assigned", "camera.view", "asset.view", "vehicle.view", "gate.view", "sos.alert.view",
      "sos.ticket.view", "sos.response.view", "sos.ticket.dispatch", "sos.ticket.complete", "sos.response.confirm",
      "feature.laba_rugi.view", "feature.manajemen_risiko.view", "feature.pendapatan.view"
    ]
  },
  {
    code: "branch_admin",
    label: "Admin Ruas",
    icon: "shield",
    description: "Kelola aset dan data pada ruas yang ditugaskan.",
    permissions: [
      "feature.cctv.view", "feature.asset.view", "feature.sos.view", "branch.select", "branch.view.assigned",
      "camera.view", "asset.view", "vehicle.view", "gate.view", "sos.alert.view", "sos.response.view",
      "sos.ticket.view", "sos.ticket.dispatch", "sos.ticket.complete", "sos.response.confirm"
    ]
  },
  {
    code: "operator_cctv",
    label: "Operator CCTV",
    icon: "cctv",
    description: "Pemantauan dinding kamera per ruas.",
    permissions: ["feature.cctv.view", "branch.select", "branch.view.assigned", "camera.view"]
  },
  {
    code: "operator_asset",
    label: "Operator Aset",
    icon: "boxes",
    description: "Pemantauan peta aset dan status perangkat.",
    permissions: ["feature.asset.view", "branch.select", "branch.view.assigned", "asset.view", "vehicle.view", "gate.view"]
  },
  {
    code: "operator_sos",
    label: "Operator SOS",
    icon: "siren",
    description: "Penanganan tiket SOS dan smart response.",
    permissions: [
      "feature.sos.view", "branch.select", "branch.view.assigned", "vehicle.view", "sos.alert.view",
      "sos.response.view", "sos.ticket.view", "sos.ticket.dispatch", "sos.ticket.complete", "sos.response.confirm"
    ]
  },
  {
    code: "viewer_branch",
    label: "Pemantau Ruas",
    icon: "eye",
    description: "Akses baca ringkasan operasi ruas.",
    permissions: ["branch.select", "branch.view.assigned"]
  },
  {
    code: "manajemen",
    label: "Manajemen",
    icon: "chart-column",
    description: "Akses baca dashboard Rapat Direktorat (Laba Rugi, Manajemen Risiko & Pendapatan).",
    permissions: ["feature.laba_rugi.view", "feature.manajemen_risiko.view", "feature.pendapatan.view"]
  }
];

export function roleLabel(code: string): string {
  return ROLE_CATALOG.find((r) => r.code === code)?.label ?? code;
}

export const MODULE_CODES = [
  "ruas", "gerbang", "gerbang_alias", "segmen_gerbang", "od_gerbang", "tariff", "speed_analytics", "kamera",
  "vehicle", "vehicle_type", "wim", "vms", "fo", "rakom", "cuaca", "tariff_import", "monitoring_rekonsiliasi",
  "laba_rugi", "manajemen_risiko", "pendapatan"
];

export const PERMISSION_CODES = [
  "feature.cctv.view", "feature.asset.view", "feature.sos.view", "branch.select", "branch.view.all",
  "branch.view.assigned", "camera.view", "asset.view", "vehicle.view", "gate.view", "sos.alert.view",
  "sos.ticket.view", "sos.response.view", "sos.ticket.dispatch", "sos.ticket.complete", "sos.response.confirm",
  "feature.laba_rugi.view", "feature.manajemen_risiko.view", "feature.pendapatan.view"
];

export const ACCESS_LEVELS = ["none", "read", "write", "delete"] as const;
