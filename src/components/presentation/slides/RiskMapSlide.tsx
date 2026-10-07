import { EmptyState } from "@/components/ui";
import { RiskHeatmap } from "@/pages/rapat-direktorat/manajemen-risiko/RiskHeatmap";
import type { Level, PeriodData, RiskMatrix, StageValue } from "@/types/risk";
import styles from "./RiskMapSlide.module.css";

const STAGES: ("inherent" | "expected" | "residual")[] = ["inherent", "expected", "residual"];

function chipInk(level: Level): string {
  return level === "LM" || level === "M" ? "#2a2118" : "#fff";
}
function fmtNilai(v: number | null | undefined): string {
  return v == null ? "–" : Math.round(v).toLocaleString("en-US");
}

interface RiskMapSlideProps {
  matrix: RiskMatrix | null;
  risk: PeriodData | null;
  periodLabel: string;
}

export function RiskMapSlide({ matrix, risk, periodLabel }: RiskMapSlideProps) {
  const risks = risk?.risks ?? [];

  return (
    <div className={styles.slide}>
      <div className={styles.header}>
        <h1 className={styles.title}>Peta Risiko &amp; Daftar Top Risk Divisi</h1>
        <span className={styles.sub}>Operasi &amp; Pemeliharaan Jalan Tol · Rp juta · {periodLabel}</span>
        <span className={styles.spacer} />
        <span className={styles.legend}>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotInh}`} />Inherent</span>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotExp}`} />Expected</span>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotRes}`} />Residual</span>
        </span>
      </div>

      {!matrix || !risk || risks.length === 0 ? (
        <div className={styles.emptyBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data"
            description={`Data Manajemen Risiko untuk periode ${periodLabel} belum tersedia.`}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <div className={styles.heatCard}>
              <RiskHeatmap matrix={matrix} risks={risks} />
            </div>
            <div className={styles.zoneLegend}>
              {(Object.keys(matrix.levels) as Level[]).map((lv) => (
                <span key={lv} className={styles.zoneItem}>
                  <span className={styles.zoneSw} style={{ background: matrix.levels[lv].color }} />
                  {matrix.levels[lv].label}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.thRank}>#</th>
                  <th rowSpan={2} className={styles.thEvt}>Peristiwa &amp; Dampak</th>
                  <th colSpan={2}>Inherent</th>
                  <th colSpan={2}>Expected</th>
                  <th colSpan={2}>Residual</th>
                </tr>
                <tr className={styles.subHead}>
                  <th>Exp</th><th>Nilai</th>
                  <th>Exp</th><th>Nilai</th>
                  <th>Exp</th><th>Nilai</th>
                </tr>
              </thead>
              <tbody>
                {[...risks].sort((a, b) => a.rank - b.rank).map((r) => (
                  <tr key={r.id ?? r.rank}>
                    <td className={styles.tdRank}>{r.rank}</td>
                    <td>
                      <div className={styles.evt}>{r.event}</div>
                      {r.impact_desc && <div className={styles.dmp}>{r.impact_desc}</div>}
                    </td>
                    {STAGES.map((s) => {
                      const stage = r[s] as StageValue | null | undefined;
                      if (!stage) {
                        return (
                          <ExposureCell key={s} chip={null} />
                        );
                      }
                      return (
                        <ExposureCell
                          key={s}
                          chip={{
                            text: `${stage.cell} · ${stage.level}`,
                            bg: matrix.levels[stage.level]?.color,
                            ink: chipInk(stage.level),
                            nilai: fmtNilai(stage.nilai)
                          }}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExposureCell({
  chip
}: {
  chip: { text: string; bg?: string; ink: string; nilai: string } | null;
}) {
  if (!chip) {
    return (
      <>
        <td className={styles.tdChip}>–</td>
        <td className={styles.num}>–</td>
      </>
    );
  }
  return (
    <>
      <td className={styles.tdChip}>
        <span className={styles.chip} style={{ background: chip.bg, color: chip.ink }}>
          {chip.text}
        </span>
      </td>
      <td className={styles.num}>{chip.nilai}</td>
    </>
  );
}
