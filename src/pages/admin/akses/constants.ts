import type { AccessLevel } from "@/types/access";

export interface LevelDef {
  key: AccessLevel;
  label: string;
  icon: string;
  tone: "gray" | "blue" | "amber" | "red";
}

/** Urutan & metadata level akses (none/read/write/delete). */
export const LEVELS: LevelDef[] = [
  { key: "none", label: "Tidak ada", icon: "minus", tone: "gray" },
  { key: "read", label: "Lihat", icon: "eye", tone: "blue" },
  { key: "write", label: "Ubah", icon: "pencil", tone: "amber" },
  { key: "delete", label: "Hapus", icon: "trash-2", tone: "red" }
];

export const RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2, delete: 3 };

export function levelMeta(level: AccessLevel): LevelDef {
  return LEVELS.find((l) => l.key === level) ?? LEVELS[0];
}

/** Ikon Lucide per role_code (backend tak menyimpan ikon). */
const ROLE_ICON: Record<string, string> = {
  super_admin: "shield-check",
  branch_admin: "shield",
  operator_cctv: "cctv",
  operator_asset: "boxes",
  operator_sos: "siren",
  viewer_branch: "eye",
  manajemen: "chart-column"
};

export function roleIcon(code: string): string {
  return ROLE_ICON[code] || "shield";
}

/** Pola kode yang diterima backend untuk role/permission/module. */
export const CODE_PATTERN = /^[a-z0-9_.]+$/;

/** Kelompokkan item (permission/module) per field grup, menjaga urutan kemunculan. */
export function groupBy<T>(items: T[], keyOf: (item: T) => string | null): { group: string; items: T[] }[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item) || "lainnya";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}
