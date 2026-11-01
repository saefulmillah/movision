import { api } from "@/lib/api";
import type { EntityData } from "@/types/labaRugi";

/* ============================================================
   Data slide "Kinerja Regional" (hanya scope regional). Dirakit backend:
   payload L/R per-scope (konsol regional + fy_rkap + entities per ruas) +
   daftar LHR & PHR per ruas. Endpoint: GET /laba-rugi-regional/kinerja/:period.
   ============================================================ */

/** Baris lalu-lintas/pendapatan harian per ruas (LHR atau PHR). */
export interface TrafficRow {
  ruas: string;
  regional: string | null;
  rkap: number | null;
  real: number | null;
  ach: number;
}

export interface KinerjaRegionalData {
  meta: {
    period_key: string;
    period_label: string;
    scope_key?: string;
    scope_level?: string;
    scope_label?: string | null;
    empty?: boolean;
    unit?: string;
  };
  /** Label kolom bulan berjalan & s.d bulan (dari dataset). */
  month_label: string | null;
  sd_label: string | null;
  /** Label kolom RKK = bulan BERIKUTNYA (rencana) & s.d-nya (dari dataset periode ini). */
  rkk_label?: string | null;
  rkk_sd_label?: string | null;
  /** RKAP setahun penuh entitas regional: {account_id: [rkap, null]}. */
  fy_rkap: EntityData;
  /** Per ruas, kolom s.d bulan: {account_id: [rkap, real]}. */
  entities: Record<string, EntityData>;
  /** Per ruas, kolom bulan berjalan. */
  entities_month: Record<string, EntityData>;
  /** Per ruas, kolom RKK bulan berikutnya: {account_id: [rkap, rkk]}. */
  entities_rkk?: Record<string, EntityData>;
  /** Per ruas, kolom RKK s.d bulan berikutnya. */
  entities_rkk_sd?: Record<string, EntityData>;
  /** Konsol entitas regional per label kolom (SD / bulan / proyeksi). */
  konsol: Record<string, EntityData>;
  /** Urutan + grup ruas yang hadir. */
  ruas: { id: string; regional: string }[];
  lhr: TrafficRow[];
  phr: TrafficRow[];
}

/** Ambil data slide Kinerja Regional untuk sebuah periode + scope (regional). */
export function getKinerjaRegional(periodKey: string, scope: string): Promise<KinerjaRegionalData> {
  return api.get<KinerjaRegionalData>(
    `/laba-rugi-regional/kinerja/${encodeURIComponent(periodKey)}?scope=${encodeURIComponent(scope)}`
  );
}
