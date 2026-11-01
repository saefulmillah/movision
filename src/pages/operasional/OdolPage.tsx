import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getOdolSummary, getOdolTrend, getOdolBreakdown, getOdolPlateRegions, getOdolCompanies } from "@/lib/insights";
import type { OdolSummary, OdolTrend, OdolBreakdown, OdolPlateRegions, OdolCompanies } from "@/types/insights";
import {
  fmtInt, fmtPct, usePeriod, useBranchOptions, FilterBar, Kpi, Panel, StateBox, ChangeBadge, C, tooltipStyle
} from "./insightsShared";
import styles from "./insights.module.css";

export function OdolPage() {
  const period = usePeriod("12m");
  const { options } = useBranchOptions();
  const [branch, setBranch] = useState("");
  const [tick, setTick] = useState(0);

  const [summary, setSummary] = useState<OdolSummary | null>(null);
  const [trend, setTrend] = useState<OdolTrend | null>(null);
  const [breakdown, setBreakdown] = useState<OdolBreakdown | null>(null);
  const [plates, setPlates] = useState<OdolPlateRegions | null>(null);
  const [companies, setCompanies] = useState<OdolCompanies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const p = { start_date: period.value.start_date, end_date: period.value.end_date, branch_codes: branch || undefined };
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getOdolSummary(p),
      getOdolTrend({ ...p, granularity: period.value.granularity }),
      getOdolBreakdown({ ...p, by: "branch" }),
      getOdolPlateRegions(p),
      getOdolCompanies(p)
    ])
      .then(([s, t, b, pl, co]) => {
        if (!alive) return;
        setSummary(s.data); setTrend(t.data); setBreakdown(b.data); setPlates(pl.data); setCompanies(co.data);
        setAsOf(s.data_as_of); setStale(Boolean(s.stale));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Terjadi kesalahan"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [period.value.start_date, period.value.end_date, period.value.granularity, branch, tick]);

  const trendData = (trend?.series || []).map((s) => ({ label: s.label.replace(/ 20/, " '"), total_odol: s.total_odol, odol_percent: s.odol_percent }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>ODOL — Over Dimension Over Loading</h1>
          <div className={styles.sub}>Kendaraan tertimbang & pelanggaran ODOL (Golongan 2–5). Hanya ruas ber-WIM.</div>
        </div>
      </div>
      <FilterBar
        period={period}
        branch={{ value: branch, onChange: setBranch, options }}
        dataAsOf={asOf} stale={stale} loading={loading} onRefresh={() => setTick((t) => t + 1)}
      />

      {loading && !summary ? <StateBox loading /> : error ? <StateBox error={error} /> : (
        <>
          <div className={styles.kpiRow}>
            <Kpi label="Kendaraan Tertimbang" value={fmtInt(summary?.total_weighed)} />
            <Kpi label="Normal" value={fmtInt(summary?.total_normal)} tone="good" />
            <Kpi label="Pelanggaran ODOL" value={fmtInt(summary?.total_odol)} tone="critical" sub={<ChangeBadge comparison={summary?.comparison} />} />
            <Kpi label="Persentase ODOL" value={fmtPct(summary?.odol_percent)} tone="accent" />
          </div>

          <Panel
            title="Tren ODOL"
            right={<span className={styles.legend}><span><span className={styles.sw} style={{ background: C.red }} />Pelanggaran ODOL</span><span><span className={styles.sw} style={{ background: C.blue }} />% ODOL</span></span>}
          >
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 8, right: 10, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={10} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: C.faint }} width={44} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: C.faint }} width={36} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [n === "% ODOL" ? fmtPct(v) : fmtInt(v), n]} />
                  <Bar yAxisId="l" dataKey="total_odol" name="Pelanggaran ODOL" fill={C.red} radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={700} />
                  <Line yAxisId="r" type="monotone" dataKey="odol_percent" name="% ODOL" stroke={C.blue} strokeWidth={2.4} dot={false} connectNulls isAnimationActive animationDuration={900} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className={styles.grid2}>
            <Panel title="Per Ruas">
              {(breakdown?.items?.length ?? 0) === 0 ? <StateBox empty /> : (
                <table className={styles.table}>
                  <thead><tr><th>Ruas</th><th className={styles.num}>Tertimbang</th><th className={styles.num}>ODOL</th><th className={styles.barCell}>% ODOL</th></tr></thead>
                  <tbody>
                    {breakdown!.items.map((it) => (
                      <tr key={it.key}>
                        <td title={it.label}>{it.label}</td>
                        <td className={styles.num}>{fmtInt(it.total_weighed)}</td>
                        <td className={styles.num}>{fmtInt(it.total_odol)}</td>
                        <td className={styles.barCell}>
                          <div className={styles.bar}><span style={{ width: `${Math.min(100, it.odol_percent)}%`, background: C.red }} /></div>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{fmtPct(it.odol_percent)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Asal Kendaraan (Pelat)" right={<span style={{ fontSize: 11, color: C.muted }}>Top wilayah</span>}>
              {(plates?.items?.length ?? 0) === 0 ? <StateBox empty /> : (
                <table className={styles.table}>
                  <thead><tr><th>Wilayah</th><th>Provinsi</th><th className={styles.num}>ODOL</th><th className={styles.num}>%</th></tr></thead>
                  <tbody>
                    {plates!.items.slice(0, 8).map((it) => (
                      <tr key={it.key}>
                        <td><b>{it.key}</b> · {it.label}</td>
                        <td style={{ color: C.muted }}>{it.province}</td>
                        <td className={styles.num}>{fmtInt(it.total_odol)}</td>
                        <td className={styles.num}>{fmtPct(it.odol_percent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel title="Perusahaan Angkutan" right={companies ? <span style={{ fontSize: 11, color: C.muted }}>{fmtInt(companies.total_companies)} perusahaan</span> : null}>
            {(companies?.items?.length ?? 0) === 0 ? <StateBox empty /> : (
              <table className={styles.table}>
                <thead><tr><th className={styles.rank}>#</th><th>Perusahaan</th><th>Jenis</th><th className={styles.num}>Kendaraan</th><th className={styles.num}>ODOL</th><th className={styles.num}>Pangsa</th></tr></thead>
                <tbody>
                  {companies!.items.slice(0, 10).map((it) => (
                    <tr key={it.rank}>
                      <td className={styles.rank}>{it.rank}</td>
                      <td>{it.company_name}</td>
                      <td style={{ color: C.muted }}>{it.entity_type}</td>
                      <td className={styles.num}>{fmtInt(it.total_vehicles)}</td>
                      <td className={styles.num}>{fmtInt(it.total_odol)}</td>
                      <td className={styles.num}>{fmtPct(it.company_share_percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
