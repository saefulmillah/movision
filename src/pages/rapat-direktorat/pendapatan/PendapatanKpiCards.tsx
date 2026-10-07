import type { CSSProperties } from "react";
import type { KpiBlockData, KpiCell } from "@/types/pendapatan";
import styles from "./PendapatanKpiCards.module.css";

interface PendapatanKpiCardsProps {
  kpiMonth: KpiBlockData;
  kpiSd: KpiBlockData;
  monthLabel: string;
  sdLabel: string;
  /** Satuan tampilan nilai. "miliar" (default, halaman) = juta ÷ 1000, 2 desimal.
   *  "juta" (slide presentasi) = nilai juta penuh tanpa desimal. */
  unit?: "miliar" | "juta";
}

/** Nilai mentah dalam Rp juta → string Rp sesuai satuan. */
function fmtRp(juta: number | null | undefined, unit: "miliar" | "juta"): string {
  if (juta == null || !Number.isFinite(juta)) return "–";
  if (unit === "juta") {
    return `Rp ${juta.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  }
  return `Rp ${(juta / 1000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Warna %ACH: ≥100 hijau, 90–99 kuning, <90 merah. */
function achColor(ach: number): string {
  if (ach >= 100) return "var(--sem-green)";
  if (ach >= 90) return "var(--sem-amber)";
  return "var(--sem-red)";
}

interface CardModel {
  label: string;
  period: string;
  cell: KpiCell;
  total?: boolean;
}

/**
 * Enam kartu KPI compact (Tol / Usaha Lainnya / Total × bulan & SD) —
 * dipakai bersama oleh halaman Pendapatan dan slide overview presentasi.
 * Satuan nilai mengikuti prop `unit`: "miliar" (default, halaman) atau "juta" (slide).
 */
export function PendapatanKpiCards({ kpiMonth, kpiSd, monthLabel, sdLabel, unit = "miliar" }: PendapatanKpiCardsProps) {
  const cards: CardModel[] = [
    { label: "Pendapatan Tol", period: monthLabel, cell: kpiMonth.tol },
    { label: "Usaha Lainnya", period: monthLabel, cell: kpiMonth.usaha_lainnya },
    { label: "Total Pendapatan", period: monthLabel, cell: kpiMonth.total, total: true },
    { label: "Pendapatan Tol", period: sdLabel, cell: kpiSd.tol },
    { label: "Usaha Lainnya", period: sdLabel, cell: kpiSd.usaha_lainnya },
    { label: "Total Pendapatan", period: sdLabel, cell: kpiSd.total, total: true }
  ];

  return (
    <div className={styles.kpiRow}>
      {cards.map((cardModel, i) => {
        const col = achColor(cardModel.cell.ach);
        const pct = Math.max(4, Math.min(100, (cardModel.cell.real / (cardModel.cell.rkap || 1)) * 100));
        return (
          <div key={i} className={`${styles.card} ${cardModel.total ? styles.cardTotal : ""}`}>
            <div className={styles.cardTop}>
              <span className={styles.cardLabelBox}>
                <span className={styles.cardLabel}>{cardModel.label}</span>
                <span className={styles.cardPeriod}>{cardModel.period}</span>
              </span>
              <span
                className={styles.achBadge}
                style={{ color: col, background: `color-mix(in srgb, ${col} 16%, transparent)` } as CSSProperties}
              >
                {cardModel.cell.ach}%
              </span>
            </div>
            <div className={styles.cardValue}>{fmtRp(cardModel.cell.real, unit)}</div>
            <div className={styles.cardRkap}>RKAP {fmtRp(cardModel.cell.rkap, unit)}</div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${pct}%`, background: col } as CSSProperties} />
              <div className={styles.mark} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
