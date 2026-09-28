/* ============================================================
   Tipe kontrak backend cctv-backend.
   Envelope umum: { status, message, data }.
   ============================================================ */

export interface ApiEnvelope<T> {
  status: number;
  message: string;
  data: T;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  full_name?: string | null;
  role?: string;
}

/** POST /api/auth/login → data: [{ token, user }] */
export interface LoginResult {
  token: string;
  user: AuthUser;
}

/** GET /api/auth/me → data: { user, roles, permissions, branch_scopes, module_access } */
export interface Capability {
  user: Pick<AuthUser, "id" | "username" | "email" | "display_name">;
  roles: string[];
  permissions: string[];
  branch_scopes: BranchScope[];
  module_access: ModuleAccess[];
}

export interface BranchScope {
  branch_id: number | string;
  branch_name?: string;
  [key: string]: unknown;
}

export interface ModuleAccess {
  module_code: string;
  access_level: string;
  [key: string]: unknown;
}

/** GET /api/menus → data: MenuNode[] (tree, sudah terfilter hak akses) */
export interface MenuNode {
  id: number;
  menu_code: string;
  menu_name: string;
  icon: string | null;
  route_path: string | null;
  parent_id: number | null;
  display_order: number;
  permission_code: string | null;
  module_code: string | null;
  required_access_level: string;
  is_active: number;
  children?: MenuNode[];
}
