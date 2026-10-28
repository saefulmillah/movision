import { api } from "@/lib/api";

/* ============================================================
   Data slide "Pencapaian LHR & PHR terhadap Business Plan" (scope regional).
   Per ruas: LHR & PHR (BP, realisasi bulan laporan, %ach, realisasi bulanan[12])
   + komposisi golongan (BP/Real/%RL per Gol 1–5). Endpoint:
   GET /laba-rugi-regional/lhr-phr-eval/:period?scope=.
   ============================================================ */

export interface TrafficSeries {
  /** Business Plan (nilai acuan, bulan laporan). */
  bp: number | null;
  /** Realisasi bulan laporan. */
  real_month: number | null;
  /** Pencapaian % (real_month / bp). */
  ach: number | null;
  /** Realisasi per bulan Jan–Des (null bila belum ada data). */
  monthly: (number | null)[];
}

export interface RuasEval {
  ruas: string;
  regional: string | null;
  lhr: TrafficSeries;
  phr: TrafficSeries;
  /** Golongan I–V (bulan laporan): BP, Realisasi, %RL (real/bp). */
  gol: { bp: (number | null)[]; real: (number | null)[]; rl: (number | null)[] };
}

export interface LhrPhrEvalData {
  period_key: string;
  report_month: number | null;
  scope_key?: string;
  scope_level?: string;
  scope_label?: string | null;
  ruas: RuasEval[];
}

/** Ambil data slide LHR/PHR vs BP untuk sebuah periode + scope (regional). */
export function getLhrPhrEval(periodKey: string, scope: string): Promise<LhrPhrEvalData> {
  return api.get<LhrPhrEvalData>(
    `/laba-rugi-regional/lhr-phr-eval/${encodeURIComponent(periodKey)}?scope=${encodeURIComponent(scope)}`
  );
}
