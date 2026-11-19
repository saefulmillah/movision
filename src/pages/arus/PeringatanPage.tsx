import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, HlsVideo, Icon } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import { trafficFlow, arahLabel, levelMeta, type AnomalyResp, type AnomalyItem, type Cctv } from "@/lib/trafficFlow";
import { LevelBadge, fmt, pctFull, Hint } from "./parts";
import styles from "@/pages/modules.module.css";

const BUSY = new Set(["anomali", "data", "kritis", "padat"]);
const keyOf = (g: { kode_bujt: string; gb_tujuan: string }) => `${g.kode_bujt}|${g.gb_tujuan}`;

export function PeringatanPage() {
  const { data, loading, error } = usePolling<AnomalyResp>(useCallback(() => trafficFlow.anomaly(), []), 60000);

  const alerts = useMemo(() => {
    const items = data?.items ?? [];
    return items
      .filter((it) => BUSY.has(it.status))
      .sort((a, b) => sev(b) - sev(a));
  }, [data]);

  const [selKey, setSelKey] = useState<string | null>(null);
  const [cams, setCams] = useState<Cctv[]>([]);
  const [activeCam, setActiveCam] = useState(0);
  const [camLoading, setCamLoading] = useState(false);

  // Auto-pilih peringatan pertama.
  useEffect(() => {
    if (!selKey && alerts.length) setSelKey(keyOf(alerts[0]));
  }, [alerts, selKey]);

  const selected = alerts.find((a) => keyOf(a) === selKey) ?? null;

  useEffect(() => {
    if (!selected) { setCams([]); return; }
    let alive = true;
    setCamLoading(true);
    setActiveCam(0);
    trafficFlow.cctv({ gb_tujuan: selected.gb_tujuan })
      .then((r) => { if (alive) setCams(r.items.flatMap((g) => g.cctv)); })
      .catch(() => { if (alive) setCams([]); })
      .finally(() => { if (alive) setCamLoading(false); });
    return () => { alive = false; };
  }, [selKey, selected]);

  return (
    <div className={`${styles.page} ${styles.pageFlow}`}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Peringatan & CCTV</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Gerbang yang padat atau diduga terhambat. Pilih salah satu untuk memverifikasi lewat kamera CCTV.</span>
        </div>
        <span className={styles.headSpacer} />
        <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>{alerts.length} perlu perhatian</span>
      </div>

      <Hint style={{ margin: "0 0 4px" }}>Daftar di kiri urut dari paling serius. Pilih gerbang untuk melihat detail dan kamera CCTV-nya. Semua masih dugaan — pastikan lewat kamera.</Hint>
      <div className={styles.body} style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: "var(--sp-4)", minHeight: 0 }}>
        {/* Daftar peringatan */}
        <div className={styles.tableCard} style={{ overflow: "auto", padding: 8 }}>
          {error && !data ? (
            <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} />
          ) : alerts.length === 0 ? (
            <EmptyState icon="shield-check" title={loading ? "Memuat…" : "Semua aman"} description="Tak ada gerbang padat atau diduga hambatan." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {alerts.map((a) => {
                const active = keyOf(a) === selKey;
                return (
                  <button key={keyOf(a)} type="button" onClick={() => setSelKey(keyOf(a))}
                    style={{
                      textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                      borderRadius: "var(--r-xl, 12px)", cursor: "pointer",
                      border: `1px solid ${active ? levelMeta(a.status).color : "var(--line)"}`,
                      background: active ? `${levelMeta(a.status).color}14` : "var(--surface-2)"
                    }}>
                    <Icon name={a.severitas === "tinggi" ? "triangle-alert" : "alert-circle"} size={18} style={{ color: levelMeta(a.status).color }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.gb_tujuan}</span>
                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{arahLabel(a.arah)}</span>
                    </span>
                    <LevelBadge level={a.status} size="sm" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail + CCTV */}
        <div className={styles.tableCard} style={{ overflow: "auto", padding: 16 }}>
          {!selected ? (
            <EmptyState icon="cctv" title="Pilih gerbang" description="Pilih peringatan di kiri untuk melihat kamera & detail." />
          ) : (
            <Detail item={selected} cams={cams} activeCam={activeCam} setActiveCam={setActiveCam} camLoading={camLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

function sev(a: AnomalyItem): number {
  const base = a.status === "anomali" ? 40 : a.status === "kritis" ? 30 : a.status === "data" ? 25 : a.status === "padat" ? 20 : 0;
  return base + (a.severitas === "tinggi" ? 5 : 0);
}

function Detail({ item, cams, activeCam, setActiveCam, camLoading }:
  { item: AnomalyItem; cams: Cctv[]; activeCam: number; setActiveCam: (i: number) => void; camLoading: boolean }) {
  const cam = cams[activeCam];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: "var(--fs-md)" }}>{item.gb_tujuan}</strong>
        <LevelBadge level={item.status} />
        <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>{arahLabel(item.arah)} · {item.kode_bujt}</span>
      </div>

      {item.reasons?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.reasons.map((r) => (
            <span key={r} style={{ fontSize: "var(--fs-xs)", padding: "2px 8px", borderRadius: 999, background: "var(--surface-3, var(--surface-2))", border: "1px solid var(--line)" }}>{reasonLabel(r)}</span>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <Metric label="Terisi sekarang" value={pctFull(item.rho)} />
        <Metric label="Terisi 1 jam lalu" value={pctFull(item.rho_prev)} />
        <Metric label="Penurunan arus" value={item.drop_ratio != null ? `${Math.round((1 - item.drop_ratio) * 100)}%` : "—"} sub="dibanding 1 jam lalu" />
        <Metric label="Waktu tempuh" value={item.avg_tt_now != null ? `${item.avg_tt_now} mnt` : "—"} sub={item.avg_tt_base != null ? `biasanya ${item.avg_tt_base} mnt` : undefined} />
      </div>

      {/* Kamera */}
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="cctv" size={16} /> Kamera Gerbang {cams.length > 0 ? `(${cams.length})` : ""}
        </div>
        {camLoading ? (
          <EmptyState icon="cctv" title="Memuat kamera…" />
        ) : cams.length === 0 ? (
          <EmptyState icon="video-off" title="Tak ada kamera terpetakan" description="Petakan kamera gerbang ini lewat Setelan / data CCTV." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <HlsVideo url={cam?.stream_url ?? null} active />
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: 6 }}>
                {cam?.name}{cam?.is_gate ? " · kamera gerbang" : ""}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflow: "auto" }}>
              {cams.map((c, i) => (
                <button key={c.id} type="button" onClick={() => setActiveCam(i)}
                  style={{
                    textAlign: "left", padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${i === activeCam ? "var(--st-blue, #3b82f6)" : "var(--line)"}`,
                    background: i === activeCam ? "var(--st-blue-weak, rgba(59,130,246,.12))" : "var(--surface-2)",
                    fontSize: "var(--fs-xs)", display: "flex", alignItems: "center", gap: 6
                  }}>
                  {c.is_gate && <Icon name="door-open" size={13} />}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-xl, 12px)", padding: "10px 12px" }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? fmt(value) : value}</div>
      {sub && <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  prior_saturasi: "Sempat penuh",
  drop_tajam: "Arus mendadak anjlok",
  lokal_koridor_sehat: "Hanya gerbang ini (jalur lain normal)",
  waktu_tempuh_naik: "Waktu tempuh naik"
};
function reasonLabel(r: string): string {
  return REASON_LABEL[r] ?? r;
}
