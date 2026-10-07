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
  cell: KpiCell;
  total?: boolean;
}

function KpiCard({ model, unit }: { model: CardModel; unit: "miliar" | "juta" }) {
  const col = achColor(model.cell.ach);
  const pct = Math.max(4, Math.min(100, (model.cell.real / (model.cell.rkap || 1)) * 100));
  return (
    <div className={`${styles.card} ${model.total ? styles.cardTotal : ""}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardLabel}>{model.label}</span>
        <span
          className={styles.achBadge}
          style={{ color: col, background: `color-mix(in srgb, ${col} 16%, transparent)` } as CSSProperties}
        >
          {model.cell.ach}%
        </span>
      </div>
      <div className={styles.cardValue}>{fmtRp(model.cell.real, unit)}</div>
      <div className={styles.cardRkap}>RKAP {fmtRp(model.cell.rkap, unit)}</div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: col } as CSSProperties} />
        <div className={styles.mark} />
      </div>
    </div>
  );
}

/**
 * KPI Pendapatan dalam DUA grup berheader: "Periode Ini" (bulan) & "Kumulatif s.d",
 * masing-masing 3 kartu (Tol / Usaha Lainnya / Total). Dipakai halaman & slide.
 * Satuan nilai mengikuti prop `unit`: "miliar" (default) atau "juta" (slide).
 */
export function PendapatanKpiCards({ kpiMonth, kpiSd, monthLabel, sdLabel, unit = "miliar" }: PendapatanKpiCardsProps) {
  const groups = [
    {
      title: monthLabel,
      cards: [
        { label: "Pendapatan Tol", cell: kpiMonth.tol },
        { label: "Usaha Lainnya", cell: kpiMonth.usaha_lainnya },
        { label: "Total Pendapatan", cell: kpiMonth.total, total: true }
      ] as CardModel[]
    },
    {
      title: sdLabel,
      cards: [
        { label: "Pendapatan Tol", cell: kpiSd.tol },
        { label: "Usaha Lainnya", cell: kpiSd.usaha_lainnya },
        { label: "Total Pendapatan", cell: kpiSd.total, total: true }
      ] as CardModel[]
    }
  ];

  return (
    <div className={styles.kpiGroups}>
      {groups.map((g) => (
        <div key={g.title} className={styles.kpiGroup}>
          <div className={styles.kpiGroupHead}>
            <span className={styles.kpiGroupTitle}>{g.title}</span>
          </div>
          <div className={styles.kpiRow}>
            {g.cards.map((c, i) => (
              <KpiCard key={i} model={c} unit={unit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
