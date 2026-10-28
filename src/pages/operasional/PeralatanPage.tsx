import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getEquipmentSummary, getEquipmentBreakdown, getEquipmentTrend } from "@/lib/insights";
import type { EquipmentSummary, EquipmentBranchRow, EquipmentTrend } from "@/types/insights";
import { fmtInt, fmtPct, usePeriod, useBranchOptions, FilterBar, Panel, StateBox, C, tooltipStyle, STATUS_COLOR } from "./insightsShared";
import styles from "./insights.module.css";

const PALETTE = ["#3c63b4", "#1f9d6b", "#c08a1e", "#d1495b", "#7c5cbf", "#2a9d9d", "#8496b0", "#e0792e"];
const STATUS_LABEL: Record<string, string> = { good: "Baik", warning: "Perlu Atensi", critical: "Kritis" };

export function PeralatanPage() {
  const period = usePeriod("12m");
  const { options } = useBranchOptions();
  const [branch, setBranch] = useState("");
  const [tick, setTick] = useState(0);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [rows, setRows] = useState<EquipmentBranchRow[] | null>(null);
  const [trend, setTrend] = useState<EquipmentTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const bp = branch || undefined;
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([
      getEquipmentSummary(bp),
      getEquipmentBreakdown(bp),
      getEquipmentTrend({ start_date: period.value.start_date, end_date: period.value.end_date, branch_codes: bp, granularity: period.value.granularity })
    ])
      .then(([s, b, t]) => {
        if (!alive) return;
        setSummary(s.data); setRows(b.data); setTrend(t.data); setAsOf(s.data_as_of); setStale(Boolean(s.stale));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Terjadi kesalahan"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [period.value.start_date, period.value.end_date, period.value.granularity, branch, tick]);

  const cats = summary?.categories || [];
  // Gabungkan series PWO tiap kategori menjadi baris per periode untuk multi-line.
  const trendCats = trend?.categories || [];
  const trendData = useMemo(() => {
    const base = trendCats[0]?.series || [];
    return base.map((pt, i) => {
      const row: Record<string, string | number | null> = { label: pt.label.replace(/ 20/, " '") };
      for (const c of trendCats) row[c.key] = c.series[i]?.pwo_percent ?? null;
      return row;
    });
  }, [trendCats]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Peralatan Elektronik</h1>
          <div className={styles.sub}>Ketersediaan peralatan <b>online</b> per kategori (terkini) & tren Persentase Waktu Online (PWO).</div>
        </div>
      </div>
      <FilterBar period={period} branch={{ value: branch, onChange: setBranch, options }} dataAsOf={asOf} stale={stale} loading={loading} onRefresh={() => setTick((t) => t + 1)} />

      {loading && !summary ? <StateBox loading /> : error ? <StateBox error={error} /> : (
        <>
          <div className={styles.kpiRow}>
            {cats.map((c) => {
              const tone = c.status === "good" ? "good" : c.status === "warning" ? "warning" : c.status === "critical" ? "critical" : undefined;
              return (
                <div key={c.key} className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ""}`}>
                  <div className={styles.kpiLabel}>{c.label}</div>
                  <div className={styles.kpiValue}>{c.availability_percent == null ? "N/A" : fmtPct(c.availability_percent)}</div>
                  <div className={styles.kpiSub}>
                    {c.status ? <span className={`${styles.statusChip} ${styles[`s_${c.status}`]}`}>{STATUS_LABEL[c.status]}</span> : <span className={`${styles.statusChip} ${styles.s_na}`}>N/A</span>}
                    {" "}<span style={{ marginLeft: 6 }}>{fmtInt(c.online_count)}/{fmtInt(c.total_count)} online</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Panel
            title="Tren PWO per Kategori"
            right={<span className={styles.legend} style={{ flexWrap: "wrap" }}>{trendCats.map((c, i) => <span key={c.key}><span className={styles.sw} style={{ background: PALETTE[i % PALETTE.length] }} />{c.label}</span>)}</span>}
          >
            <div className={styles.chartBoxTall}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={10} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.faint }} width={36} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtPct(v), n]} />
                  {trendCats.map((c, i) => (
                    <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive animationDuration={800} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Ketersediaan per Ruas">
            {(rows?.length ?? 0) === 0 ? <StateBox empty /> : (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Ruas</th>{cats.map((c) => <th key={c.key} className={styles.num}>{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows!.map((r) => {
                      const byKey = new Map(r.categories.map((c) => [c.key, c]));
                      return (
                        <tr key={r.branch_code}>
                          <td title={r.branch_name}>{r.branch_name}</td>
                          {cats.map((c) => {
                            const cell = byKey.get(c.key);
                            const pct = cell?.availability_percent;
                            const color = cell?.status ? STATUS_COLOR[cell.status] : C.muted;
                            return <td key={c.key} className={styles.num} style={{ color, fontWeight: 700 }}>{pct == null ? "–" : fmtPct(pct)}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
