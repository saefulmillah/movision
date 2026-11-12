import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

export interface ModuleAccess {
  level: string | null;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
}

const ORDER: Record<string, number> = { none: 0, read: 1, write: 2, delete: 3 };

interface Options {
  /** Bila true, tulis & hapus hanya untuk super_admin (mis. modul `ruas`). */
  superAdminWrite?: boolean;
}

/**
 * Sumber otorisasi = capability dari `GET /api/auth/me` (module_access + roles),
 * bukan nama role. Mengembalikan kemampuan efektif untuk satu module code.
 *
 * Gotcha: modul `ruas` memaksa super_admin untuk tulis/hapus di backend —
 * pass `{ superAdminWrite: true }` agar tombol tulis disembunyikan untuk non-super_admin.
 */
export function useModuleAccess(moduleCode: string, options: Options = {}): ModuleAccess {
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel(moduleCode);
  const isSuperAdmin = hasRole("super_admin");

  return useMemo(() => {
    const rank = level ? (ORDER[level] ?? 0) : 0;
    // super_admin diperlakukan sebagai akses penuh walau baris module_access belum ada.
    const effectiveRank = isSuperAdmin ? ORDER.delete : rank;
    const gate = options.superAdminWrite ? isSuperAdmin : true;
    return {
      level,
      canRead: effectiveRank >= ORDER.read,
      canWrite: effectiveRank >= ORDER.write && gate,
      canDelete: effectiveRank >= ORDER.delete && gate,
      isSuperAdmin
    };
  }, [level, isSuperAdmin, options.superAdminWrite]);
}
