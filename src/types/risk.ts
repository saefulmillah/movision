/* ============================================================
   Tipe modul Manajemen Risiko (grup Rapat Direktorat).
   Selaras dengan API_CONTRACT.md (base /api/risk).
   ============================================================ */

export type Level = "L" | "LM" | "M" | "MH" | "H";
export type Stage = "inherent" | "expected" | "residual";

/** Satu sel matriks appetite: nomor sel + posisi + level. */
export interface MatrixCell {
  no: number;
  impact: number;
  likelihood: number;
  level: Level;
}

export interface LevelMeta {
  label: string;
  color: string;
}

/** GET /api/risk/matrix → data. */
export interface RiskMatrix {
  size: number;
  axes: {
    impact: Record<string, string>;
    likelihood: Record<string, string>;
  };
  levels: Record<Level, LevelMeta>;
  cells: MatrixCell[];
}

/** Item periode untuk dropdown (GET /api/risk/periods). */
export interface PeriodMeta {
  key: string;
  label: string;
  divisi?: string | null;
  unit?: string;
  status: "draft" | "published";
}

/** Nilai per stage yang dikembalikan backend (cell & level DIHITUNG backend). */
export interface StageValue {
  cell: number;
  level: Level;
  likelihood: number;
  impact: number;
  nilai: number | null;
}

/** Satu baris risiko (GET /api/risk/:periodKey → data.risks[]). */
export interface RiskItem {
  id?: number;
  rank: number;
  event: string;
  impact_desc: string | null;
  inherent?: StageValue | null;
  expected?: StageValue | null;
  residual?: StageValue | null;
}

/** GET /api/risk/:periodKey → data. */
export interface PeriodData {
  period: PeriodMeta;
  risks: RiskItem[];
}

/* ---------- Payload tulis ---------- */

/** Input satu stage pada form (cell/level TIDAK dikirim; dihitung backend). */
export interface StageInput {
  likelihood: number;
  impact: number;
  nilai?: number | null;
}

/** PUT /api/risk/:periodKey/items */
export interface UpsertItemInput {
  id?: number;
  rank: number;
  event: string;
  impact_desc?: string;
  inherent?: StageInput;
  expected?: StageInput;
  residual?: StageInput;
}

/** POST /api/risk/periods */
export interface CreatePeriodInput {
  period_key: string;
  period_label: string;
  divisi?: string;
  unit?: string;
}
