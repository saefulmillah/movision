import { EmptyState } from "@/components/ui";
import { AchievementBarChart } from "@/pages/rapat-direktorat/pendapatan/AchievementBarChart";
import { PendapatanKpiCards } from "@/pages/rapat-direktorat/pendapatan/PendapatanKpiCards";
import type { PeriodData } from "@/types/pendapatan";
import styles from "./PendapatanOverviewSlide.module.css";

interface PendapatanOverviewSlideProps {
  data: PeriodData | null;
  periodLabel: string;
}

export function PendapatanOverviewSlide({ data, periodLabel }: PendapatanOverviewSlideProps) {
  if (!data) {
    return (
      <div className={styles.stateBox}>
        <EmptyState icon="inbox" title="Data pendapatan tidak tersedia" description="Belum ada snapshot Pendapatan untuk periode ini." />
      </div>
    );
  }

  const monthLabel = data.meta.period_label_month;
  const sdLabel = data.meta.period_label_sd || periodLabel;
  const periodForTitle = monthLabel || sdLabel;

  return (
    <div className={styles.slide}>
      <div className={styles.head}>
        <h1 className={styles.title}>Pendapatan Tol dan Lainnya</h1>
        <span className={styles.spacer} />
        <span className={styles.note}>
          Pendapatan <b>(dalam juta)</b>
        </span>
      </div>

      <div className={styles.kpiWrap}>
        <PendapatanKpiCards kpiMonth={data.kpi_month} kpiSd={data.kpi_sd} monthLabel={monthLabel} sdLabel={sdLabel} unit="juta" />
      </div>

      <div className={styles.charts}>
        <ChartPanel title={`Pencapaian LHR s.d ${periodForTitle}`} data={data.lhr} ariaLabel="Grafik pencapaian LHR per ruas" />
        <ChartPanel title={`Pencapaian Pendapatan Tol s.d ${periodForTitle}`} data={data.pendapatan_ruas} ariaLabel="Grafik pencapaian pendapatan per ruas" />
      </div>
    </div>
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
