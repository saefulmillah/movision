import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Icon, Input, Select, Tabs, useToast } from "@/components/ui";
import type { SelectOption, TabItem } from "@/components/ui";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { getLhrKelengkapan, getLhrKelengkapanShift, getLhrTertimbang, ingestLhr, GOL_SHORT } from "@/lib/lhr";
import type {
  LhrKelengkapanResult, LhrKelengkapanRow, LhrKoridor, LhrShiftDetail, LhrShiftResult, LhrTertimbangResult
} from "@/types/lhr";
import { listKoridor } from "@/lib/lhr";
import { C, fmtInt, Kpi, Panel, StateBox, tooltipStyle } from "@/pages/operasional/insightsShared";
import { UploadAt6Modal } from "./UploadAt6Modal";
import istyles from "@/pages/operasional/insights.module.css";
import styles from "./lhr.module.css";

const GOL_COLORS: Record<number, string> = { 1: C.blue, 2: C.green, 3: C.amber, 4: C.neu, 5: C.red };

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Dari "YYYY-MM" → rentang tanggal awal–akhir bulan (dibatasi s/d hari ini). */
function monthRange(ym: string): { startDate: string; endDate: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  let end = `${ym}-${String(lastDay).padStart(2, "0")}`;
  const today = isoToday();
  if (end > today) end = today;
  return { startDate: start, endDate: end };
}
function rupiah(n: number | null | undefined): string {
  return n == null ? "–" : `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function fmtBulan(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const MON = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${MON[m - 1]} ${y}`;
}
function fmtTanggal(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]}`;
}

const TABS: TabItem[] = [
  { value: "hasil", label: "Hasil LHR", icon: "gauge" },
  { value: "kelengkapan", label: "Monitoring Kelengkapan", icon: "layout-grid" }
];

export function LhrTertimbangPage() {
  const toast = useToast();
  const access = useModuleAccess("monitoring_rekonsiliasi");

  const [koridorList, setKoridorList] = useState<LhrKoridor[]>([]);
  const [kode, setKode] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const { startDate, endDate } = useMemo(() => monthRange(month), [month]);
  const [tab, setTab] = useState("hasil");
  const [tick, setTick] = useState(0);

  const [hasil, setHasil] = useState<LhrTertimbangResult | null>(null);
  const [kelengkapan, setKelengkapan] = useState<LhrKelengkapanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    listKoridor()
      .then((list) => { setKoridorList(list); if (list.length > 0) setKode((k) => k || list[0].kode_koridor); })
      .catch(() => setKoridorList([]));
  }, []);

  const selected = useMemo(() => koridorList.find((k) => k.kode_koridor === kode) || null, [koridorList, kode]);

  const reload = useCallback(async () => {
    if (!kode) return;
    const params = { kode_koridor: kode, start_date: startDate, end_date: endDate };
    let alive = true;
    setLoading(true);
    setError(null);
    try {
      if (tab === "hasil") {
        const res = await getLhrTertimbang(params);
        if (alive) setHasil(res);
      } else {
        const res = await getLhrKelengkapan(params);
        if (alive) setKelengkapan(res);
      }
    } catch (e) {
      if (alive) setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
  }, [kode, startDate, endDate, tab]);

  useEffect(() => { void reload(); }, [reload, tick]);

  async function doIngest() {
    if (!kode) return;
    setIngesting(true);
    try {
      await ingestLhr({ kode_koridor: kode, start_date: startDate, end_date: endDate });
      toast.success("Tarik data otomatis selesai", "Data dari sistem eoj sudah diperbarui.");
      setTick((t) => t + 1);
    } catch (e) {
      toast.error("Gagal menarik data otomatis", e instanceof Error ? e.message : undefined);
    } finally {
      setIngesting(false);
    }
  }

  const koridorOptions: SelectOption[] = koridorList.map((k) => ({ value: k.kode_koridor, label: k.nama || k.kode_koridor }));

  return (
    <div className={istyles.page}>
      <div className={istyles.header}>
        <div className={istyles.titleBox}>
          <h1 className={istyles.title}>LHR Tertimbang</h1>
          <div className={istyles.sub}>
            Lalu lintas harian rata-rata per koridor, dibobot panjang seksi & golongan. Sumber: otomatis (eoj) + manual (AT6).
          </div>
        </div>
      </div>

      {/* Filter bersama: koridor + bulan */}
      <div className={styles.filterBar}>
        <Select value={kode} onValueChange={setKode} options={koridorOptions} icon="route" ariaLabel="Koridor" placeholder="Pilih koridor" />
        <span className={styles.filterLabel}>Bulan</span>
        <Input type="month" icon="calendar" wrapClassName={styles.dateField} value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Bulan" />
        <span className={istyles.spacer} />
        {access.canWrite && (
          <Button variant="secondary" icon="cloud-download" onClick={doIngest} disabled={!kode || ingesting}>
            {ingesting ? "Menarik…" : "Tarik Data Otomatis"}
          </Button>
        )}
        {access.canWrite && (
          <Button variant="primary" icon="upload" onClick={() => setUploadOpen(true)} disabled={!kode}>Upload AT6</Button>
        )}
        <Button size="sm" iconOnly icon={loading ? "loader" : "refresh-cw"} title="Muat ulang" disabled={loading} onClick={() => setTick((t) => t + 1)} />
      </div>

      <Tabs value={tab} onValueChange={setTab} items={TABS} />

      {!kode ? (
        <StateBox empty emptyText="Pilih koridor untuk menampilkan data LHR." />
      ) : tab === "hasil" ? (
        <HasilLhr data={hasil} loading={loading} error={error} />
      ) : (
        <Kelengkapan data={kelengkapan} loading={loading} error={error} canWrite={access.canWrite} onUpload={() => setUploadOpen(true)} kode={kode} startDate={startDate} endDate={endDate} />
      )}

      <UploadAt6Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        koridorList={koridorList}
        defaultKode={kode}
        onCommitted={() => setTick((t) => t + 1)}
      />

      {selected && (
        <span className={istyles.sub} style={{ fontSize: "var(--fs-micro, 11px)", marginTop: 4 }}>
          Koridor {selected.nama} · {fmtBulan(month)} · sumber otomatis {selected.eoj_source ? "tersedia" : "tidak tersedia"}.
        </span>
      )}
    </div>
  );
}

/* ====================== Bagian A — Hasil LHR ====================== */

function HasilLhr({ data, loading, error }: { data: LhrTertimbangResult | null; loading: boolean; error: string | null }) {
  if (loading && !data) return <StateBox loading />;
  if (error) return <StateBox error={error} />;
  if (!data || data.rows.length === 0) return <StateBox empty emptyText="Belum ada data LHR untuk rentang ini. Tarik data otomatis atau unggah AT6." />;

  const { rows, meta } = data;
  const avg = (key: keyof typeof rows[number]): number | null => {
    const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  // Footer rata-rata: pakai meta.rata_rata dari backend, jatuh ke rata-rata baris bila meta kosong.
  const rata = meta?.rata_rata ?? {
    gol1: avg("lhr_gol1"), gol2: avg("lhr_gol2"), gol3: avg("lhr_gol3"), gol4: avg("lhr_gol4"), gol5: avg("lhr_gol5"), total: avg("lhr_total"), pendapatan: avg("pendapatan"), pendapatan_hk: avg("pendapatan_hk")
  };
  // Sistem terbuka (JORRS/ATP): LHR = total lintasan harian (bukan tertimbang panjang); ada porsi pendapatan HK.
  const terbuka = meta?.jenis_sistem === "terbuka";
  const totalLabel = terbuka ? "LHR (Total Lintasan)" : "Total LHR";
  const chartData = rows.map((r) => ({
    label: fmtTanggal(r.tanggal),
    gol1: r.lhr_gol1 ?? 0, gol2: r.lhr_gol2 ?? 0, gol3: r.lhr_gol3 ?? 0, gol4: r.lhr_gol4 ?? 0, gol5: r.lhr_gol5 ?? 0
  }));

  return (
    <>
      <div className={istyles.kpiRow}>
        <Kpi label={terbuka ? "Rata-rata LHR (Lintasan)" : "Rata-rata Total (LHR)"} value={fmtInt(rata?.total)} tone="accent" />
        <Kpi label="Rata-rata Gol I" value={fmtInt(rata?.gol1)} />
        {!terbuka && <Kpi label="Panjang Total" value={meta?.panjang_total_km != null ? `${meta.panjang_total_km.toLocaleString("id-ID")} km` : "–"} />}
        <Kpi label="Jumlah Hari" value={fmtInt(meta?.jumlah_hari ?? rows.length)} />
        <Kpi label="Pendapatan (bulan)" value={rupiah(meta?.pendapatan_total)} tone="good" />
        {terbuka && <Kpi label="Pendapatan HK (bulan)" value={rupiah(meta?.pendapatan_hk_total)} tone="good" />}
      </div>

      <Panel
        title="Tren LHR Harian per Golongan"
        right={<span className={istyles.sub} style={{ fontSize: "var(--fs-micro, 11px)" }}>batang bertumpuk = total harian</span>}
      >
        <div className={istyles.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 10, bottom: 2, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={10} />
              <YAxis tick={{ fontSize: 10, fill: C.faint }} width={52} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtInt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtInt(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {[1, 2, 3, 4, 5].map((g, i) => (
                <Bar key={g} dataKey={`gol${g}`} name={GOL_SHORT[g]} stackId="lhr" fill={GOL_COLORS[g]} radius={i === 4 ? [3, 3, 0, 0] : undefined} maxBarSize={38} isAnimationActive animationDuration={650} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Rincian Harian">
        <div style={{ overflow: "auto" }}>
          <table className={istyles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                {[1, 2, 3, 4, 5].map((g) => <th key={g} className={istyles.num}>{GOL_SHORT[g]}</th>)}
                <th className={istyles.num}>{totalLabel}</th>
                <th className={istyles.num}>{terbuka ? "Pendapatan (gross)" : "Pendapatan"}</th>
                {terbuka && <th className={istyles.num}>Pendapatan (HK)</th>}
                <th>Sumber</th>
                <th>Kelengkapan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tanggal}>
                  <td>{fmtTanggal(r.tanggal)}</td>
                  <td className={istyles.num}>{fmtInt(r.lhr_gol1)}</td>
                  <td className={istyles.num}>{fmtInt(r.lhr_gol2)}</td>
                  <td className={istyles.num}>{fmtInt(r.lhr_gol3)}</td>
                  <td className={istyles.num}>{fmtInt(r.lhr_gol4)}</td>
                  <td className={istyles.num}>{fmtInt(r.lhr_gol5)}</td>
                  <td className={istyles.num} style={{ fontWeight: 700 }}>{fmtInt(r.lhr_total)}</td>
                  <td className={istyles.num}>{rupiah(r.pendapatan)}</td>
                  {terbuka && <td className={istyles.num}>{rupiah(r.pendapatan_hk)}</td>}
                  <td><SourceTags auto={r.ada_auto} manual={r.ada_manual} /></td>
                  <td><KelengkapanTag lengkap={r.lengkap} gerbangKosong={r.gerbang_kosong} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className={styles.foot}>
              <tr>
                <td>Rata-rata</td>
                <td className={istyles.num}>{fmtInt(rata.gol1)}</td>
                <td className={istyles.num}>{fmtInt(rata.gol2)}</td>
                <td className={istyles.num}>{fmtInt(rata.gol3)}</td>
                <td className={istyles.num}>{fmtInt(rata.gol4)}</td>
                <td className={istyles.num}>{fmtInt(rata.gol5)}</td>
                <td className={istyles.num}>{fmtInt(rata.total)}</td>
                <td className={istyles.num}>{rupiah(rata.pendapatan)}</td>
                {terbuka && <td className={istyles.num}>{rupiah(rata.pendapatan_hk)}</td>}
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
}

function KelengkapanTag({ lengkap, gerbangKosong }: { lengkap?: boolean; gerbangKosong?: string[] }) {
  if (lengkap === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  if (lengkap) {
    return <span className={`${styles.srcTag} ${styles.srcAuto}`}><Icon name="circle-check" size={11} /> Lengkap</span>;
  }
  const kosong = gerbangKosong ?? [];
  const title = kosong.length > 0 ? `Gerbang exit tanpa data: ${kosong.join(", ")}` : "Ada gerbang exit tanpa data OD pada tanggal ini.";
  return (
    <span className={`${styles.srcTag} ${styles.tagWarn}`} title={title}>
      <Icon name="triangle-alert" size={11} /> Tidak lengkap{kosong.length > 0 ? ` (${kosong.length})` : ""}
    </span>
  );
}

function SourceTags({ auto, manual }: { auto: boolean; manual: boolean }) {
  if (!auto && !manual) return <span className={`${styles.srcTag} ${styles.srcNone}`}>kosong</span>;
  return (
    <span className={styles.srcTags}>
      {auto && <span className={`${styles.srcTag} ${styles.srcAuto}`}><Icon name="cpu" size={11} /> Auto</span>}
      {manual && <span className={`${styles.srcTag} ${styles.srcManual}`}><Icon name="file-spreadsheet" size={11} /> Manual</span>}
    </span>
  );
}

/* ====================== Bagian B — Monitoring Kelengkapan ====================== */

function Kelengkapan({ data, loading, error, canWrite, onUpload, kode, startDate, endDate }: {
  data: LhrKelengkapanResult | null; loading: boolean; error: string | null; canWrite: boolean; onUpload: () => void;
  kode: string; startDate: string; endDate: string;
}) {
  const [gol, setGol] = useState("all");
  const [selGerbang, setSelGerbang] = useState<string | null>(null);
  const [shift, setShift] = useState<LhrShiftResult | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Reset pilihan gerbang saat koridor/bulan berganti.
  useEffect(() => { setSelGerbang(null); setShift(null); }, [kode, startDate, endDate]);

  // Ambil breakdown per shift saat satu gerbang dipilih.
  useEffect(() => {
    if (!selGerbang || !kode) { setShift(null); return; }
    let alive = true;
    setShiftLoading(true);
    setShiftError(null);
    getLhrKelengkapanShift({ kode_koridor: kode, kode_gerbang: selGerbang, start_date: startDate, end_date: endDate })
      .then((res) => { if (alive) setShift(res); })
      .catch((e) => { if (alive) setShiftError(e instanceof Error ? e.message : "Gagal memuat rincian shift"); })
      .finally(() => { if (alive) setShiftLoading(false); });
    return () => { alive = false; };
  }, [selGerbang, kode, startDate, endDate]);

  if (loading && !data) return <StateBox loading />;
  if (error) return <StateBox error={error} />;
  if (!data || !data.meta) return <StateBox empty emptyText="Belum ada data kelengkapan untuk rentang ini." />;

  const { rows, meta } = data;
  const gerbang = meta.gerbang_aktif;
  const r = meta.ringkasan;
  const pct = r?.persen_lengkap ?? 0;
  const pctClass = pct >= 90 ? styles.pctGood : pct >= 70 ? styles.pctWarn : styles.pctBad;

  // Apakah backend sudah mengirim jumlah per golongan? Bila belum, sel jatuh ke penanda A/M/·.
  const hasJumlah = rows.some((row) => row.jumlah && Object.keys(row.jumlah).length > 0);
  const golOptions: SelectOption[] = [
    { value: "all", label: "Semua golongan" },
    ...[1, 2, 3, 4, 5].map((g) => ({ value: String(g), label: GOL_SHORT[g] }))
  ];
  const golLabel = gol === "all" ? "Total" : GOL_SHORT[Number(gol)];

  function statusOf(row: LhrKelengkapanRow, kode: string): "auto" | "manual" | "kosong" {
    if (row.terisi_auto.includes(kode)) return "auto";
    if (row.terisi_manual.includes(kode)) return "manual";
    return "kosong";
  }
  // Status sel termasuk "sebagian" (belum lengkap) dari field backend — supaya kuning tampil di awal tanpa expand.
  function cellStatus(row: LhrKelengkapanRow, kode: string): "auto" | "manual" | "sebagian" | "kosong" {
    if (row.kosong.includes(kode)) return "kosong";
    if (row.terisi_sebagian?.includes(kode)) return "sebagian";
    return statusOf(row, kode);
  }
  function cellJumlah(row: LhrKelengkapanRow, kode: string): number | null {
    const j = row.jumlah?.[kode];
    if (!j) return null;
    return gol === "all" ? j.total : (j[`gol${gol}` as keyof typeof j] as number | null);
  }

  // Data shift (on-demand) untuk baris gerbang yang sedang di-expand.
  const shiftMap = new Map((shift?.rows ?? []).map((sr) => [sr.tanggal, sr] as const));
  const shiftList = shift?.meta?.shift_list ?? [1, 2, 3];
  const shiftManual = (shift?.rows ?? []).some((sr) => sr.sumber_lhr === "manual");
  function shiftVal(sh: LhrShiftDetail): number | null {
    return gol === "all" ? sh.total : (sh[`gol${gol}` as keyof LhrShiftDetail] as number | null);
  }
  // Kelengkapan shift pada satu tanggal: full (semua ada) / partial (sebagian kosong) / empty / null (tak ada data).
  function shiftState(tanggal: string): "full" | "partial" | "empty" | null {
    const sr = shiftMap.get(tanggal);
    if (!sr) return null;
    const kos = sr.shift_kosong?.length ?? sr.shifts.filter((s) => s.status === "kosong").length;
    const tot = shiftList.length || sr.shifts.length;
    if (kos >= tot) return "empty";
    if (kos > 0) return "partial";
    return "full";
  }

  return (
    <>
      <div className={istyles.kpiRow}>
        <Kpi label="Kelengkapan" value={<span className={`${styles.pctBadge} ${pctClass}`}>{pct.toFixed(0)}<span style={{ fontSize: 13 }}>%</span></span>} />
        <Kpi label="Terisi Otomatis" value={fmtInt(r?.auto)} tone="good" />
        <Kpi label="Terisi Manual" value={fmtInt(r?.manual)} tone="accent" />
        {r?.sebagian != null && <Kpi label="Belum Lengkap" value={fmtInt(r.sebagian)} tone={r.sebagian > 0 ? "warning" : undefined} />}
        <Kpi label="Sel Kosong" value={fmtInt(r?.kosong)} tone={r && r.kosong > 0 ? "critical" : undefined} />
      </div>

      <Panel
        title="Matriks Kelengkapan (gerbang exit × tanggal)"
        right={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {hasJumlah && (
              <Select value={gol} onValueChange={setGol} options={golOptions} icon="layers" ariaLabel="Golongan" />
            )}
            <span className={styles.legend}>
              <span><span className={`${styles.dot} ${styles.cAuto}`} /> Auto</span>
              <span><span className={`${styles.dot} ${styles.cManual}`} /> Manual</span>
              <span><span className={`${styles.dot} ${styles.cPartial}`} /> Belum lengkap</span>
              <span><span className={`${styles.dot} ${styles.cKosong}`} /> Kosong</span>
            </span>
          </span>
        }
      >
        {rows.length === 0 || gerbang.length === 0 ? (
          <StateBox empty emptyText="Tidak ada gerbang/tanggal aktif." />
        ) : (
          <>
            <div className={styles.matrixWrap}>
              <table className={styles.matrix}>
                <thead>
                  <tr>
                    <th className={styles.dateCol}>Gerbang</th>
                    {rows.map((row) => <th key={row.tanggal}>{fmtTanggal(row.tanggal)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {gerbang.map((g) => {
                    const expanded = selGerbang === g.kode;
                    return (
                      <Fragment key={g.kode}>
                        <tr className={expanded ? styles.rowSel : undefined}>
                          <td
                            className={`${styles.dateCol} ${styles.gerbangCell}`}
                            title={`${g.nama} — klik untuk rincian per shift`}
                            onClick={() => setSelGerbang((cur) => (cur === g.kode ? null : g.kode))}
                          >
                            <Icon name={expanded ? "chevron-down" : "chevron-right"} size={12} /> {g.kode}
                          </td>
                          {rows.map((row) => {
                            // Status awal dari backend (termasuk "sebagian" = kuning). Saat di-expand & ada data shift,
                            // dipertegas dari rincian shift (full/partial/empty).
                            const cs = cellStatus(row, g.kode);
                            const ss = expanded ? shiftState(row.tanggal) : null;
                            const base = cs === "sebagian" ? styles.cPartial
                              : cs === "kosong" ? styles.cKosong
                              : cs === "manual" ? styles.cManual : styles.cAuto;
                            const cls = ss === "partial" ? styles.cPartial
                              : ss === "empty" ? styles.cKosong
                              : ss === "full" ? styles.cAuto
                              : base;
                            const val = cellJumlah(row, g.kode);
                            const content = cs === "kosong"
                              ? "·"
                              : hasJumlah
                                ? (val == null ? "–" : fmtInt(val))
                                : (cs === "manual" ? "M" : "A");
                            const label = cs === "sebagian" ? "belum lengkap" : cs;
                            const title = `${g.nama} · ${fmtTanggal(row.tanggal)} — ${label}${hasJumlah ? ` · ${golLabel}: ${val == null ? "–" : fmtInt(val)}` : ""}`;
                            return (
                              <td key={row.tanggal}>
                                <span className={`${styles.cell} ${cls}`} title={title}>{content}</span>
                              </td>
                            );
                          })}
                        </tr>
                        {expanded && shiftLoading && (
                          <tr className={styles.shiftSubRow}>
                            <td className={`${styles.dateCol} ${styles.shiftLabel}`}>Shift</td>
                            <td colSpan={rows.length} style={{ textAlign: "left", color: "var(--text-muted)" }}>Memuat rincian shift…</td>
                          </tr>
                        )}
                        {expanded && !shiftLoading && shiftError && (
                          <tr className={styles.shiftSubRow}>
                            <td className={`${styles.dateCol} ${styles.shiftLabel}`}>Shift</td>
                            <td colSpan={rows.length} style={{ textAlign: "left", color: "var(--sem-red, #ef4444)" }}>{shiftError}</td>
                          </tr>
                        )}
                        {expanded && !shiftLoading && !shiftError && shift && shift.rows.length === 0 && (
                          <tr className={styles.shiftSubRow}>
                            <td className={`${styles.dateCol} ${styles.shiftLabel}`}>Shift</td>
                            <td colSpan={rows.length} style={{ textAlign: "left", color: "var(--text-muted)" }}>Tidak ada rincian shift untuk gerbang ini.</td>
                          </tr>
                        )}
                        {expanded && !shiftLoading && !shiftError && shift && shift.rows.length > 0 && shiftList.map((n) => (
                          <tr key={`${g.kode}-sh${n}`} className={styles.shiftSubRow}>
                            <td className={`${styles.dateCol} ${styles.shiftLabel}`}>Shift {n}</td>
                            {rows.map((row) => {
                              const sr = shiftMap.get(row.tanggal);
                              const sh = sr?.shifts.find((s) => s.shift === n);
                              const kosong = !sh || sh.status === "kosong";
                              const v = sh ? shiftVal(sh) : null;
                              // Pastel, dibedakan per sumber hari itu: auto (hijau) / manual (biru) / kosong (merah).
                              const scls = kosong ? styles.cKosongSoft : sr?.sumber_lhr === "manual" ? styles.cManualSoft : styles.cAutoSoft;
                              const srcLabel = kosong ? "kosong" : sr?.sumber_lhr === "manual" ? "ada · manual" : "ada · auto";
                              return (
                                <td key={row.tanggal}>
                                  <span className={`${styles.cell} ${scls}`} title={`${g.nama} · ${fmtTanggal(row.tanggal)} · Shift ${n} — ${srcLabel}`}>
                                    {kosong ? "·" : (v == null ? "–" : fmtInt(v))}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={istyles.sub} style={{ fontSize: "var(--fs-micro, 11px)", marginTop: 8 }}>
              {hasJumlah
                ? `Angka = jumlah lalu lintas per ${golLabel.toLowerCase()} di tiap gerbang. Klik nama gerbang untuk membuka rincian per shift (Shift ${shiftList.join("/")}).`
                : "Klik nama gerbang untuk membuka rincian per shift."}
              {selGerbang ? " Baris shift memakai warna pastel (hijau muda = auto, biru muda = manual, merah muda = kosong)." : ""}
              {selGerbang && shift?.meta?.catatan ? ` ${shift.meta.catatan}` : ""}
              {selGerbang && shiftManual ? " Baris bersumber manual (AT6) tidak memiliki rincian shift — angka shift hanya referensi eoj." : ""}
            </div>
          </>
        )}
      </Panel>

      <div className={istyles.grid2}>
        <Panel title="Cara Melengkapi Data Kosong">
          <div className={styles.howGrid}>
            {(meta.cara_melengkapi.length > 0 ? meta.cara_melengkapi : [
              "Hubungi integrator agar data eoj dikirim ulang.",
              "Unggah laporan AT6 (.xls) secara manual sebagai cadangan."
            ]).map((t, i) => (
              <div key={i} className={styles.howCard}>
                <span className={styles.howIcon}><Icon name={i === 0 ? "phone-call" : "upload"} size={16} /></span>
                <span className={styles.howText}>{t}</span>
              </div>
            ))}
          </div>
          {canWrite && (
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" icon="upload" onClick={onUpload}>Upload AT6 Sekarang</Button>
            </div>
          )}
        </Panel>

        <Panel title="Sel Kosong" right={<span className={istyles.sub} style={{ fontSize: "var(--fs-micro, 11px)" }}>{fmtInt(meta.kosong_detail.length)} sel</span>}>
          {meta.kosong_detail.length === 0 ? (
            <StateBox empty emptyText="Semua sel sudah terisi. 🎉" />
          ) : (
            <div className={styles.kosongList}>
              {meta.kosong_detail.map((k, i) => (
                <div key={`${k.tanggal}-${k.kode_gerbang}-${i}`} className={styles.kosongRow}>
                  <span>{k.nama} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({k.kode_gerbang})</span></span>
                  <span>{fmtTanggal(k.tanggal)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
