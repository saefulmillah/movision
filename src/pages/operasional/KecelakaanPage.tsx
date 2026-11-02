import { useEffect, useRef, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { getAccidentSummary, getAccidentTrend, getAccidentBreakdown } from "@/lib/insights";
import type { AccidentSummary, AccidentTrend, AccidentBreakdown } from "@/types/insights";
import { fmtInt, fmtPct, fmtRate, usePeriod, useBranchOptions, FilterBar, Kpi, Panel, StateBox, ChangeBadge, C, tooltipStyle } from "./insightsShared";
import styles from "./insights.module.css";

const BY_TABS: TabItem[] = [
  { value: "cause", label: "Penyebab", icon: "list" },
  { value: "trigger_factor", label: "Faktor", icon: "git-branch" },
  { value: "hour_of_day", label: "Jam", icon: "clock" },
  { value: "branch", label: "Ruas", icon: "map-pin" }
];

export function KecelakaanPage() {
  const period = usePeriod("12m");
  const { options } = useBranchOptions();
  const [branch, setBranch] = useState("");
  const [by, setBy] = useState("cause");
  const [tick, setTick] = useState(0);
  const forceRef = useRef(false); // true hanya saat tombol refresh ditekan → paksa ambil ulang

  const [summary, setSummary] = useState<AccidentSummary | null>(null);
  const [trend, setTrend] = useState<AccidentTrend | null>(null);
  const [breakdown, setBreakdown] = useState<AccidentBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const refresh = forceRef.current; // konsumsi flag sekali pakai
    forceRef.current = false;
    const p = { start_date: period.value.start_date, end_date: period.value.end_date, branch_codes: branch || undefined, refresh };
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([
      getAccidentSummary(p),
      getAccidentTrend({ ...p, granularity: period.value.granularity }),
      getAccidentBreakdown({ ...p, by })
    ])
      .then(([s, t, b]) => {
        if (!alive) return;
        setSummary(s.data); setTrend(t.data); setBreakdown(b.data);
        setAsOf(s.data_as_of); setStale(Boolean(s.stale));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Terjadi kesalahan"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [period.value.start_date, period.value.end_date, period.value.granularity, branch, by, tick]);

  const trendData = (trend?.series || []).map((s) => ({ label: s.label.replace(/ 20/, " '"), accidents: s.accidents, fatality: s.fatality }));
  const maxCount = Math.max(1, ...(breakdown?.items || []).map((i) => i.count));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Kecelakaan</h1>
          <div className={styles.sub}>Jumlah kecelakaan, korban, serta <b>accident rate</b> & <b>fatality rate</b> (per 100 juta km-kendaraan).</div>
        </div>
      </div>
      <FilterBar period={period} branch={{ value: branch, onChange: setBranch, options }} dataAsOf={asOf} stale={stale} loading={loading} onRefresh={() => { forceRef.current = true; setTick((t) => t + 1); }} />

      {loading && !summary ? <StateBox loading /> : error ? <StateBox error={error} /> : (
        <>
          <div className={styles.kpiRow}>
            <Kpi label="Total Kecelakaan" value={fmtInt(summary?.total_accidents)} tone="critical" sub={<ChangeBadge comparison={summary?.comparison} />} />
            <Kpi label="Total Korban" value={fmtInt(summary?.victims.total)} sub={`${fmtInt(summary?.victims.light_injury)} ringan · ${fmtInt(summary?.victims.heavy_injury)} berat`} />
            <Kpi label="Korban Jiwa" value={fmtInt(summary?.victims.fatality)} tone="critical" />
            <Kpi label="Accident Rate" value={fmtRate(summary?.accident_rate)} tone="accent" sub="per 100 jt km-kend." />
            <Kpi label="Fatality Rate" value={fmtRate(summary?.fatality_rate)} tone="accent" sub="per 100 jt km-kend." />
          </div>

          <Panel title="Tren Kecelakaan" right={<span className={styles.legend}><span><span className={styles.sw} style={{ background: C.blue }} />Kecelakaan</span><span><span className={styles.sw} style={{ background: C.red }} />Korban jiwa</span></span>}>
            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 8, right: 10, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={10} />
                  <YAxis tick={{ fontSize: 10, fill: C.faint }} width={36} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtInt(v), n]} />
                  <Bar dataKey="accidents" name="Kecelakaan" fill={C.blue} radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={700} />
                  <Line type="monotone" dataKey="fatality" name="Korban jiwa" stroke={C.red} strokeWidth={2.4} dot={false} connectNulls isAnimationActive animationDuration={900} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Rincian Kecelakaan" right={<div style={{ minWidth: 320 }}><Tabs value={by} onValueChange={setBy} items={BY_TABS} /></div>}>
            {(breakdown?.items?.length ?? 0) === 0 ? <StateBox empty /> : (
              <table className={styles.table}>
                <thead><tr><th>Kategori</th><th className={styles.barCell} /><th className={styles.num}>Jumlah</th><th className={styles.num}>%</th></tr></thead>
                <tbody>
                  {breakdown!.items.map((it) => (
                    <tr key={it.key}>
                      <td title={it.label}>{it.label}</td>
                      <td className={styles.barCell}><div className={styles.bar}><span style={{ width: `${(it.count / maxCount) * 100}%`, background: C.blue }} /></div></td>
                      <td className={styles.num}>{fmtInt(it.count)}</td>
                      <td className={styles.num}>{fmtPct(it.percent)}</td>
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
