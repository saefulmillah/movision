export interface BranchScope {
  id: number;
  branch_code: string | null;
  branch_name: string | null;
}

export interface ModuleAccessItem {
  module_code: string;
  access_level: string;
}

export interface UserRecord {
  id: number;
  external_subject_id: string | null;
  username: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  legacy_role: string | null;
  roles: string[];
  permissions: string[];
  branch_scopes: BranchScope[];
  module_access?: ModuleAccessItem[];
  capability_source?: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserFormValues {
  username: string;
  password?: string;
  full_name: string;
  display_name?: string;
  email?: string;
  external_subject_id?: string;
  role_codes: string[];
  branch_ids: number[];
  is_active: boolean;
}

export interface AdminMenu {
  id: number;
  menu_code: string;
  menu_name: string;
  icon: string | null;
  route_path: string | null;
  parent_id: number | null;
  parent_name?: string | null;
  display_order: number;
  permission_code: string | null;
  module_code: string | null;
  required_access_level: string;
  is_active: number;
}
