/* ============================================================
   Tipe modul Laba Rugi. Bentuk data identik dengan
   sample-output/data-2026-08.json di paket backend.
   Setiap nilai sel = [RKAP, REAL]; null/0 → tampil "–".
   ============================================================ */

/** Sepasang nilai [RKAP, REAL]. */
export type Cell = [number | null, number | null];

/** Item periode untuk dropdown (GET /api/laba-rugi/periods). */
export interface Period {
  key: string;
  label: string;
  validation_passed: boolean;
  uploaded_at?: string | null;
  source_sheet?: string | null;
  source_file?: string | null;
  unit?: string;
}

export type AccountType = "section" | "sub" | "total";

export interface AccountMeta {
  id: string;
  label: string;
  type: AccountType;
  parent?: string;
}

export interface RegionalMeta {
  id: string;
  members: string[];
}

export interface RuasMeta {
  id: string;
  regional: string;
}

/** Peta akunId → [RKAP, REAL] untuk satu entitas/kolom. */
export type EntityData = Record<string, Cell>;

export interface ValidationCheck {
  check: string;
  ok: boolean;
  detail: string;
}

export interface ValidationResult {
  passed: boolean;
  n_checks: number;
  n_failed: number;
  checks: ValidationCheck[];
}

/** GET /api/laba-rugi/:periodKey → data. */
export interface PeriodData {
  meta: {
    period_key: string;
    period_label: string;
    unit: string;
    source_sheet?: string | null;
    source_file?: string | null;
    [key: string]: unknown;
  };
  accounts: AccountMeta[];
  regionals: RegionalMeta[];
  ruas: RuasMeta[];
  total_definition: string[];
  entities: Record<string, EntityData>;
  konsol: Record<string, EntityData>;
  validation?: ValidationResult | null;
}

/** POST /api/laba-rugi/import → data (ringkasan validasi). */
export interface ImportResult {
  period_key: string;
  period_label: string;
  source_sheet?: string | null;
  unit?: string;
  saved?: boolean;
  validation: ValidationResult;
  entity_count?: number;
  konsol_columns?: string[];
}
