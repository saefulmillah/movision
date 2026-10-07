/* ============================================================
   Tipe Manajemen Akses (RBAC dinamis) — kontrak /api/admin/*.
   Envelope backend { status, message, data }; sebagian respons
   membungkus satu objek dalam array (ambil elemen pertama).
   ============================================================ */

export type AccessLevel = "none" | "read" | "write" | "delete";

/** GET /api/admin/roles → Role[] */
export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  user_count: number;
  permission_count: number;
  module_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface RolePermissionRef {
  permission_code: string;
  permission_name: string;
  permission_group: string | null;
}

export interface RoleModuleRef {
  module_code: string;
  access_level: AccessLevel;
}

/** GET /api/admin/roles/:id → [RoleDetail] */
export interface RoleDetail {
  id: number;
  role_code: string;
  role_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: RolePermissionRef[];
  module_access: RoleModuleRef[];
  created_at?: string;
  updated_at?: string;
}

/** GET /api/admin/permissions → Permission[] */
export interface Permission {
  id: number;
  permission_code: string;
  permission_name: string;
  description: string | null;
  permission_group: string | null;
  role_count: number;
  created_at?: string;
  updated_at?: string;
}

/** GET /api/admin/modules → Module[] */
export interface AccessModule {
  id: number;
  module_code: string;
  module_name: string;
  module_group: string | null;
  display_order: number;
  is_active: boolean;
  role_count: number;
  created_at?: string;
  updated_at?: string;
}

/** data[] guardrail 409 saat menghapus role yang masih dipakai. */
export interface RoleAssignedConflict {
  assigned_user_count: number;
  sample_users: { id: number; username: string }[];
  hint?: string;
}

/** data[] guardrail 409 saat menghapus permission/modul yang direferensikan. */
export interface ReferencedConflict {
  referenced_by_roles?: number;
  referenced_by_menus?: number;
  referenced_by_users?: number;
}

export interface CreateRoleInput {
  role_code: string;
  role_name: string;
  description?: string;
}

export interface PermissionFormInput {
  permission_code: string;
  permission_name: string;
  description?: string;
  permission_group?: string;
}

export interface ModuleFormInput {
  module_code: string;
  module_name: string;
  module_group?: string;
  display_order?: number;
  is_active?: number;
}
