import { api } from "@/lib/api";
import type { AdminMenu, UserFormValues, UserRecord } from "@/types/users";

/** Backend membungkus sebagian respons dalam array; ambil elemen pertama. */
function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

export function fetchUsers(): Promise<UserRecord[]> {
  return api.get<UserRecord[]>("/users");
}

export async function fetchUser(id: number): Promise<UserRecord> {
  return first(await api.get<UserRecord[] | UserRecord>(`/users/${id}`));
}

function toPayload(v: UserFormValues, isCreate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    full_name: v.full_name,
    display_name: v.display_name || undefined,
    email: v.email || undefined,
    external_subject_id: v.external_subject_id || undefined,
    role_codes: v.role_codes,
    branch_ids: v.branch_ids,
    is_active: v.is_active ? 1 : 0
  };
  if (isCreate) {
    payload.username = v.username;
    payload.password = v.password;
  } else if (v.password) {
    payload.password = v.password;
  }
  return payload;
}

export async function createUser(v: UserFormValues): Promise<UserRecord> {
  return first(await api.post<UserRecord[] | UserRecord>("/users", toPayload(v, true)));
}

export async function updateUser(id: number, v: UserFormValues): Promise<UserRecord> {
  return first(await api.put<UserRecord[] | UserRecord>(`/users/${id}`, toPayload(v, false)));
}

export function deleteUser(id: number): Promise<unknown> {
  return api.delete(`/users/${id}`);
}

/* ---- Admin menus ---- */
export function fetchAdminMenus(): Promise<AdminMenu[]> {
  return api.get<AdminMenu[]>("/admin/menus");
}

export async function createMenu(body: Partial<AdminMenu>): Promise<AdminMenu> {
  return first(await api.post<AdminMenu[] | AdminMenu>("/admin/menus", body));
}

export async function updateMenu(id: number, body: Partial<AdminMenu>): Promise<AdminMenu> {
  return first(await api.put<AdminMenu[] | AdminMenu>(`/admin/menus/${id}`, body));
}

export function deleteMenu(id: number): Promise<unknown> {
  return api.delete(`/admin/menus/${id}`);
}
