import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import { AchievementBarChart } from "@/pages/rapat-direktorat/pendapatan/AchievementBarChart";
import { PendapatanKpiCards } from "@/pages/rapat-direktorat/pendapatan/PendapatanKpiCards";
import type { PeriodData } from "@/types/pendapatan";
import styles from "./PendapatanOverviewSlide.module.css";

interface PendapatanOverviewSlideProps {
  data: PeriodData | null;
  periodLabel: string;
  /** Label scope aktif (regional/cabang); null/undefined untuk divisi. */
  scopeLabel?: string | null;
}

export function PendapatanOverviewSlide({ data, periodLabel, scopeLabel }: PendapatanOverviewSlideProps) {
  if (!data) {
    return (
      <SlideFrame title="Pendapatan Tol dan Lainnya">
        <div className={styles.stateBox}>
          <EmptyState icon="inbox" title="Data pendapatan tidak tersedia" description="Belum ada snapshot Pendapatan untuk periode ini." />
        </div>
      </SlideFrame>
    );
  }

  const monthLabel = data.meta.period_label_month;
  const sdLabel = data.meta.period_label_sd || periodLabel;
  const periodForTitle = monthLabel || sdLabel;
  const scoped = Boolean(data.meta.scoped);
  const fromDataset = data.meta.tol_source === "lr_dataset";

  return (
    <SlideFrame
      title="Pendapatan Tol dan Lainnya"
      rightMeta={
        <>
          Pendapatan <b>(dalam juta)</b>
        </>
      }
      scopeLabel={scopeLabel}
      footnote={
        fromDataset
          ? "KPI (Tol, Usaha Lainnya, Total) & Pendapatan Tol per ruas mengikuti dataset kinerja lingkup terpilih; LHR per ruas dari evaluasi divisi."
          : scoped
            ? "Pendapatan Tol (kumulatif s.d) mengikuti lingkup terpilih; Usaha Lainnya, Total, dan kolom Periode Ini pada tingkat Divisi."
            : undefined
      }
    >
      <div className={styles.kpiWrap}>
        <PendapatanKpiCards
          kpiMonth={data.kpi_month}
          kpiSd={data.kpi_sd}
          monthLabel={monthLabel}
          sdLabel={sdLabel}
          unit="juta"
          presentation
        />
      </div>

      <div className={styles.charts}>
        <ChartPanel title={`Pencapaian LHR s.d ${periodForTitle}`} data={data.lhr} ariaLabel="Grafik pencapaian LHR per ruas" />
        <ChartPanel title={`Pencapaian Pendapatan Tol s.d ${periodForTitle}`} data={data.pendapatan_ruas} ariaLabel="Grafik pencapaian pendapatan per ruas" />
      </div>
    </SlideFrame>
  );
}

function ChartPanel({ title, data, ariaLabel }: { title: string; data: PeriodData["lhr"]; ariaLabel: string }) {
  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <span className={styles.chartSpacer} />
        <span className={styles.legend}>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swRkap}`} />
            RKAP
          </span>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swReal}`} />
            Realisasi
          </span>
          <span className={styles.legItem}>
            <span className={styles.dots}>
              <span className={styles.d} style={{ background: "var(--sem-green)" }} />
              <span className={styles.d} style={{ background: "var(--sem-amber)" }} />
              <span className={styles.d} style={{ background: "var(--sem-red)" }} />
            </span>
            % Pencapaian
          </span>
        </span>
      </div>
      <AchievementBarChart data={data} ariaLabel={ariaLabel} variant="fit" />
    </div>
  );
}
