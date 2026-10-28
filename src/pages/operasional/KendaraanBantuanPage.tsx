import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getRescueSummary, getRescueBreakdown } from "@/lib/insights";
import type { RescueSummary, RescueBranchRow } from "@/types/insights";
import { fmtInt, useBranchOptions, FilterBar, Kpi, Panel, StateBox, C, tooltipStyle } from "./insightsShared";
import styles from "./insights.module.css";

const COND = [
  { key: "good", label: "Baik", color: C.green },
  { key: "fair", label: "Cukup", color: C.amber },
  { key: "poor", label: "Kurang", color: C.red },
  { key: "unknown", label: "Tidak diketahui", color: C.neu }
] as const;

export function KendaraanBantuanPage() {
  const { options } = useBranchOptions();
  const [branch, setBranch] = useState("");
  const [tick, setTick] = useState(0);
  const [summary, setSummary] = useState<RescueSummary | null>(null);
  const [rows, setRows] = useState<RescueBranchRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([getRescueSummary(branch || undefined), getRescueBreakdown(branch || undefined)])
      .then(([s, b]) => {
        if (!alive) return;
        setSummary(s.data); setRows(b.data); setAsOf(s.data_as_of); setStale(Boolean(s.stale));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Terjadi kesalahan"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [branch, tick]);

  const pie = useMemo(() => (summary ? COND.map((c) => ({ name: c.label, value: summary.condition[c.key], color: c.color })).filter((d) => d.value > 0) : []), [summary]);
  const types = summary?.by_type || [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Kendaraan Bantuan</h1>
          <div className={styles.sub}>Status armada <b>terkini</b>: jumlah unit, unit aktif, dan kondisi per jenis kendaraan.</div>
        </div>
      </div>
      <FilterBar branch={{ value: branch, onChange: setBranch, options }} dataAsOf={asOf} stale={stale} loading={loading} onRefresh={() => setTick((t) => t + 1)} />

      {loading && !summary ? <StateBox loading /> : error ? <StateBox error={error} /> : (
        <>
          <div className={styles.kpiRow}>
            <Kpi label="Total Unit" value={fmtInt(summary?.total_units)} />
            <Kpi label="Unit Aktif" value={fmtInt(summary?.active_units)} tone="good" />
            <Kpi label="Tidak Aktif" value={fmtInt(summary?.inactive_units)} tone="critical" />
            <Kpi label="Kondisi Baik" value={fmtInt(summary?.condition.good)} tone="good" />
          </div>

          <div className={styles.grid2}>
            <Panel title="Kondisi Armada">
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={1.5} isAnimationActive animationDuration={700}>
                      {pie.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtInt(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.legend} style={{ flexWrap: "wrap", justifyContent: "center" }}>
                {COND.map((c) => <span key={c.key}><span className={styles.sw} style={{ background: c.color }} />{c.label} <b style={{ color: "var(--text)" }}>{fmtInt(summary?.condition[c.key])}</b></span>)}
              </div>
            </Panel>

            <Panel title="Per Jenis Unit">
              <table className={styles.table}>
                <thead><tr><th>Jenis</th><th className={styles.num}>Total</th><th className={styles.num}>Aktif</th><th className={styles.barCell}>Aktif</th></tr></thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.key}>
                      <td>{t.label}</td>
                      <td className={styles.num}>{fmtInt(t.total_units)}</td>
                      <td className={styles.num}>{fmtInt(t.active_units)}</td>
                      <td className={styles.barCell}><div className={styles.bar}><span style={{ width: `${t.total_units ? (t.active_units / t.total_units) * 100 : 0}%`, background: C.green }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Distribusi per Ruas">
            {(rows?.length ?? 0) === 0 ? <StateBox empty /> : (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Ruas</th>
                      <th className={styles.num}>Total</th>
                      <th className={styles.num}>Aktif</th>
                      {types.map((t) => <th key={t.key} className={styles.num}>{t.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows!.map((r) => {
                      const byKey = new Map(r.by_type.map((x) => [x.key, x]));
                      return (
                        <tr key={r.branch_code}>
                          <td title={r.branch_name}>{r.branch_name}</td>
                          <td className={styles.num}><b>{fmtInt(r.total_units)}</b></td>
                          <td className={styles.num} style={{ color: C.green }}>{fmtInt(r.active_units)}</td>
                          {types.map((t) => <td key={t.key} className={styles.num}>{fmtInt(byKey.get(t.key)?.total_units ?? 0)}</td>)}
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
