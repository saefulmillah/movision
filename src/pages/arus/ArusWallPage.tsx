import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, EmptyState, Icon } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import {
  trafficFlow, ARAH_UTAMA, arahLabel, levelMeta,
  type ThroughputResp, type RankingResp, type AnomalyResp, type HealthResp
} from "@/lib/trafficFlow";
import { fmt, pctFull, LevelBadge, Spark, TrenArrow, UpdateTicker, StatTile, Hint, reasonText } from "./parts";
import styles from "@/pages/modules.module.css";

interface WallData {
  tp: ThroughputResp; rank: RankingResp; anom: AnomalyResp; health: HealthResp;
}

export function ArusWallPage() {
  const navigate = useNavigate();

  const fetcher = useCallback(async (): Promise<WallData> => {
    const [tp, rank, anom, health] = await Promise.all([
      trafficFlow.throughput({ group: "arah", series_hours: 6 }),
      trafficFlow.ranking({ min_level: "ramai", limit: 8 }),
      trafficFlow.anomaly(),
      trafficFlow.health()
    ]);
    return { tp, rank, anom, health };
  }, []);

  const { data, loading, error } = usePolling<WallData>(fetcher, 60000);

  const byArah = new Map((data?.tp.items ?? []).map((i) => [i.arah, i]));
  const totalNow = (data?.tp.items ?? []).reduce((s, i) => s + i.vll_60m, 0);
  const anomali = data?.anom.anomali ?? [];

  return (
    <div className={`${styles.page} ${styles.pageFlow}`}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Papan Pantau Arus</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Pantauan arus kendaraan langsung di tiap tujuan. Angka bersifat perkiraan tren, bukan hitungan macet pasti.</span>
        </div>
        <span className={styles.headSpacer} />
        <UpdateTicker lag={data?.health.lag_minutes ?? null} pollMinutes={data?.health.poll_interval_minutes} />
      </div>

      {error && !data ? (
        <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} />
      ) : (
        <>
          {/* KPI ringkas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--sp-4)", flex: "none" }}>
            <StatTile label="Kendaraan Keluar (1 jam)" value={fmt(totalNow)} sub="semua tujuan, per jam" color="var(--st-blue, #3b82f6)" />
            <StatTile label="Gerbang Mulai Ramai" value={fmt(data?.rank.count ?? 0)} sub="butuh perhatian" color="#f59e0b" />
            <StatTile label="Diduga Hambatan" value={fmt(data?.anom.anomali_count ?? 0)} sub="perlu dicek CCTV" color={anomali.length ? "#a855f7" : undefined} />
            <StatTile label="Total Hari Ini" value={fmt(data?.health.hari_ini.vll ?? 0)} sub="kendaraan keluar sejak 00:00" />
          </div>

          {/* Kartu per arah */}
          <Hint style={{ margin: 0 }}>Jumlah kendaraan keluar per jam menuju tiap kota (1 jam terakhir). Panah menunjukkan sedang naik atau turun; grafik kecil = pergerakan 6 jam terakhir.</Hint>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "var(--sp-4)", flex: "none" }}>
            {ARAH_UTAMA.map((a) => {
              const it = byArah.get(a);
              const vll = it?.vll_60m ?? 0;
              return (
                <div key={a} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: "14px 16px", cursor: "pointer" }}
                  role="button" tabIndex={0} onClick={() => navigate("/arus/kepadatan")}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate("/arus/kepadatan"); }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>{arahLabel(a)}</span>
                    <TrenArrow value={it?.tren_60m} />
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmt(vll)}</div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6 }}>kendaraan per jam</div>
                  <Spark data={it?.series ?? []} color="#3b82f6" />
                </div>
              );
            })}
          </div>

          <div className={styles.body} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--sp-4)", alignContent: "start" }}>
            {/* Ranking gerbang kritis */}
            <Card title="Gerbang Tersibuk" count={data?.rank.count ?? 0} action={{ label: "Kepadatan", onClick: () => navigate("/arus/kepadatan") }}>
              <Hint>Gerbang paling padat saat ini. "Terisi" = seberapa penuh dibanding kapasitasnya; warna menandai tingkat keramaian.</Hint>
              {(data?.rank.items.length ?? 0) === 0 ? (
                <EmptyState icon="gauge" title={loading ? "Memuat…" : "Semua lancar"} description="Tak ada gerbang yang mulai ramai saat ini." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data!.rank.items.map((g) => (
                    <div key={`${g.kode_bujt}-${g.gb_tujuan}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.gb_tujuan}</span>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{arahLabel(g.arah)} · terisi {pctFull(g.rho)}</span>
                      </span>
                      <LevelBadge level={g.level} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Peringatan / Diduga Hambatan */}
            <Card title="Peringatan Aktif" count={anomali.length} action={{ label: "Detail", onClick: () => navigate("/arus/peringatan") }}>
              <Hint>Gerbang yang arusnya tiba-tiba anjlok atau datanya terputus — kemungkinan ada hambatan. Klik untuk cek lewat CCTV.</Hint>
              {anomali.length === 0 ? (
                <EmptyState icon="shield-check" title={loading ? "Memuat…" : "Tidak ada peringatan"} description="Tak ada gerbang yang diduga terhambat atau kehilangan data." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {anomali.map((a) => (
                    <div key={`${a.kode_bujt}-${a.gb_tujuan}`} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                      role="button" tabIndex={0} onClick={() => navigate("/arus/peringatan")}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate("/arus/peringatan"); }}>
                      <Icon name={a.severitas === "tinggi" ? "triangle-alert" : "alert-circle"} size={18}
                        style={{ color: levelMeta(a.status).color }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.gb_tujuan}</span>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{arahLabel(a.arah)} · {reasonText(a.reasons, levelMeta(a.status).label)}</span>
                      </span>
                      <LevelBadge level={a.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
