import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import { RiskHeatmap } from "@/pages/rapat-direktorat/manajemen-risiko/RiskHeatmap";
import { getPeriod as getRiskPeriod } from "@/lib/risk";
import { flattenScopes } from "@/lib/presentationScope";
import type { PresentationScope, PresentationScopesResponse } from "@/lib/presentationScope";
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
  /** Kunci periode aktif — untuk fetch risiko cabang saat selector dipakai. */
  periodKey?: string;
  /** Scope presentasi aktif; selector cabang hanya muncul untuk level "regional". */
  scope?: PresentationScope | null;
  scopeInfo?: PresentationScopesResponse | null;
}

export function RiskMapSlide({ matrix, risk, periodLabel, periodKey, scope, scopeInfo }: RiskMapSlideProps) {
  // Kunci scope regional aktif (data `risk`/prop sudah untuk scope ini).
  const regionalKey = scope?.level === "regional" ? scope.key : null;

  // Opsi selector: Regional (prop) + tiap cabang di bawahnya. Hanya untuk regional.
  const options = useMemo(() => {
    if (!regionalKey || !scope) return [];
    const cabang = flattenScopes(scopeInfo ?? null)
      .filter((s) => s.level === "cabang" && s.regionalKey === scope.regionalKey)
      .map((s) => ({ key: s.key, label: s.label }));
    if (cabang.length === 0) return [];
    return [{ key: regionalKey, label: scope.label }, ...cabang];
  }, [regionalKey, scope, scopeInfo]);
  const hasSelector = options.length > 0;

  // Scope yang sedang ditampilkan + cache hasil fetch cabang.
  const [activeKey, setActiveKey] = useState<string>(regionalKey ?? "divisi");
  const [cache, setCache] = useState<Record<string, PeriodData | null>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // Reset saat scope regional / periode berganti.
  useEffect(() => {
    setActiveKey(regionalKey ?? "divisi");
    setCache({});
    setLoadingKey(null);
  }, [regionalKey, periodKey]);

  // Fetch risiko cabang saat dipilih (selain regional yang sudah ada di prop).
  useEffect(() => {
    if (!regionalKey || activeKey === regionalKey) return; // regional = pakai prop
    if (activeKey in cache) return; // sudah di-fetch
    if (!periodKey) return;
    let alive = true;
    setLoadingKey(activeKey);
    getRiskPeriod(periodKey, activeKey)
      .then((d) => { if (alive) setCache((c) => ({ ...c, [activeKey]: d })); })
      .catch(() => { if (alive) setCache((c) => ({ ...c, [activeKey]: null })); })
      .finally(() => { if (alive) setLoadingKey((k) => (k === activeKey ? null : k)); });
    return () => { alive = false; };
  }, [activeKey, regionalKey, periodKey, cache]);

  const activeRisk = !regionalKey || activeKey === regionalKey ? risk : cache[activeKey] ?? null;
  const risks = activeRisk?.risks ?? [];
  const loading = hasSelector && loadingKey === activeKey;
  const activeLabel = options.find((o) => o.key === activeKey)?.label ?? null;

  const selector = hasSelector ? (
    <div className={styles.scopeBar}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`${styles.scopeBtn} ${o.key === activeKey ? styles.scopeBtnOn : ""}`}
          onClick={() => setActiveKey(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <SlideFrame
      title={<>Peta Risiko &amp; Daftar Top Risk</>}
      subtitle={<>Operasi &amp; Pemeliharaan Jalan Tol · Rp juta · {periodLabel}</>}
      scopeLabel={activeLabel}
      rightMeta={
        <span className={styles.legend}>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotInh}`} />Inherent</span>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotExp}`} />Expected</span>
          <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotRes}`} />Residual</span>
        </span>
      }
    >
      {selector}
      {!matrix ? (
        <div className={styles.emptyBox}>
          <EmptyState icon="inbox" title="Belum ada data" description="Konfigurasi matriks risiko belum tersedia." />
        </div>
      ) : loading ? (
        <div className={styles.emptyBox}>
          <div className={styles.loadingText}>Memuat data {activeLabel ?? "cabang"}…</div>
        </div>
      ) : !activeRisk || risks.length === 0 ? (
        <div className={styles.emptyBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data"
            description={`Data Manajemen Risiko ${activeLabel ? `${activeLabel} ` : ""}untuk periode ${periodLabel} belum tersedia.`}
          />
        </div>
      ) : (
        /* key={activeKey} → remount tiap ganti cabang agar efek fade-up terputar lagi. */
        <div key={activeKey} className={styles.centerWrap}>
        <div className={styles.grid}>
          <div className={styles.heatCard}>
            <RiskHeatmap matrix={matrix} risks={risks} />
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
        <div className={styles.zoneLegend}>
          {(Object.keys(matrix.levels) as Level[]).map((lv) => (
            <span key={lv} className={styles.zoneItem}>
              <span className={styles.zoneSw} style={{ background: matrix.levels[lv].color }} />
              {matrix.levels[lv].label}
            </span>
          ))}
        </div>
        </div>
      )}
    </SlideFrame>
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
