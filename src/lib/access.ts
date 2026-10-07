import { api } from "@/lib/api";
import type {
  AccessModule,
  CreateRoleInput,
  ModuleFormInput,
  Permission,
  PermissionFormInput,
  Role,
  RoleDetail,
  RoleModuleRef
} from "@/types/access";

/** Backend membungkus sebagian respons dalam array; ambil elemen pertama. */
function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/* ---------------- Roles ---------------- */
export function listRoles(): Promise<Role[]> {
  return api.get<Role[]>("/admin/roles");
}

export async function getRole(id: number): Promise<RoleDetail> {
  return first(await api.get<RoleDetail[] | RoleDetail>(`/admin/roles/${id}`));
}

export async function createRole(body: CreateRoleInput): Promise<Role> {
  return first(await api.post<Role[] | Role>("/admin/roles", body));
}

export async function updateRole(
  id: number,
  body: { role_name?: string; description?: string | null; is_active?: number }
): Promise<Role> {
  return first(await api.put<Role[] | Role>(`/admin/roles/${id}`, body));
}

export function deleteRole(id: number): Promise<unknown> {
  return api.delete(`/admin/roles/${id}`);
}

export function replaceRolePermissions(id: number, permissionCodes: string[]): Promise<unknown> {
  return api.put(`/admin/roles/${id}/permissions`, { permission_codes: permissionCodes });
}

export function replaceRoleModuleAccess(id: number, moduleAccess: RoleModuleRef[]): Promise<unknown> {
  return api.put(`/admin/roles/${id}/module-access`, { module_access: moduleAccess });
}

/* ---------------- Permissions ---------------- */
export function listPermissions(): Promise<Permission[]> {
  return api.get<Permission[]>("/admin/permissions");
}

export async function createPermission(body: PermissionFormInput): Promise<Permission> {
  return first(await api.post<Permission[] | Permission>("/admin/permissions", body));
}

export async function updatePermission(
  id: number,
  body: Omit<PermissionFormInput, "permission_code">
): Promise<Permission> {
  return first(await api.put<Permission[] | Permission>(`/admin/permissions/${id}`, body));
}

export function deletePermission(id: number): Promise<unknown> {
  return api.delete(`/admin/permissions/${id}`);
}

/* ---------------- Modules ---------------- */
export function listModules(): Promise<AccessModule[]> {
  return api.get<AccessModule[]>("/admin/modules");
}

export async function createModule(body: ModuleFormInput): Promise<AccessModule> {
  return first(await api.post<AccessModule[] | AccessModule>("/admin/modules", body));
}

export async function updateModule(
  id: number,
  body: Omit<ModuleFormInput, "module_code">
): Promise<AccessModule> {
  return first(await api.put<AccessModule[] | AccessModule>(`/admin/modules/${id}`, body));
}

export function deleteModule(id: number): Promise<unknown> {
  return api.delete(`/admin/modules/${id}`);
}
