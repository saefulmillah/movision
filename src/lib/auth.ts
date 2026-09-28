import { api } from "@/lib/api";
import type { Capability, LoginResult, MenuNode } from "@/types/api";

/**
 * Login lokal. Backend membungkus hasil dalam array: data: [{ token, user }].
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const data = await api.post<LoginResult[] | LoginResult>(
    "/auth/login",
    { username, password },
    { auth: false }
  );
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.token) {
    throw new Error("Respons login tidak valid");
  }
  return result;
}

/** Capability user aktif: profil, roles, permissions, branch scopes, module access. */
export function fetchCapability(): Promise<Capability> {
  return api.get<Capability>("/auth/me");
}

/** Tree menu TollSentra yang sudah terfilter hak akses di backend (app_code=tollsentra).
 *  Jangan difilter ulang di FE. */
export function fetchMenus(): Promise<MenuNode[]> {
  return api.get<MenuNode[]>("/menus?app=tollsentra");
}
