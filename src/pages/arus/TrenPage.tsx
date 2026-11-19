import { useCallback, useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Card, EmptyState, Icon, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import { trafficFlow, ARAH_UTAMA, arahLabel, type HourlyResp, type PrediksiVsResp } from "@/lib/trafficFlow";
import { fmt, StatTile, Hint } from "./parts";
import styles from "@/pages/modules.module.css";

const ARAH_COLOR: Record<string, string> = {
  palembang: "#3b82f6", pekanbaru: "#22c55e", padang: "#f59e0b", medan: "#a855f7", bengkulu: "#64748b"
};

const MODE_OPTIONS: SelectOption[] = [
  { value: "arah", label: "Pisah per tujuan" },
  { value: "total", label: "Semua digabung" }
];

interface TrenData { hourly: HourlyResp; pred: PrediksiVsResp; }

export function TrenPage() {
  const [mode, setMode] = useState("arah");

  const fetcher = useCallback(async (): Promise<TrenData> => {
    const [hourly, pred] = await Promise.all([trafficFlow.hourly(), trafficFlow.prediksiVs()]);
    return { hourly, pred };
  }, []);
  const { data, loading, error } = usePolling<TrenData>(fetcher, 120000);

  const jamNow = data?.hourly.jam_berjalan ?? -1;

  // Pivot ke 24 jam.
  const chartData = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ jam: String(h).padStart(2, "0"), prediksi: 0, total: 0 } as Record<string, number | string>));
    for (const it of data?.hourly.items ?? []) {
      const r = rows[it.jam];
      if (!r) continue;
      r[it.arah] = (Number(r[it.arah]) || 0) + it.vll;
      r.total = (Number(r.total) || 0) + it.vll;
    }
    // Overlay prediksi per jam = Σ overlay arah utama.
    for (const p of data?.pred.items ?? []) {
      for (const o of p.overlay) {
        const r = rows[o.jam];
        if (r) r.prediksi = (Number(r.prediksi) || 0) + o.prediksi_jam;
      }
    }
    return rows;
  }, [data]);

  const predByArah = new Map((data?.pred.items ?? []).map((p) => [p.arah, p]));

  return (
    <div className={`${styles.page} ${styles.pageFlow}`}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Tren & Prediksi</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Jumlah kendaraan per jam hari ini dibanding prediksi. Jam yang sedang berjalan belum lengkap.</span>
        </div>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={mode} onValueChange={setMode} options={MODE_OPTIONS} icon="layers" ariaLabel="Mode" />
      </div>

      {error && !data ? (
        <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} />
      ) : (
        <>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: "14px 16px", height: 340, flex: "none" }}>
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 8 }}>Jumlah Kendaraan per Jam <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· batang = kendaraan keluar, garis merah = prediksi</span></div>
            <ResponsiveContainer width="100%" height="88%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="jam" tick={{ fontSize: 11, fill: "var(--text-muted)" }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={44} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => `Jam ${l}:00`}
                  formatter={(v: number, n: string) => [fmt(v), n === "prediksi" ? "Prediksi" : arahLabel(n)]}
                />
                <Legend formatter={(v) => (v === "prediksi" ? "Prediksi" : v === "total" ? "Total" : arahLabel(v))} wrapperStyle={{ fontSize: 11 }} />
                {mode === "total" ? (
                  <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                ) : (
                  ARAH_UTAMA.map((a) => (
                    <Bar key={a} dataKey={a} stackId="s" fill={ARAH_COLOR[a]} isAnimationActive={false} />
                  ))
                )}
                <Line dataKey="prediksi" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 4" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Kartu progres vs prediksi per arah */}
          <Hint style={{ margin: 0 }}>Untuk tiap tujuan: berapa persen target hari ini sudah tercapai, dan perkiraan total sampai akhir hari (dihitung dari pola jam biasanya).</Hint>
          <div className={styles.body} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "var(--sp-4)", alignContent: "start" }}>
            {ARAH_UTAMA.map((a) => {
              const p = predByArah.get(a);
              return (
                <Card key={a} title={arahLabel(a)}>
                  {!p ? (
                    <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>{loading ? "Memuat…" : "Belum ada data"}</span>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <StatTile label="Tercapai" value={p.progres_persen != null ? `${p.progres_persen}%` : "—"} sub={`dari target ${fmt(p.prediksi_kend)}`} />
                      <StatTile label="EOD" value={fmt(p.proyeksi_eod)} sub={p.source === "resmi" ? "vs target resmi" : "vs pola biasa"} color={p.flag_lampaui ? "#ef4444" : undefined} />
                      {p.flag_lampaui && (
                        <div style={{ gridColumn: "1 / -1", display: "inline-flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: "var(--fs-xs)", fontWeight: 600 }}>
                          <Icon name="trending-up" size={14} /> Diperkirakan melebihi target
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>
            <b>EOD</b> (End of Day) = perkiraan total kendaraan sampai akhir hari, dihitung dari pola jam biasanya; baru muncul setelah hari berjalan cukup (saat ini sekitar jam {jamNow}).
            {data?.pred.items.some((p) => p.source === "baseline") ? " Sebagian target masih berdasar pola histori — ganti dengan angka resmi di menu Setelan." : null}
          </span>
        </>
      )}
    </div>
  );
}
