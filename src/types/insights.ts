/* ============================================================================
   Tipe modul Insights (konsumen HK Partner API via /api/insights/*).
   Envelope internal: api.get mengembalikan { meta, data, stale, data_as_of, ... }.
   ============================================================================ */

export interface InsightsEnvelope<T> {
  meta: InsightsMeta | null;
  data: T;
  stale: boolean;
  data_as_of: string | null;
  fetched_at: string | null;
  rate_limit?: { limit: string | null; remaining: string | null; reset: string | null } | null;
}

export interface InsightsMeta {
  period?: { start_date: string; end_date: string };
  branch_codes?: string[];
  data_as_of?: string;
  generated_at?: string;
}

export interface Comparison {
  previous_value: number | null;
  change_percent: number | null;
  direction: "up" | "down" | null;
  is_higher_worse: boolean;
}

// --- Referensi ---
export interface Branch {
  branch_code: string;
  name: string;
  region_name: string | null;
  length_km: number | null;
}
export interface EquipmentCategoryRef {
  key: string;
  label: string;
  unit_label: string | null;
  order: number;
}
export interface RescueUnitTypeRef {
  key: string;
  label: string;
}

// --- ODOL ---
export interface OdolSummary {
  vehicle_group: string;
  total_weighed: number;
  total_normal: number;
  total_odol: number;
  odol_percent: number;
  comparison: Comparison;
}
export interface OdolTrendPoint {
  period: string;
  label: string;
  total_weighed: number | null;
  total_normal: number | null;
  total_odol: number | null;
  odol_percent: number | null;
}
export interface OdolTrend {
  vehicle_group: string;
  granularity: string;
  series: OdolTrendPoint[];
}
export interface OdolBreakdownItem {
  key: string;
  label: string;
  total_weighed: number;
  total_odol: number;
  odol_percent: number;
}
export interface OdolBreakdown {
  by: string;
  total_odol: number;
  items: OdolBreakdownItem[];
}
export interface OdolPlateItem {
  key: string;
  label: string;
  province: string;
  total_odol: number;
  total_vehicles: number;
  odol_percent: number;
}
export interface OdolPlateRegions {
  vehicle_group: string;
  total_odol: number;
  items: OdolPlateItem[];
}
export interface OdolCompanyItem {
  rank: number;
  company_name: string;
  entity_type: string;
  total_odol: number;
  total_vehicles: number;
  company_share_percent: number;
}
export interface OdolCompanies {
  vehicle_group: string;
  total_odol: number;
  total_companies: number;
  owner_types: { key: string; label: string; total_odol: number; odol_percent: number }[];
  items: OdolCompanyItem[];
}

// --- Kecelakaan ---
export interface AccidentSummary {
  total_accidents: number;
  accidents_without_victims: number;
  victims: { light_injury: number; heavy_injury: number; fatality: number; total: number };
  accident_rate: number | null;
  fatality_rate: number | null;
  comparison: Comparison;
}
export interface AccidentTrendPoint {
  period: string;
  label: string;
  accidents: number | null;
  light_injury: number | null;
  heavy_injury: number | null;
  fatality: number | null;
}
export interface AccidentTrend {
  granularity: string;
  series: AccidentTrendPoint[];
}
export interface CountItem {
  key: string;
  label: string;
  count: number;
  percent: number;
}
export interface AccidentBreakdown {
  by: string;
  total: number;
  items: CountItem[];
}

// --- Kendaraan Bantuan (rescue) ---
export interface ConditionCount {
  good: number;
  fair: number;
  poor: number;
  unknown: number;
}
export interface RescueTypeRow {
  key: string;
  label: string;
  total_units: number;
  active_units: number;
  condition: ConditionCount;
}
export interface RescueSummary {
  total_units: number;
  active_units: number;
  inactive_units: number;
  condition: ConditionCount;
  by_type: RescueTypeRow[];
}
export interface RescueBranchRow {
  branch_code: string;
  branch_name: string;
  total_units: number;
  active_units: number;
  by_type: { key: string; label: string; total_units: number; active_units: number }[];
}

// --- Peralatan Elektronik ---
export type EquipmentStatus = "good" | "warning" | "critical" | null;
export interface EquipmentCategoryStatus {
  key: string;
  label: string;
  order: number;
  online_count: number;
  offline_count: number;
  total_count: number;
  availability_percent: number | null;
  status: EquipmentStatus;
}
export interface EquipmentSummary {
  categories: EquipmentCategoryStatus[];
}
export interface EquipmentBranchRow {
  branch_code: string;
  branch_name: string;
  categories: EquipmentCategoryStatus[];
}
export interface EquipmentTrendCategory {
  key: string;
  label: string;
  series: { period: string; label: string; pwo_percent: number | null }[];
}
export interface EquipmentTrend {
  granularity: string;
  categories: EquipmentTrendCategory[];
}

// --- ODOL untuk slide presentasi (agregator sadar-scope) ---
export interface OdolPresTrendPoint {
  month: string;
  label: string;
  total_normal: number | null;
  total_odol: number | null;
  odol_percent: number | null;
}
export interface OdolPresShareItem {
  key: string;
  label: string;
  total_odol: number;
  percent: number;
  drill_key?: string | null;
}
export interface OdolPresPlate {
  key: string;
  label: string;
  province: string;
  total_odol: number;
  odol_percent: number;
}
export interface OdolPresentation {
  scope: { key: string; level: string; label: string };
  period: { start_date: string; end_date: string; year: number };
  data_as_of: string | null;
  stale: boolean;
  empty: boolean;
  kpi: { total_weighed: number; total_normal: number; total_odol: number; odol_percent: number; comparison: Comparison | null };
  trend: OdolPresTrendPoint[];
  normal_vs_odol: { normal: number; odol: number };
  by_class: OdolPresShareItem[];
  sebaran: { mode: "regional" | "cabang" | "plate"; items: OdolPresShareItem[] };
  top_plates: OdolPresPlate[];
  top_companies: OdolCompanyItem[];
  narratives: { overall: string; trend: string; composition: string; sebaran: string; plates: string; companies: string };
}
