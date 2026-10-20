/* ============================================================
   Scope presentasi (divisi / regional / cabang) — klien API.
   Menentukan tingkat yang boleh dipresentasikan user (diturunkan dari
   branch-scope di backend). Fase 1: hanya memilih scope; pemfilteran data
   per-scope menyusul (Fase 2).
   ============================================================ */
import { api } from "@/lib/api";

export type ScopeLevel = "divisi" | "regional" | "cabang";

/** Pemetaan ke data finansial. `ruas: null` = semua (divisi, tanpa filter);
 *  `[]` = tak ada padanan data finansial; selain itu = daftar kode ruas finansial. */
export interface ScopeFinancial {
  regional: string | null;
  ruas: string[] | null;
}

export interface PresentationScope {
  level: ScopeLevel;
  key: string;
  label: string;
  regionalKey: string | null;
  financial: ScopeFinancial;
}

export interface ScopeCatalogRuas {
  id: number;
  code: string | null;
  name: string;
  financial: string | null;
}

export interface ScopeCatalogRegional {
  id: number | null;
  key: string;
  name: string;
  financialRegional: string | null;
  financialRuas: string[];
  ruas: ScopeCatalogRuas[];
}

export interface PresentationScopesResponse {
  canDrill: boolean;
  default: PresentationScope;
  scopes: PresentationScope[];
  catalog: { regionals: ScopeCatalogRegional[] } | null;
}

export function getPresentationScopes(): Promise<PresentationScopesResponse> {
  return api.get<PresentationScopesResponse>("/presentation-scopes");
}

/** Semua scope yang dapat dipilih: untuk divisi (canDrill) = divisi + tiap
 *  regional + tiap cabang dari katalog; selain itu = scope milik user. */
export function flattenScopes(info: PresentationScopesResponse | null): PresentationScope[] {
  if (!info) return [];
  if (info.catalog) {
    const out: PresentationScope[] = [
      { level: "divisi", key: "divisi", label: "Semua (Divisi)", regionalKey: null, financial: { regional: null, ruas: null } }
    ];
    for (const reg of info.catalog.regionals) {
      out.push({
        level: "regional",
        key: reg.key,
        label: reg.name,
        regionalKey: reg.key,
        financial: { regional: reg.financialRegional, ruas: reg.financialRuas }
      });
      for (const ru of reg.ruas) {
        out.push({
          level: "cabang",
          key: `cabang:${ru.id}`,
          label: ru.name,
          regionalKey: reg.key,
          financial: { regional: reg.financialRegional, ruas: ru.financial ? [ru.financial] : [] }
        });
      }
    }
    return out;
  }
  return info.scopes;
}
