import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Button, Icon, Input } from "@/components/ui";
import { C, compact, fmtInt, Kpi, Panel, StateBox, tooltipStyle } from "@/pages/operasional/insightsShared";
import { getManagementSummary } from "@/lib/dashboardManajemen";
import type {
  ButuhPerhatianItem,
  DashOperasional,
  ManagementSummary,
  Severitas,
  SumberBermasalah
} from "@/types/dashboardManajemen";
import istyles from "@/pages/operasional/insights.module.css";
import styles from "./dashboardManajemen.module.css";

/* ---------------- util tanggal, durasi & angka ---------------- */

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso(): string {
  return iso(new Date());
}
/** Rentang preset dihitung dari hari ini (termasuk hari ini). */
function rangeForDays(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { start: iso(start), end: iso(end) };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtTanggal(s: string | null | undefined): string {
  if (!s) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]}`;
}
function fmtRangeLabel(start: string, end: string): string {
  return `${fmtTanggal(start)} – ${fmtTanggal(end)}`;
}
/** Detik → "m:ss". */
function fmtMmSs(sec: number | null | undefined): string {
  if (sec == null) return "–";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
/** Rupiah penuh locale id-ID. */
function fmtRp(n: number | null | undefined): string {
  if (n == null) return "–";
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
/** Rupiah ringkas: "Rp 46,8 M". */
function fmtRpCompact(n: number | null | undefined): string {
  if (n == null) return "–";
  return `Rp ${compact(n)}`;
}

/* ---------------- preset periode ---------------- */

type PresetKey = "today" | "7d" | "30d" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "custom", label: "Kustom" }
];

/* ---------------- drill-down "Butuh Perhatian" ---------------- */

const PERHATIAN_ROUTE: Record<string, string> = {
  wim: "/wim/monitoring",
  gerbang: "/",
  cctv: "/cctv",
  sos: "/sos/evaluasi",
  rekonsiliasi: "/operasional/lhr-tertimbang"
};

const SEV_META: Record<Severitas, { label: string; icon: string }> = {
  tinggi: { label: "Tinggi", icon: "triangle-alert" },
  sedang: { label: "Sedang", icon: "circle-alert" },
  rendah: { label: "Rendah", icon: "info" }
};

/* ============================================================
   Dashboard Manajemen — ringkasan eksekutif lintas modul.
   Status Saat Ini (real-time) · Ringkasan Periode (KPI + delta) ·
   Butuh Perhatian · Tren lalin/pendapatan · Top ruas · Ringkasan SOS.
   ============================================================ */

export function DashboardManajemenPage() {
  const init = useMemo(() => rangeForDays(7), []);
  const [preset, setPreset] = useState<PresetKey>("7d");
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [tick, setTick] = useState(0);

  const [data, setData] = useState<ManagementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pilih preset → set rentang.
  function applyPreset(key: PresetKey) {
    setPreset(key);
    if (key === "today") {
      const t = todayIso();
      setStart(t);
      setEnd(t);
    } else if (key === "7d") {
      const r = rangeForDays(7);
      setStart(r.start);
      setEnd(r.end);
    } else if (key === "30d") {
      const r = rangeForDays(30);
      setStart(r.start);
      setEnd(r.end);
    }
    // "custom" → biarkan pengguna mengatur lewat input tanggal.
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getManagementSummary({ start_date: start, end_date: end })
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Gagal memuat ringkasan");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [start, end, tick]);

  const refresh = () => setTick((t) => t + 1);
  const sb: SumberBermasalah =
    data?.sumber_bermasalah ?? { monitoring_operasi: false, wim: false, sos: false, rekonsiliasi: false };

  return (
    <div className={istyles.page}>
      <div className={istyles.header}>
        <div className={istyles.titleBox}>
          <h1 className={istyles.title}>Dashboard Manajemen</h1>
          <div className={istyles.sub}>
            Ringkasan eksekutif lintas modul: pendapatan &amp; lalin, SOS, kesehatan aset, dan hal yang butuh perhatian.
          </div>
        </div>
      </div>

      {/* Selektor periode */}
      <div className={styles.periodBar}>
        <div className={styles.presetGroup} role="group" aria-label="Preset periode">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${styles.presetBtn} ${preset === p.key ? styles.presetActive : ""}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className={styles.customDates}>
            <Input
              type="date"
              icon="calendar"
              wrapClassName={styles.dateField}
              value={start}
              max={end || todayIso()}
              onChange={(e) => e.target.value && setStart(e.target.value)}
              aria-label="Tanggal mulai"
            />
            <span className={istyles.sub}>s/d</span>
            <Input
              type="date"
              icon="calendar"
              wrapClassName={styles.dateField}
              value={end}
              min={start}
              max={todayIso()}
              onChange={(e) => e.target.value && setEnd(e.target.value)}
              aria-label="Tanggal akhir"
            />
          </div>
        )}
        <span className={istyles.spacer} />
        <span className={styles.rangeChip}>
          <Icon name="calendar-range" size={14} /> {fmtRangeLabel(start, end)}
        </span>
        <Button
          size="sm"
          iconOnly
          icon={loading ? "loader" : "refresh-cw"}
          title="Muat ulang"
          disabled={loading}
          onClick={refresh}
        />
      </div>

      {error && !data && <StateBox error={error} />}
      {loading && !data && <SkeletonLoading />}

      {data && (
        <>
          {/* ===== Status Saat Ini (real-time) ===== */}
          <SectionHeading icon="radio" title="Status Saat Ini" sub="Snapshot operasional real-time (tidak mengikuti periode)" />
          <OperasionalPanel op={data.operasional} degraded={sb.monitoring_operasi} wimDegraded={sb.wim} />

          {/* ===== Ringkasan Periode (KPI + delta) ===== */}
          <SectionHeading
            icon="chart-column"
            title="Ringkasan Periode"
            sub={`${fmtRangeLabel(data.periode.start_date, data.periode.end_date)} · ${data.periode.hari} hari · dibanding ${fmtRangeLabel(
              data.periode.pembanding.start_date,
              data.periode.pembanding.end_date
            )}`}
          />
          <KpiRow data={data} sb={sb} />

          {/* ===== Butuh Perhatian ===== */}
          <ButuhPerhatianPanel items={data.butuh_perhatian} />

          {/* ===== Tren lalin & pendapatan ===== */}
          <TrenLalinPendapatan data={data} degraded={sb.rekonsiliasi} />

          {/* ===== Top ruas + ringkasan SOS ===== */}
          <div className={istyles.grid2}>
            <TopRuasPanel data={data} degraded={sb.rekonsiliasi} />
            <SosMiniPanel data={data} degraded={sb.sos} />
          </div>
        </>
      )}
    </div>
  );
}

/* ====================== heading seksi ====================== */

function SectionHeading({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className={styles.sectionHead}>
      <Icon name={icon} size={16} className={styles.sectionIcon} />
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {sub && <div className={styles.sectionSub}>{sub}</div>}
      </div>
    </div>
  );
}

/* ====================== badge delta ====================== */

function DeltaBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) return null;
  const up = value > 0;
  const flat = value === 0;
  // invert → naik itu buruk (mis. insiden SOS).
  const bad = flat ? false : invert ? up : !up;
  const cls = flat ? styles.deltaFlat : bad ? styles.deltaBad : styles.deltaGood;
  const arrow = flat ? "—" : up ? "▲" : "▼";
  return (
    <span className={cls}>
      {arrow} {Math.abs(value).toFixed(1).replace(".", ",")}%
    </span>
  );
}

const VS_PREV = "vs periode sebelumnya";

/* ====================== degradasi ====================== */

function DegradedCard({ label, source }: { label: string; source: string }) {
  return (
    <div className={`${istyles.kpi} ${styles.kpiDegraded}`}>
      <div className={istyles.kpiLabel}>{label}</div>
      <div className={styles.degradedValue}>
        <Icon name="plug-zap" size={16} /> Tidak tersedia
      </div>
      <div className={istyles.kpiSub}>data {source} gagal dimuat</div>
    </div>
  );
}

/* ====================== KPI row ====================== */

function KpiRow({ data, sb }: { data: ManagementSummary; sb: SumberBermasalah }) {
  const k = data.kpi;
  return (
    <div className={istyles.kpiRow}>
      {/* Pendapatan */}
      {sb.rekonsiliasi ? (
        <DegradedCard label="Pendapatan" source="rekonsiliasi" />
      ) : (
        <Kpi
          label="Pendapatan"
          tone="good"
          value={fmtRpCompact(k.pendapatan.nilai)}
          sub={
            <SubDelta delta={k.pendapatan.delta_persen} prev={fmtRpCompact(k.pendapatan.sebelumnya)} />
          }
        />
      )}

      {/* Lalin */}
      {sb.rekonsiliasi ? (
        <DegradedCard label="Lalin" source="rekonsiliasi" />
      ) : (
        <Kpi
          label="Lalu Lintas"
          tone="accent"
          value={compact(k.lalin.nilai)}
          sub={<SubDelta delta={k.lalin.delta_persen} prev={compact(k.lalin.sebelumnya)} suffix="kendaraan" />}
        />
      )}

      {/* Insiden SOS */}
      {sb.sos ? (
        <DegradedCard label="Insiden SOS" source="SOS" />
      ) : (
        <div className={`${istyles.kpi} ${istyles.kpi_critical}`}>
          <div className={istyles.kpiLabel}>Insiden SOS</div>
          <div className={istyles.kpiValue}>{fmtInt(k.insiden_sos.nilai)}</div>
          <div className={styles.kpiMetaRow}>
            <DeltaBadge value={k.insiden_sos.delta_persen} invert />
            <span className={styles.kpiMetaMuted}>{VS_PREV}</span>
          </div>
          <div className={styles.sosMiniStats}>
            <span title="Masih terbuka">
              <Icon name="circle-dot" size={12} /> {fmtInt(k.insiden_sos.terbuka)} terbuka
            </span>
            <span title="Rata-rata response time">
              <Icon name="timer" size={12} /> {fmtMmSs(k.insiden_sos.avg_response_seconds)}
            </span>
            <span title="Kepatuhan SLA response">
              <Icon name="shield-check" size={12} />{" "}
              {k.insiden_sos.sla_persen == null ? "–" : `${Math.round(k.insiden_sos.sla_persen)}%`} SLA
            </span>
          </div>
        </div>
      )}

      {/* Kesehatan aset */}
      <AsetCard data={data} sb={sb} />
    </div>
  );
}

function SubDelta({ delta, prev, suffix }: { delta: number | null; prev: string; suffix?: string }) {
  return (
    <span className={styles.subDelta}>
      <span className={styles.subDeltaTop}>
        <DeltaBadge value={delta} /> <span className={styles.kpiMetaMuted}>{VS_PREV}</span>
      </span>
      <span className={styles.kpiMetaMuted}>
        sebelumnya {prev}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </span>
  );
}

function AsetCard({ data, sb }: { data: ManagementSummary; sb: SumberBermasalah }) {
  const a = data.kpi.aset;
  const asetRow = (label: string, online: number, offline: number, warnWhenOffline = true) => {
    const bad = warnWhenOffline && offline > 0;
    return (
      <div className={styles.asetRow}>
        <span className={styles.asetLabel}>{label}</span>
        <span className={styles.asetVal}>
          <b>{fmtInt(online)}</b> on
          <span className={bad ? styles.asetOff : styles.asetOffMuted}> · {fmtInt(offline)} off</span>
        </span>
      </div>
    );
  };
  return (
    <div className={`${istyles.kpi} ${styles.asetCard}`}>
      <div className={istyles.kpiLabel}>Kesehatan Aset</div>
      <div className={styles.asetGrid}>
        {sb.wim ? (
          <div className={styles.asetRow}>
            <span className={styles.asetLabel}>WIM</span>
            <span className={styles.asetOffMuted}>tidak tersedia</span>
          </div>
        ) : (
          asetRow("WIM", a.wim_online, a.wim_offline)
        )}
        {asetRow("CCTV", a.cctv_online, a.cctv_offline)}
        {asetRow("VMS", a.vms_online, a.vms_offline)}
        <div className={styles.asetRow}>
          <span className={styles.asetLabel}>Gerbang alert</span>
          <span className={a.gerbang_alert > 0 ? styles.asetOff : styles.asetOffMuted}>
            <b>{fmtInt(a.gerbang_alert)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ====================== Status Saat Ini (operasional) ====================== */

function StatChip({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: "good" | "warning" | "critical" }) {
  return (
    <div className={`${styles.statChip} ${tone ? styles[`chip_${tone}`] : ""}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function OperasionalPanel({ op, degraded, wimDegraded }: { op: DashOperasional; degraded: boolean; wimDegraded: boolean }) {
  if (degraded) {
    return (
      <Panel>
        <div className={styles.degradedBox}>
          <Icon name="plug-zap" size={18} /> Data monitoring operasi tidak tersedia saat ini.
        </div>
      </Panel>
    );
  }
  return (
    <Panel>
      <div className={styles.statGrid}>
        <StatChip label="Ruas Aktif" value={fmtInt(op.ruas.active)} sub={`dari ${fmtInt(op.ruas.total)} ruas`} />
        <StatChip
          label="CCTV Online"
          value={fmtInt(op.cctv.online)}
          sub={`${fmtInt(op.cctv.offline)} offline`}
          tone={op.cctv.offline > 0 ? "warning" : "good"}
        />
        <StatChip
          label="VMS Online"
          value={fmtInt(op.vms.online)}
          sub={`${fmtInt(op.vms.offline)} offline`}
          tone={op.vms.offline > 0 ? "warning" : "good"}
        />
        <StatChip
          label="Gerbang Alert"
          value={fmtInt(op.gates.alerts)}
          sub={`${fmtInt(op.gates.error)} error · ${fmtInt(op.gates.offline)} offline`}
          tone={op.gates.alerts > 0 ? "critical" : "good"}
        />
        <StatChip label="Kendaraan Live" value={fmtInt(op.vehicles.live)} sub={`${fmtInt(op.vehicles.moving)} bergerak`} />
        <StatChip
          label="SOS Terbuka"
          value={fmtInt(op.sos_terbuka)}
          sub="butuh penanganan"
          tone={op.sos_terbuka > 0 ? "critical" : "good"}
        />
        {wimDegraded ? (
          <StatChip label="Site WIM" value="–" sub="data tidak tersedia" />
        ) : (
          <StatChip
            label="Site WIM Online"
            value={fmtInt(op.wim.online_sites)}
            sub={`${fmtInt(op.wim.offline_sites)} offline · ${fmtInt(op.wim.warning_sites)} warning`}
            tone={op.wim.offline_sites > 0 ? "warning" : "good"}
          />
        )}
      </div>
    </Panel>
  );
}

