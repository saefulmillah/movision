import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Select, Input, Button, useToast } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { HlsVideo } from "@/components/ui/HlsVideo";
import { usePolling } from "@/lib/usePolling";
import { trafficFlow, levelMeta, arahLabel, KONDISI_META } from "@/lib/trafficFlow";
import type { DensityItem, ThroughputItem, Cctv, ObservasiRow, KondisiObservasi } from "@/lib/trafficFlow";
import styles from "./observasi.module.css";

const KONDISI_OPTS = [
  { value: "lancar", label: "Lancar — tidak ada antrian" },
  { value: "antri_ringan", label: "Antri ringan — 1 gardu, pendek" },
  { value: "antri_sedang", label: "Antri sedang — beberapa gardu" },
  { value: "antri_parah", label: "Antri parah — panjang/meluber" }
];

const LEVEL_SEV: Record<string, number> = { lancar: 0, ramai: 1, padat: 2, kritis: 3 };
const KONDISI_SEV: Record<string, number> = { lancar: 0, antri_ringan: 1, antri_sedang: 2, antri_parah: 3 };

function gateKey(d: { kode_bujt: string; gb_tujuan: string; arah: string }) {
  return `${d.kode_bujt}|${d.gb_tujuan}|${d.arah}`;
}

/** Bandingkan observasi vs snapshot model → tanda divergensi (under/over). */
function divergence(kondisi: string, snapLevel: string | null): string | null {
  const obs = KONDISI_SEV[kondisi] ?? 0;
  const mod = snapLevel ? LEVEL_SEV[snapLevel] ?? null : null;
  if (mod == null) return null;
  if (obs >= 1 && mod <= 0) return "model kurang"; // ada antri tapi model lancar
  if (obs === 0 && mod >= 2) return "model lebih"; // lancar tapi model padat/kritis
  return null;
}

function Badge({ color, label, title }: { color: string; label: string; title?: string }) {
  return (
    <span className={styles.badge} style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }} title={title}>
      <span className={styles.dot} style={{ background: color }} />
      {label}
    </span>
  );
}

