import { useCallback } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePolling } from "@/lib/usePolling";
import {
  trafficFlow,
  arahLabel,
  type ThroughputResp,
  type DensityResp,
  type PrediksiVsResp,
  type AnomalyResp,
  type DensityItem
} from "@/lib/trafficFlow";
import { fmt, pctFull, LevelBadge, TrenArrow, Spark, reasonText, UpdateTicker } from "@/pages/arus/parts";
import { normGate } from "./arusResolver";
import styles from "./peta.module.css";

/** Pilihan yang memicu panel: hasil klik vektor ruas. */
export type TrafficSel =
  | { kind: "arah"; arah: string; roadName: string; gateName: string }
  | { kind: "functional"; roadName: string }
  | { kind: "untracked"; roadName: string };

interface WallData {
  tp: ThroughputResp;
  dens: DensityResp;
  pv: PrediksiVsResp;
  anom: AnomalyResp;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-2xl)",
        padding: "13px 15px"
      }}
    >
      <div style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
      {hint && <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: 8, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function PanelShell({ roadName, onClose, children }: { roadName: string; onClose: () => void; children: ReactNode }) {
  return (
    <aside className={styles.rightPanel}>
      <div className={styles.rpHead}>
        <span className={styles.rpTitle}>Arus Lalin</span>
        <button className={`${styles.rpIconBtn} ${styles.rpClose}`} onClick={onClose} title="Tutup" aria-label="Tutup">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div style={{ padding: "12px 14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div style={{ fontSize: "var(--fs-base)", fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{roadName}</div>
        {children}
      </div>
    </aside>
  );
}

function ArahCards({ arah, gateName }: { arah: string; gateName: string }) {
  const fetcher = useCallback(async (): Promise<WallData> => {
    const [tp, dens, pv, anom] = await Promise.all([
      trafficFlow.throughput({ arah, group: "arah", series_hours: 6 }),
      trafficFlow.density(arah),
      trafficFlow.prediksiVs(arah),
      trafficFlow.anomaly(arah)
    ]);
    return { tp, dens, pv, anom };
  }, [arah]);

  const { data, loading, error } = usePolling<WallData>(fetcher, 60000, [arah]);

  if (error && !data) {
    const akses = /akses|forbidden|403/i.test(error);
    return (
      <EmptyState
        icon={akses ? "lock" : "triangle-alert"}
        title={akses ? "Tak ada akses modul Arus Lalin" : "Gagal memuat"}
        description={akses ? "Butuh hak akses modul Arus Lalin untuk melihat data ini." : error}
      />
    );
  }
  if (!data) {
    return <EmptyState icon="activity" title="Memuat…" description="Mengambil data arus lalin." />;
  }

  const tp = data.tp.items.find((i) => i.arah === arah) ?? data.tp.items[0];
  const gKey = normGate(gateName);
  const densItems = data.dens.items ?? [];
  const nearest: DensityItem | undefined =
    densItems.find((d) => normGate(d.gb_tujuan) === gKey) ??
    densItems.find((d) => normGate(d.gb_tujuan).includes(gKey) || gKey.includes(normGate(d.gb_tujuan)));
  const worst = densItems.reduce<DensityItem | undefined>(
    (acc, d) => (d.rho != null && (!acc || (acc.rho ?? -1) < d.rho) ? d : acc),
    undefined
  );
  const pv = data.pv.items.find((i) => i.arah === arah) ?? data.pv.items[0];
  const anomali = (data.anom.anomali ?? []).filter((a) => !arah || a.arah === arah);

  return (
    <>
      {/* M1 — Arus keluar */}
      <Card title="Arus Keluar" hint="Perkiraan kendaraan keluar menuju koridor ini, 1 jam terakhir.">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: "30px", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
            {fmt(tp?.vll_60m)}
          </span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>kend./jam</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <TrenArrow value={tp?.tren_60m} />
          </span>
        </div>
        <Spark data={tp?.series ?? []} color="#3b82f6" />
      </Card>

      {/* M3 — Kepadatan */}
      <Card title="Kepadatan" hint='"Terisi" = seberapa penuh gerbang dibanding kapasitasnya.'>
        {nearest ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nearest.gb_tujuan}</div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                terisi {pctFull(nearest.rho)} · {fmt(nearest.rate_now)} kend./jam
              </div>
            </div>
            <LevelBadge level={nearest.level} size="sm" />
          </div>
        ) : (
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>Data gerbang terdekat belum tersedia.</div>
        )}
        {worst && (!nearest || worst.gb_tujuan !== nearest.gb_tujuan) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)" }}>Tersibuk di koridor</div>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{worst.gb_tujuan}</div>
            </div>
            <LevelBadge level={worst.level} size="sm" />
          </div>
        )}
      </Card>

      {/* M4 — Realtime vs Prediksi */}
      <Card title="Realtime vs Prediksi" hint="Progres hari ini dibanding prediksi, dengan proyeksi sampai akhir hari.">
        {pv ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: "24px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: pv.flag_lampaui ? "#ef4444" : "var(--text)" }}>
                {pv.progres_persen != null ? `${Math.round(pv.progres_persen)}%` : "—"}
              </span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>dari prediksi hari ini</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              <span>Realisasi: <b style={{ color: "var(--text)" }}>{fmt(pv.vll_kumulatif)}</b></span>
              <span>Prediksi: <b style={{ color: "var(--text)" }}>{fmt(pv.prediksi_kend)}</b></span>
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              Proyeksi akhir hari: <b style={{ color: "var(--text)" }}>{fmt(pv.proyeksi_eod)}</b>
              {pv.flag_lampaui && <span style={{ color: "#ef4444", fontWeight: 600 }}> · berpotensi melampaui</span>}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>Prediksi belum tersedia.</div>
        )}
      </Card>

      {/* M7 — Diduga Hambatan */}
      <Card title="Diduga Hambatan" hint="Gerbang dengan pola arus mencurigakan — perlu dicek CCTV.">
        {anomali.length === 0 ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-sm)", color: "var(--sem-green, #22c55e)" }}>
            <Icon name="check" size={15} /> Tidak ada hambatan terdeteksi.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {anomali.slice(0, 4).map((a) => (
              <div key={`${a.kode_bujt}-${a.gb_tujuan}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.gb_tujuan}</div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                    {reasonText(a.reasons, "pola arus tak biasa")}
                    {a.cctv && a.cctv.length > 0 && <span> · {a.cctv.length} CCTV</span>}
                  </div>
                </div>
                <LevelBadge level="anomali" size="sm" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <UpdateTicker lag={null} style={{ opacity: loading ? 1 : 0.8 }} />
    </>
  );
}

export function ArusLalinPanel({ sel, onClose }: { sel: TrafficSel; onClose: () => void }) {
  if (sel.kind === "functional") {
    return (
      <PanelShell roadName={sel.roadName} onClose={onClose}>
        <EmptyState
          icon="construction"
          title="Ruas fungsional"
          description="Ruas ini belum beroperasi penuh, sehingga data arus lalin belum tersedia."
        />
      </PanelShell>
    );
  }
  if (sel.kind === "untracked") {
    return (
      <PanelShell roadName={sel.roadName} onClose={onClose}>
        <EmptyState
          icon="activity"
          title="Data arus belum tersedia"
          description="Ruas ini belum terhubung ke pemantauan arus lalin (belum ada gerbang terpantau di dekatnya)."
        />
      </PanelShell>
    );
  }
  return (
    <PanelShell roadName={sel.roadName} onClose={onClose}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: -6 }}>
        Koridor <b style={{ color: "var(--text)" }}>{arahLabel(sel.arah)}</b>
      </div>
      <ArahCards arah={sel.arah} gateName={sel.gateName} />
    </PanelShell>
  );
}