/* ====================== Butuh Perhatian ====================== */

function ButuhPerhatianPanel({ items }: { items: ButuhPerhatianItem[] }) {
  return (
    <Panel title="Butuh Perhatian" right={<span className={istyles.sub} style={{ fontSize: 11 }}>{items.length} hal</span>}>
      {items.length === 0 ? (
        <div className={styles.allNormal}>
          <Icon name="circle-check" size={18} /> Semua normal — tidak ada hal yang perlu perhatian.
        </div>
      ) : (
        <ul className={styles.perhatianList}>
          {items.map((it, i) => (
            <PerhatianRow key={`${it.tipe}-${i}`} item={it} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PerhatianRow({ item }: { item: ButuhPerhatianItem }) {
  const meta = SEV_META[item.severitas] ?? SEV_META.rendah;
  const route = PERHATIAN_ROUTE[item.tipe];
  const body = (
    <>
      <span className={`${styles.sevDot} ${styles[`sev_${item.severitas}`]}`} aria-hidden />
      <Icon name={meta.icon} size={15} className={styles.perhatianIcon} />
      <div className={styles.perhatianText}>
        <div className={styles.perhatianTitle}>{item.judul}</div>
        {item.detail && <div className={styles.perhatianDetail}>{item.detail}</div>}
      </div>
      {item.nilai != null && item.nilai !== "" && <span className={styles.perhatianNilai}>{item.nilai}</span>}
      {route && <Icon name="chevron-right" size={16} className={styles.perhatianChevron} />}
    </>
  );
  return (
    <li className={`${styles.perhatianRow} ${styles[`row_${item.severitas}`]}`}>
      {route ? (
        <Link to={route} className={styles.perhatianLink} title={`Buka ${item.tipe}`}>
          {body}
        </Link>
      ) : (
        <div className={styles.perhatianLink}>{body}</div>
      )}
    </li>
  );
}

/* ====================== Tren lalin & pendapatan ====================== */

function TrenLalinPendapatan({ data, degraded }: { data: ManagementSummary; degraded: boolean }) {
  const tren = data.lalin_pendapatan.tren_harian ?? [];
  const chartData = tren.map((t) => ({
    label: fmtTanggal(t.tanggal),
    rp: t.total_rp,
    lln: t.total_lln
  }));
  return (
    <Panel title="Tren Lalin & Pendapatan">
      {degraded ? (
        <div className={styles.degradedBox}>
          <Icon name="plug-zap" size={18} /> Data rekonsiliasi tidak tersedia.
        </div>
      ) : chartData.length === 0 ? (
        <StateBox empty emptyText="Belum ada data tren pada rentang ini." />
      ) : (
        <div className={istyles.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
              <defs>
                <linearGradient id="dmGradRp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={12} />
              <YAxis
                yAxisId="rp"
                tick={{ fontSize: 10, fill: C.faint }}
                width={52}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => compact(v)}
              />
              <YAxis
                yAxisId="lln"
                orientation="right"
                tick={{ fontSize: 10, fill: C.faint }}
                width={46}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => compact(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => (n === "Pendapatan" ? [fmtRp(v), n] : [fmtInt(v), n])}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                yAxisId="rp"
                type="monotone"
                dataKey="rp"
                name="Pendapatan"
                stroke={C.green}
                strokeWidth={2.2}
                fill="url(#dmGradRp)"
                isAnimationActive
                animationDuration={750}
              />
              <Line
                yAxisId="lln"
                type="monotone"
                dataKey="lln"
                name="Lalu Lintas"
                stroke={C.blue}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive
                animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/* ====================== Top ruas ====================== */

function TopRuasPanel({ data, degraded }: { data: ManagementSummary; degraded: boolean }) {
  const rows = data.lalin_pendapatan.per_ruas ?? [];
  const maxRp = rows.reduce((m, r) => Math.max(m, r.total_rp), 0);
  return (
    <Panel title="Top Ruas (Pendapatan)">
      {degraded ? (
        <div className={styles.degradedBox}>
          <Icon name="plug-zap" size={18} /> Data rekonsiliasi tidak tersedia.
        </div>
      ) : rows.length === 0 ? (
        <StateBox empty emptyText="Belum ada data per ruas." />
      ) : (
        <div style={{ overflow: "auto" }}>
          <table className={istyles.table}>
            <thead>
              <tr>
                <th>Ruas</th>
                <th />
                <th className={istyles.num}>Lalin</th>
                <th className={istyles.num}>Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = maxRp > 0 ? Math.max(3, Math.round((r.total_rp / maxRp) * 100)) : 0;
                return (
                  <tr key={r.id_ruas}>
                    <td>
                      <div className={styles.ruasName}>{r.nama_ruas || r.kode_ruas}</div>
                      {r.nama_ruas && <div className={styles.ruasSub}>{r.kode_ruas}</div>}
                    </td>
                    <td className={istyles.barCell}>
                      <div className={istyles.bar}>
                        <span style={{ width: `${w}%`, background: C.green }} />
                      </div>
                    </td>
                    <td className={istyles.num}>{fmtInt(r.total_lln)}</td>
                    <td className={istyles.num} style={{ fontWeight: 700 }} title={fmtRp(r.total_rp)}>
                      {fmtRpCompact(r.total_rp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ====================== Ringkasan SOS mini ====================== */

function SosMiniPanel({ data, degraded }: { data: ManagementSummary; degraded: boolean }) {
  const r = data.sos.ringkasan;
  const tren = data.sos.tren_harian ?? [];
  const chartData = tren.map((t) => ({ label: fmtTanggal(t.tanggal), jumlah: t.jumlah, rt: t.avg_response_seconds }));
  return (
    <Panel
      title="Ringkasan SOS"
      right={
        <Link to="/sos/evaluasi" className={styles.panelLink}>
          Evaluasi SOS <Icon name="arrow-up-right" size={14} />
        </Link>
      }
    >
      {degraded ? (
        <div className={styles.degradedBox}>
          <Icon name="plug-zap" size={18} /> Data SOS tidak tersedia.
        </div>
      ) : (
        <>
          <div className={styles.sosStatRow}>
            <StatChip label="Total Tiket" value={fmtInt(r.total)} sub={`${fmtInt(r.completed)} selesai`} />
            <StatChip label="Avg Response" value={fmtMmSs(r.avg_response_seconds)} sub="menit:detik" />
            <StatChip
              label="Kepatuhan SLA"
              value={r.sla_persen == null ? "–" : `${Math.round(r.sla_persen)}%`}
              sub={`${fmtInt(r.sla_terpenuhi)}/${fmtInt(r.sla_dari)} tiket`}
              tone={r.sla_persen == null ? undefined : r.sla_persen >= 90 ? "good" : r.sla_persen >= 50 ? "warning" : "critical"}
            />
          </div>
          {chartData.length > 0 && (
            <div className={styles.sosChart}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 6, right: 8, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={12} />
                  <YAxis yAxisId="jml" tick={{ fontSize: 10, fill: C.faint }} width={30} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    yAxisId="rt"
                    orientation="right"
                    tick={{ fontSize: 10, fill: C.faint }}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => fmtMmSs(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, n: string) => (n === "Avg Response" ? [fmtMmSs(v), n] : [fmtInt(v), n])}
                  />
                  <Bar yAxisId="jml" dataKey="jumlah" name="Jumlah Tiket" fill={C.blue} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="rt" type="monotone" dataKey="rt" name="Avg Response" stroke={C.amber} strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/* ====================== skeleton loading ====================== */

function SkeletonLoading() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={`${styles.skel} ${styles.skelBar}`} />
      <div className={istyles.kpiRow}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${styles.skel} ${styles.skelKpi}`} />
        ))}
      </div>
      <div className={`${styles.skel} ${styles.skelPanel}`} />
    </div>
  );
}