export function ObservasiPage() {
  const toast = useToast();
  const densityQ = usePolling(() => trafficFlow.density(), 30000);
  const throughputQ = usePolling(() => trafficFlow.throughput({ group: "gerbang", series_hours: 3 }), 60000);

  const gates = useMemo<DensityItem[]>(
    () =>
      (densityQ.data?.items ?? [])
        .slice()
        .sort((a, b) => a.arah.localeCompare(b.arah) || a.gb_tujuan.localeCompare(b.gb_tujuan)),
    [densityQ.data]
  );

  const [selKey, setSelKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selKey && gates.length) setSelKey(gateKey(gates[0]));
  }, [gates, selKey]);

  const sel = useMemo(() => gates.find((g) => gateKey(g) === selKey) ?? null, [gates, selKey]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? gates.filter((g) => g.gb_tujuan.toLowerCase().includes(q)) : gates;
    const m = new Map<string, DensityItem[]>();
    for (const g of list) (m.get(g.arah) ?? m.set(g.arah, []).get(g.arah)!).push(g);
    return [...m.entries()];
  }, [gates, search]);

  const series = useMemo<ThroughputItem | null>(() => {
    if (!sel) return null;
    return (
      (throughputQ.data?.items ?? []).find(
        (it) =>
          it.kode_bujt === sel.kode_bujt &&
          String(it.gb_tujuan ?? "").toUpperCase() === String(sel.gb_tujuan).toUpperCase()
      ) ?? null
    );
  }, [throughputQ.data, sel]);

  // ---- CCTV gerbang terpilih ----
  const [cams, setCams] = useState<Cctv[]>([]);
  const [camActive, setCamActive] = useState(0);
  const [camLoading, setCamLoading] = useState(false);
  useEffect(() => {
    if (!sel) {
      setCams([]);
      return;
    }
    let alive = true;
    setCamLoading(true);
    setCamActive(0);
    trafficFlow
      .cctv({ gb_tujuan: sel.gb_tujuan })
      .then((r) => {
        if (alive) setCams(r.items.flatMap((g) => g.cctv));
      })
      .catch(() => {
        if (alive) setCams([]);
      })
      .finally(() => {
        if (alive) setCamLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.kode_bujt, sel?.gb_tujuan]);

  // ---- Riwayat observasi gerbang terpilih ----
  const [obs, setObs] = useState<ObservasiRow[]>([]);
  const loadObs = useCallback(() => {
    if (!sel) {
      setObs([]);
      return;
    }
    trafficFlow
      .observasiList({ kode_bujt: sel.kode_bujt, gb_tujuan: sel.gb_tujuan, limit: 50 })
      .then((r) => setObs(r.items))
      .catch(() => setObs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.kode_bujt, sel?.gb_tujuan]);
  useEffect(() => {
    loadObs();
  }, [loadObs]);

  // ---- Form ----
  const [kondisi, setKondisi] = useState<KondisiObservasi>("lancar");
  const [garduAntri, setGarduAntri] = useState("0");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await trafficFlow.observasiCreate({
        kode_bujt: sel.kode_bujt,
        gb_tujuan: sel.gb_tujuan,
        arah: sel.arah,
        kondisi,
        gardu_antri: Number(garduAntri) || 0,
        catatan: catatan.trim() || undefined
      });
      toast.success("Observasi tersimpan", "Status model saat ini ikut direkam untuk perbandingan.");
      setCatatan("");
      setGarduAntri("0");
      setKondisi("lancar");
      loadObs();
    } catch (e) {
      toast.error("Gagal menyimpan observasi", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [sel, kondisi, garduAntri, catatan, toast, loadObs]);

  const maxVll = useMemo(() => Math.max(1, ...(series?.series ?? []).map((s) => s.vll)), [series]);
  const cam = cams[camActive];

  return (
    <div className={styles.page}>
      {/* Panel kiri: pilih gerbang */}
      <aside className={styles.left}>
        <div className={styles.leftHead}>
          <div className={styles.leftTitle}>Observasi Gerbang</div>
          <div className={styles.leftSub}>Bandingkan CCTV nyata dengan status kepadatan</div>
        </div>
        <div className={styles.searchBox}>
          <Icon name="search" size={15} style={{ color: "var(--text-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari gerbang…" />
        </div>
        <div className={styles.gateList}>
          {densityQ.loading && gates.length === 0 ? (
            <EmptyState icon="git-commit-horizontal" title="Memuat gerbang…" />
          ) : grouped.length === 0 ? (
            <EmptyState icon="search" title="Tidak ada gerbang" />
          ) : (
            grouped.map(([arah, list]) => (
              <div key={arah}>
                <div className={styles.groupHdr}>{arahLabel(arah)}</div>
                {list.map((g) => {
                  const meta = levelMeta(g.level);
                  return (
                    <div
                      key={gateKey(g)}
                      className={styles.gateItem}
                      data-active={gateKey(g) === selKey}
                      onClick={() => setSelKey(gateKey(g))}
                    >
                      <span className={styles.gateName}>{g.gb_tujuan}</span>
                      <Badge color={meta.color} label={meta.label} />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Konten utama */}
      <div className={styles.main}>
        {!sel ? (
          <EmptyState icon="clipboard-check" title="Pilih gerbang" description="Pilih gerbang di panel kiri untuk mulai observasi." />
        ) : (
          <>
            <div className={styles.mainHead}>
              <span className={styles.mainTitle}>{sel.gb_tujuan}</span>
              <span className={styles.mainArah}>· {arahLabel(sel.arah)}</span>
              <Badge color={levelMeta(sel.level).color} label={`Status model: ${levelMeta(sel.level).label}`} />
            </div>

            <div className={styles.grid}>
              {/* Kolom kiri: CCTV */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <Icon name="cctv" size={15} /> CCTV Gerbang
                  <span className={styles.spacer} />
                  {cams.length > 0 && <span style={{ fontSize: "var(--fs-micro)", color: "var(--text-muted)" }}>{cams.length} kamera</span>}
                </div>
                {camLoading ? (
                  <EmptyState icon="cctv" title="Memuat kamera…" />
                ) : cams.length === 0 ? (
                  <EmptyState icon="video-off" title="Tak ada kamera terpetakan" description="Gerbang ini belum terhubung ke kamera di modul arus lalin." />
                ) : (
                  <>
                    <HlsVideo url={cam?.stream_url ?? null} active />
                    <div className={styles.camList}>
                      {cams.map((c, i) => (
                        <button key={c.id} type="button" className={styles.camBtn} data-active={i === camActive || undefined} onClick={() => setCamActive(i)}>
                          {c.is_gate && <Icon name="door-open" size={12} />}
                          <span className={styles.camBtnText}>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Kolom kanan: status model + timeline + form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <Icon name="gauge" size={15} /> Status Kepadatan (model)
                  </div>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>Level</span>
                      <Badge color={levelMeta(sel.level).color} label={levelMeta(sel.level).label} />
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>ρ (okupansi)</span>
                      <span className={styles.rhoBig} style={{ color: levelMeta(sel.level).color }}>
                        {sel.rho == null ? "—" : sel.rho.toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>Laju 60m / kapasitas</span>
                      <span className={styles.metricVal}>
                        {sel.rate_now} / {sel.kapasitas_jam}
                      </span>
                      {sel.kapasitas_desain ? (
                        <span className={styles.metricSub}>desain {sel.kapasitas_desain} · {sel.pct_desain != null ? `${Math.round(sel.pct_desain)}%` : "—"} dari desain</span>
                      ) : null}
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>Waktu tempuh</span>
                      <span className={styles.metricVal}>{sel.avg_tt_now != null ? `${sel.avg_tt_now.toFixed(0)} mnt` : "—"}</span>
                      {sel.tt_ratio != null ? <span className={styles.metricSub}>rasio {sel.tt_ratio.toFixed(2)}×</span> : null}
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>Bukti antri</span>
                      <span className={styles.metricVal}>{sel.antri ? "Ya" : "Tidak"}</span>
                      {sel.antri_alasan?.length ? <span className={styles.metricSub}>{sel.antri_alasan.join(", ")}</span> : null}
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricKey}>Data terakhir</span>
                      <span className={styles.metricVal} style={{ fontSize: 13 }}>{sel.last_bin ?? "—"}</span>
                    </div>
                  </div>

                  {/* Timeline per-bin 15 menit */}
                  {series && series.series.length > 0 && (
                    <>
                      <div className={styles.metricKey} style={{ marginTop: 12 }}>Volume per-15 menit (3 jam)</div>
                      <div className={styles.timeline}>
                        {series.series.map((s, i) => (
                          <div
                            key={s.bin15}
                            className={styles.bar}
                            data-last={i === series.series.length - 1 || undefined}
                            style={{ height: `${Math.max(3, (s.vll / maxVll) * 100)}%` }}
                            title={`${s.bin15} · ${s.vll} kend`}
                          />
                        ))}
                      </div>
                      <div className={styles.tlAxis}>
                        <span>{series.series[0]?.bin15?.slice(-5)}</span>
                        <span>{series.series[series.series.length - 1]?.bin15?.slice(-5)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Form observasi */}
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <Icon name="clipboard-check" size={15} /> Catat Observasi (yang kamu lihat di CCTV)
                  </div>
                  <div className={styles.form}>
                    <div className={styles.formRow}>
                      <span className={styles.formLabel}>Kondisi teramati</span>
                      <Select value={kondisi} onValueChange={(v) => setKondisi(v as KondisiObservasi)} options={KONDISI_OPTS} ariaLabel="Kondisi teramati" />
                    </div>
                    <div className={styles.formRow}>
                      <span className={styles.formLabel}>Jumlah gardu antri</span>
                      <Input type="number" min={0} value={garduAntri} onChange={(e) => setGarduAntri(e.target.value)} />
                    </div>
                    <div className={styles.formRow}>
                      <span className={styles.formLabel}>Catatan (opsional)</span>
                      <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. antri exit gardu 3–4, hujan" />
                    </div>
                    <p className={styles.hint}>
                      Saat disimpan, status model saat ini (level {levelMeta(sel.level).label.toLowerCase()}, ρ {sel.rho == null ? "—" : sel.rho.toFixed(2)}) ikut
                      direkam otomatis sebagai pasangan pembanding.
                    </p>
                    <Button variant="primary" size="sm" icon="save" onClick={submit} disabled={saving}>
                      {saving ? "Menyimpan…" : "Simpan observasi"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat observasi */}
            <div className={styles.histWrap}>
              <div className={styles.cardHead}>
                <Icon name="history" size={15} /> Riwayat Observasi — {sel.gb_tujuan}
              </div>
              {obs.length === 0 ? (
                <EmptyState icon="clipboard-check" title="Belum ada observasi" description="Catat observasi pertama di form atas." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.histTable}>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Teramati (CCTV)</th>
                        <th>Gardu antri</th>
                        <th>Status model saat itu</th>
                        <th>ρ</th>
                        <th>Catatan</th>
                        <th>Oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obs.map((o) => {
                        const dv = divergence(o.kondisi, o.snap_level);
                        const km = KONDISI_META[o.kondisi];
                        const lm = levelMeta(o.snap_level);
                        return (
                          <tr key={o.id} data-diverge={dv ? "true" : undefined}>
                            <td style={{ whiteSpace: "nowrap" }}>{o.observed_at}</td>
                            <td>
                              <Badge color={km.color} label={km.label} />
                              {dv && <span className={styles.divergeTag}>⚠ {dv}</span>}
                            </td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{o.gardu_antri}</td>
                            <td>{o.snap_level ? <Badge color={lm.color} label={lm.label} /> : "—"}</td>
                            <td style={{ fontFamily: "var(--font-mono)" }}>{o.snap_rho == null ? "—" : Number(o.snap_rho).toFixed(2)}</td>
                            <td className={styles.note}>{o.catatan || "—"}</td>
                            <td style={{ color: "var(--text-muted)", fontSize: "var(--fs-micro)", whiteSpace: "nowrap" }}>{o.observer_name || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
