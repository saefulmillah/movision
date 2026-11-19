import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Icon, Input, Modal, Pagination, Select, StatusPill, Switch } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { C, fmtInt, Kpi, Panel, StateBox, tooltipStyle } from "@/pages/operasional/insightsShared";
import { getSosHistory, getSosSummary, statusCode } from "@/lib/sosEvaluasi";
import type { SosEvalStatus, SosHistoryResult, SosHistoryRow, SosSummary } from "@/types/sosEvaluasi";
import { SOS_STATUS_META } from "@/types/sosEvaluasi";
import { TicketDetail } from "./TicketDetail";
import istyles from "@/pages/operasional/insights.module.css";
import styles from "./evaluasiSos.module.css";

/* ---------------- util tanggal & durasi ---------------- */

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso(): string {
  return iso(new Date());
}
/** Rentang default: 30 hari terakhir (termasuk hari ini). */
function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: iso(start), end: iso(end) };
}
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtTanggal(s: string | null | undefined): string {
  if (!s) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]}`;
}
function fmtTanggalJam(s: string | null | undefined): string {
  if (!s) return "–";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "–";
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${d.getDate()} ${MON[d.getMonth()]} · ${jam}`;
}
/** Detik → "m:ss". */
function fmtMmSs(sec: number | null | undefined): string {
  if (sec == null) return "–";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
/** Detik → "m:ss" bila < 1 jam, selain itu "Hj MMm". */
function fmtDur(sec: number | null | undefined): string {
  if (sec == null) return "–";
  const s = Math.max(0, Math.round(sec));
  if (s < 3600) return fmtMmSs(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}j ${String(m).padStart(2, "0")}m`;
}

/* ---------------- badge status ---------------- */

function StatusBadge({ status }: { status: SosEvalStatus }) {
  const meta = SOS_STATUS_META[status] ?? { label: status, tone: "gray" as const };
  return <StatusPill label={meta.label} tone={meta.tone} />;
}

/* ============================================================
   Halaman Evaluasi SOS — analitik penanganan SOS.
   A. Ringkasan (KPI)  B. Tren harian  C. Breakdown  D. Riwayat tiket
   ============================================================ */

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "Semua status" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_handling", label: "Ditangani" },
  { value: "completed", label: "Selesai" }
];

export function EvaluasiSosPage() {
  const init = useMemo(defaultRange, []);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [slaInput, setSlaInput] = useState("15");
  const slaMinutes = useMemo(() => {
    const n = Number(slaInput);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 15;
  }, [slaInput]);
  const [tick, setTick] = useState(0);

  const [summary, setSummary] = useState<SosSummary | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);

  /* ---- muat ringkasan ---- */
  useEffect(() => {
    let alive = true;
    setSumLoading(true);
    setSumError(null);
    getSosSummary({ start_date: start, end_date: end, sla_response_minutes: slaMinutes })
      .then((res) => { if (alive) setSummary(res); })
      .catch((e) => { if (alive) setSumError(e instanceof Error ? e.message : "Gagal memuat ringkasan"); })
      .finally(() => { if (alive) setSumLoading(false); });
    return () => { alive = false; };
  }, [start, end, slaMinutes, tick]);

  /* ---- filter riwayat ---- */
  const [status, setStatus] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [idRuas, setIdRuas] = useState("");
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // debounce pencarian
  useEffect(() => {
    const t = setTimeout(() => setSearchQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // reset halaman saat filter berubah
  useEffect(() => { setPage(1); }, [start, end, status, incidentType, idRuas, searchQ]);

  const [history, setHistory] = useState<SosHistoryResult | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  const reloadHistory = useCallback(() => {
    let alive = true;
    setHistLoading(true);
    setHistError(null);
    getSosHistory({
      start_date: start,
      end_date: end,
      status: status ? statusCode(status as SosEvalStatus) : undefined,
      incident_type: incidentType || undefined,
      id_ruas: idRuas ? Number(idRuas) : undefined,
      search: searchQ || undefined,
      page,
      limit
    })
      .then((res) => { if (alive) setHistory(res); })
      .catch((e) => { if (alive) setHistError(e instanceof Error ? e.message : "Gagal memuat riwayat"); })
      .finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [start, end, status, incidentType, idRuas, searchQ, page]);

  useEffect(() => reloadHistory(), [reloadHistory, tick]);

  // opsi filter turunan dari ringkasan
  const jenisOptions: SelectOption[] = useMemo(() => [
    { value: "", label: "Semua jenis" },
    ...(summary?.per_jenis ?? []).map((j) => ({ value: j.incident_type, label: j.incident_type }))
  ], [summary]);
  const ruasOptions: SelectOption[] = useMemo(() => [
    { value: "", label: "Semua ruas" },
    ...(summary?.per_ruas ?? []).map((r) => ({ value: String(r.id_ruas), label: r.nama_ruas || r.kode_ruas }))
  ], [summary]);

  const [drill, setDrill] = useState<string | null>(null);

  const refreshAll = () => setTick((t) => t + 1);

  return (
    <div className={istyles.page}>
      <div className={istyles.header}>
        <div className={istyles.titleBox}>
          <h1 className={istyles.title}>Evaluasi SOS</h1>
          <div className={istyles.sub}>
            Analitik penanganan SOS: response time, kepatuhan SLA, riwayat tiket, dan tren harian.
          </div>
        </div>
      </div>

      {/* Filter bersama: rentang tanggal + target SLA */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Dari</span>
        <Input type="date" icon="calendar" wrapClassName={styles.dateField} value={start} max={end || todayIso()} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Tanggal mulai" />
        <span className={styles.filterLabel}>s/d</span>
        <Input type="date" icon="calendar" wrapClassName={styles.dateField} value={end} min={start} max={todayIso()} onChange={(e) => e.target.value && setEnd(e.target.value)} aria-label="Tanggal akhir" />
        <span className={styles.filterLabel}>Target SLA (menit)</span>
        <Input type="number" icon="target" wrapClassName={styles.slaField} min={1} value={slaInput} onChange={(e) => setSlaInput(e.target.value)} aria-label="Target SLA response (menit)" />
        <span className={istyles.spacer} />
        <Button size="sm" iconOnly icon={sumLoading || histLoading ? "loader" : "refresh-cw"} title="Muat ulang" disabled={sumLoading || histLoading} onClick={refreshAll} />
      </div>

      {/* A — Ringkasan */}
      <Ringkasan data={summary} loading={sumLoading} error={sumError} slaMinutes={slaMinutes} />

      {/* B — Tren harian */}
      <TrenHarian data={summary} />

      {/* C — Breakdown */}
      {summary && (
        <div className={istyles.grid2}>
          <BreakdownJenis data={summary} />
          <BreakdownRuas data={summary} />
        </div>
      )}

      {/* D — Riwayat tiket */}
      <Panel title="Riwayat Tiket SOS" right={<span className={istyles.sub} style={{ fontSize: "var(--fs-micro, 11px)" }}>klik baris untuk melihat detail & timeline</span>}>
        <div className={styles.toolbar}>
          <Select value={status} onValueChange={setStatus} options={STATUS_OPTIONS} icon="activity" ariaLabel="Status" />
          <Select value={incidentType} onValueChange={setIncidentType} options={jenisOptions} icon="triangle-alert" ariaLabel="Jenis insiden" />
          <Select value={idRuas} onValueChange={setIdRuas} options={ruasOptions} icon="map-pin" ariaLabel="Ruas" />
          <Input icon="search" wrapClassName={styles.searchField} placeholder="Cari no. tiket / jenis…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari" />
        </div>

        <RiwayatTable data={history} loading={histLoading} error={histError} onOpen={setDrill} />

        {history?.meta && history.meta.total > 0 && (
          <div style={{ marginTop: 12 }}>
            <Pagination
              page={history.meta.page}
              pageCount={Math.max(1, history.meta.total_page)}
              from={(history.meta.page - 1) * history.meta.limit + 1}
              to={Math.min(history.meta.page * history.meta.limit, history.meta.total)}
              total={history.meta.total}
              unit="tiket"
              onPage={setPage}
            />
          </div>
        )}
      </Panel>

      {/* Drill-down detail + timeline (reuse komponen operasional) */}
      <Modal open={drill != null} onOpenChange={(o) => { if (!o) setDrill(null); }} title={drill ? `Tiket ${drill}` : "Detail tiket"} width={760}>
        <div className={styles.drillBody}>
          {drill && <TicketDetail ticketNo={drill} onChanged={refreshAll} />}
        </div>
      </Modal>
    </div>
  );
}

/* ====================== A — Ringkasan (KPI) ====================== */

function Ringkasan({ data, loading, error, slaMinutes }: { data: SosSummary | null; loading: boolean; error: string | null; slaMinutes: number }) {
  if (loading && !data) return <StateBox loading />;
  if (error) return <StateBox error={error} />;
  if (!data) return <StateBox empty emptyText="Belum ada data evaluasi untuk rentang ini." />;

  const r = data.ringkasan;
  const pct = r.sla_persen;
  const slaTone = pct == null ? undefined : pct >= 90 ? "good" : pct >= 75 ? "accent" : pct >= 50 ? "warning" : "critical";
  const slaValue = pct == null ? "–" : `${pct.toFixed(0)}%`;

  return (
    <div className={istyles.kpiRow}>
      <Kpi label="Total Tiket" value={fmtInt(r.total)} tone="accent" sub={`${fmtInt(r.dispatched)} dispatched · ${fmtInt(r.in_handling)} ditangani`} />
      <Kpi label="Selesai" value={fmtInt(r.completed)} tone="good" sub={r.total > 0 ? `${Math.round((r.completed / r.total) * 100)}% dari total` : undefined} />
      <Kpi label="Rata-rata Response Time" value={fmtMmSs(r.avg_response_seconds)} sub="menit:detik" />
      <Kpi label="Rata-rata Resolution" value={fmtDur(r.avg_resolution_seconds)} sub="alert → selesai" />
      <Kpi
        label={`Kepatuhan SLA (≤ ${slaMinutes}m)`}
        value={slaValue}
        tone={slaTone}
        sub={`${fmtInt(r.sla_terpenuhi)} / ${fmtInt(r.sla_dari)} tiket memenuhi`}
      />
    </div>
  );
}

/* ====================== B — Tren harian ====================== */

function TrenHarian({ data }: { data: SosSummary | null }) {
  const [showRt, setShowRt] = useState(true);
  if (!data) return null;
  const tren = data.tren_harian ?? [];
  const chartData = tren.map((t) => ({
    label: fmtTanggal(t.tanggal),
    jumlah: t.jumlah,
    rt: t.avg_response_seconds
  }));

  return (
    <Panel
      title="Tren Harian Tiket SOS"
      right={
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
          <Switch checked={showRt} onCheckedChange={setShowRt} /> Overlay response time
        </label>
      }
    >
      {chartData.length === 0 ? (
        <StateBox empty emptyText="Belum ada tiket pada rentang ini." />
      ) : (
        <div className={istyles.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 2, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.faint }} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={10} />
              <YAxis yAxisId="jml" tick={{ fontSize: 10, fill: C.faint }} width={36} tickLine={false} axisLine={false} allowDecimals={false} />
              {showRt && (
                <YAxis yAxisId="rt" orientation="right" tick={{ fontSize: 10, fill: C.faint }} width={48} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtMmSs(v)} />
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => (n === "Avg Response" ? [fmtMmSs(v), n] : [fmtInt(v), n])}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="jml" dataKey="jumlah" name="Jumlah Tiket" fill={C.blue} radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={650} />
              {showRt && (
                <Line yAxisId="rt" type="monotone" dataKey="rt" name="Avg Response" stroke={C.amber} strokeWidth={2.2} dot={false} connectNulls isAnimationActive animationDuration={800} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/* ====================== C — Breakdown ====================== */

function BreakdownBarRow({ name, sub, jumlah, max, avgSeconds, color }: {
  name: string; sub?: string; jumlah: number; max: number; avgSeconds: number | null; color: string;
}) {
  const w = max > 0 ? Math.max(3, Math.round((jumlah / max) * 100)) : 0;
  return (
    <tr>
      <td>
        <div className={styles.breakdownName}>{name}</div>
        {sub && <div className={styles.breakdownSub}>{sub}</div>}
      </td>
      <td className={istyles.barCell}>
        <div className={istyles.bar}><span style={{ width: `${w}%`, background: color }} /></div>
      </td>
      <td className={istyles.num} style={{ fontWeight: 700 }}>{fmtInt(jumlah)}</td>
      <td className={istyles.num}>{fmtMmSs(avgSeconds)}</td>
    </tr>
  );
}

function BreakdownJenis({ data }: { data: SosSummary }) {
  const rows = [...(data.per_jenis ?? [])].sort((a, b) => b.jumlah - a.jumlah);
  const max = rows.reduce((m, r) => Math.max(m, r.jumlah), 0);
  return (
    <Panel title="Per Jenis Insiden">
      {rows.length === 0 ? (
        <StateBox empty emptyText="Belum ada data jenis insiden." />
      ) : (
        <table className={istyles.table}>
          <thead>
            <tr>
              <th>Jenis</th>
              <th />
              <th className={istyles.num}>Jumlah</th>
              <th className={istyles.num}>Avg RT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BreakdownBarRow key={r.incident_type} name={r.incident_type} jumlah={r.jumlah} max={max} avgSeconds={r.avg_response_seconds} color={C.blue} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function BreakdownRuas({ data }: { data: SosSummary }) {
  const rows = [...(data.per_ruas ?? [])].sort((a, b) => b.jumlah - a.jumlah);
  const max = rows.reduce((m, r) => Math.max(m, r.jumlah), 0);
  return (
    <Panel title="Per Ruas">
      {rows.length === 0 ? (
        <StateBox empty emptyText="Belum ada data per ruas." />
      ) : (
        <table className={istyles.table}>
          <thead>
            <tr>
              <th>Ruas</th>
              <th />
              <th className={istyles.num}>Jumlah</th>
              <th className={istyles.num}>Avg RT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BreakdownBarRow key={r.id_ruas} name={r.nama_ruas || r.kode_ruas} sub={r.kode_ruas} jumlah={r.jumlah} max={max} avgSeconds={r.avg_response_seconds} color={C.green} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* ====================== D — Riwayat tabel ====================== */

function RiwayatTable({ data, loading, error, onOpen }: {
  data: SosHistoryResult | null; loading: boolean; error: string | null; onOpen: (ticketNo: string) => void;
}) {
  if (loading && !data) return <StateBox loading />;
  if (error) return <StateBox error={error} />;
  if (!data || data.rows.length === 0) return <StateBox empty emptyText="Tidak ada tiket untuk filter ini." />;

  return (
    <div style={{ overflow: "auto" }}>
      <table className={istyles.table}>
        <thead>
          <tr>
            <th>No. Tiket</th>
            <th>Waktu Alert</th>
            <th>Jenis</th>
            <th>Ruas</th>
            <th>Status</th>
            <th className={istyles.num}>Response</th>
            <th className={istyles.num}>Resolution</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row: SosHistoryRow) => (
            <tr key={row.ticket_no} className={styles.rowClickable} onClick={() => onOpen(row.ticket_no)}>
              <td style={{ fontWeight: 600 }}>{row.ticket_no}</td>
              <td>{fmtTanggalJam(row.alert_at)}</td>
              <td>{row.incident_type}</td>
              <td>{row.nama_ruas || row.kode_ruas || "–"}</td>
              <td><StatusBadge status={row.status} /></td>
              <td className={istyles.num}>{fmtMmSs(row.response_time_seconds)}</td>
              <td className={istyles.num}>{fmtDur(row.resolution_seconds)}</td>
              <td className={styles.chevron}><Icon name="chevron-right" size={16} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
