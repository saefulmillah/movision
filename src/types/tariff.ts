/* Tipe modul Tarif (/api/admin/tariff/*). */

export interface TariffBranch {
  id: number;
  branch_code: string | null;
  branch_name: string | null;
  is_active: number | null;
}

export interface TariffGate {
  id: number;
  gate_code: string | null;
  gate_name: string | null;
}

export interface TariffRow {
  id: number;
  origin_gate_id: number | null;
  origin_gate_code: string | null;
  origin_gate_name: string | null;
  destination_gate_id: number | null;
  destination_gate_code: string | null;
  destination_gate_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  gol_id: number;
  tariff_amount: number | null;
  is_open: number | null;
}

export interface TariffGrid {
  branch_id: number;
  gol_id: number;
  is_open: number | null;
  gates: TariffGate[];
  /** key `${originId}_${destId}` (destId 0 = tanpa tujuan). */
  cells: Record<string, number | null>;
}

export interface TariffMeta {
  page: number;
  limit: number;
  total: number;
  total_page: number;
}

/* ---- Upload / import ---- */

export type TariffImportAction = "INSERT" | "UPDATE" | "SKIP" | "ERROR";

export interface TariffPreviewItem {
  row: number | null;
  column: string | null;
  key: string | null;
  origin_gate_id: number | null;
  origin_gate_name: string | null;
  destination_gate_id: number | null;
  destination_gate_name: string | null;
  gol_id: number | null;
  old_tariff_amount: number | null;
  new_tariff_amount: number | null;
  source: string;
  is_generated_reverse: boolean;
  action: TariffImportAction;
  notes: string | null;
  field: string | null;
  message: string | null;
}

export interface TariffPreviewSummary {
  tariff_mode: string;
  total_rows: number;
  total_matrix_cells: number;
  excel_input_count: number;
  generated_reverse_count: number;
  valid_count: number;
  error_count: number;
  insert_count: number;
  update_count: number;
  skip_count: number;
  [key: string]: unknown;
}

export interface TariffPreviewResult {
  success: boolean;
  message: string;
  import_session_id: string;
  summary: TariffPreviewSummary;
  preview: TariffPreviewItem[];
  errors: TariffPreviewItem[];
}

export interface TariffImportOptions {
  is_open?: number;
  tariff_mode?: "open_branch" | "closed_branch";
  sheet_name?: string;
  allow_same_origin_destination?: boolean;
  generate_reverse_od?: boolean;
  preview_limit?: number;
}

export interface TariffCommitResult {
  message: string;
  session?: Record<string, unknown>;
  [key: string]: unknown;
}
