import { api } from "@/lib/api";
import type {
  InsightsEnvelope,
  Branch,
  EquipmentCategoryRef,
  RescueUnitTypeRef,
  OdolSummary,
  OdolTrend,
  OdolBreakdown,
  OdolPlateRegions,
  OdolCompanies,
  AccidentSummary,
  AccidentTrend,
  AccidentBreakdown,
  RescueSummary,
  RescueBranchRow,
  EquipmentSummary,
  EquipmentBranchRow,
  EquipmentTrend,
  OdolPresentation,
  AccidentPresentation
} from "@/types/insights";

// Konsumen /api/insights/* (backend menandatangani & menyimpan data on-demand).
// Semua endpoint GET; backend mengembalikan { meta, data, stale, data_as_of, ... }.

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    // refresh=true → kirim "1" (backend memaksa ambil ulang & lewati cache).
    if (typeof v === "boolean") { if (v) sp.set(k, "1"); continue; }
    if (String(v).trim() !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// refresh=true → paksa backend ambil ulang dari partner (lewati read-through cache).
type Period = { start_date: string; end_date: string; branch_codes?: string; refresh?: boolean };

// --- Referensi ---
export const getBranches = () => api.get<InsightsEnvelope<Branch[]>>("/insights/references/branches");
export const getEquipmentCategories = () => api.get<InsightsEnvelope<EquipmentCategoryRef[]>>("/insights/references/equipment-categories");
export const getRescueUnitTypes = () => api.get<InsightsEnvelope<RescueUnitTypeRef[]>>("/insights/references/rescue-unit-types");

// --- ODOL ---
export const getOdolSummary = (p: Period & { vehicle_group?: string }) =>
  api.get<InsightsEnvelope<OdolSummary>>(`/insights/odol/summary${qs(p)}`);
export const getOdolTrend = (p: Period & { vehicle_group?: string; granularity?: string }) =>
  api.get<InsightsEnvelope<OdolTrend>>(`/insights/odol/trend${qs(p)}`);
export const getOdolBreakdown = (p: Period & { by: string; vehicle_group?: string }) =>
  api.get<InsightsEnvelope<OdolBreakdown>>(`/insights/odol/breakdown${qs(p)}`);
export const getOdolPlateRegions = (p: Period & { vehicle_group?: string }) =>
  api.get<InsightsEnvelope<OdolPlateRegions>>(`/insights/odol/plate-regions${qs(p)}`);
export const getOdolCompanies = (p: Period & { vehicle_group?: string }) =>
  api.get<InsightsEnvelope<OdolCompanies>>(`/insights/odol/companies${qs(p)}`);

// Agregator ODOL untuk slide presentasi (sadar-scope). Mengembalikan payload penuh.
// refresh=true → paksa backend ambil ulang dari partner (lewati read-through cache).
export const getOdolPresentation = (scope?: string | null, refresh?: boolean) =>
  api.get<OdolPresentation>(`/insights/odol/presentation${qs({ scope: scope && scope !== "divisi" ? scope : undefined, refresh })}`);

// --- Kecelakaan ---
export const getAccidentSummary = (p: Period) =>
  api.get<InsightsEnvelope<AccidentSummary>>(`/insights/accidents/summary${qs(p)}`);
export const getAccidentTrend = (p: Period & { granularity?: string }) =>
  api.get<InsightsEnvelope<AccidentTrend>>(`/insights/accidents/trend${qs(p)}`);
export const getAccidentBreakdown = (p: Period & { by: string }) =>
  api.get<InsightsEnvelope<AccidentBreakdown>>(`/insights/accidents/breakdown${qs(p)}`);

// Agregator Kecelakaan untuk slide presentasi (sadar-scope, 3 tahun mengikuti periode).
// refresh=true → paksa backend ambil ulang dari partner (lewati read-through cache).
export const getAccidentPresentation = (periodKey: string, scope?: string | null, refresh?: boolean) =>
  api.get<AccidentPresentation>(
    `/insights/accidents/presentation${qs({ period: periodKey, scope: scope && scope !== "divisi" ? scope : undefined, refresh })}`
  );

// --- Kendaraan Bantuan ---
export const getRescueSummary = (branch_codes?: string, refresh?: boolean) =>
  api.get<InsightsEnvelope<RescueSummary>>(`/insights/rescue-units/summary${qs({ branch_codes, refresh })}`);
export const getRescueBreakdown = (branch_codes?: string, refresh?: boolean) =>
  api.get<InsightsEnvelope<RescueBranchRow[]>>(`/insights/rescue-units/breakdown${qs({ branch_codes, refresh })}`);

// --- Peralatan Elektronik ---
export const getEquipmentSummary = (branch_codes?: string, refresh?: boolean) =>
  api.get<InsightsEnvelope<EquipmentSummary>>(`/insights/equipment/summary${qs({ branch_codes, refresh })}`);
export const getEquipmentBreakdown = (branch_codes?: string, refresh?: boolean) =>
  api.get<InsightsEnvelope<EquipmentBranchRow[]>>(`/insights/equipment/breakdown${qs({ branch_codes, refresh })}`);
export const getEquipmentTrend = (p: Period & { granularity?: string }) =>
  api.get<InsightsEnvelope<EquipmentTrend>>(`/insights/equipment/trend${qs(p)}`);
