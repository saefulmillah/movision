import type { CSSProperties } from "react";
import { Bar, BarChart, Customized, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import { PendapatanKpiCards } from "@/pages/rapat-direktorat/pendapatan/PendapatanKpiCards";
import type { PeriodData, RuasBar } from "@/types/pendapatan";
import { toOperationalRuas } from "@/lib/ruasAlias";
import styles from "./PendapatanOverviewSlide.module.css";

/* ============================================================
   Slide overview Pendapatan: KPI cards + 2 grafik pencapaian per ruas
   (RKAP vs Realisasi). Grafik memakai Recharts — sama dengan slide Rapat
   Direktorat lain (Rencana Pendapatan, LHR/PHR vs BP) — agar konsisten.
   Badge %ACH per ruas & band/pemisah regional digambar via <Customized>
   sehingga tetap berada di sistem koordinat chart.
   ============================================================ */

interface PendapatanOverviewSlideProps {
  data: PeriodData | null;
  periodLabel: string;
  /** Label scope aktif (regional/cabang); null/undefined untuk divisi. */
  scopeLabel?: string | null;
  /** Pengali ukuran font label grafik (1 = normal). */
  fontScale?: number;
}

export function PendapatanOverviewSlide({ data, periodLabel, scopeLabel, fontScale = 1 }: PendapatanOverviewSlideProps) {
  if (!data) {
    return (
      <SlideFrame title="Pendapatan Tol dan Lainnya">
        <div className={styles.stateBox}>
          <EmptyState icon="inbox" title="Data pendapatan tidak tersedia" description="Belum ada snapshot Pendapatan untuk periode ini." />
        </div>
      </SlideFrame>
    );
  }

  const monthLabel = data.meta.period_label_month;
  // periodLabel kini berawalan "s.d " (diseragamkan di context); judul grafik sudah
  // menambah "s.d " sendiri, jadi buang prefiks agar tak dobel ("s.d s.d ...").
  const sdLabel = data.meta.period_label_sd || periodLabel.replace(/^s\.d\s+/i, "");
  const periodForTitle = monthLabel || sdLabel;
  const scoped = Boolean(data.meta.scoped);
  const fromDataset = data.meta.tol_source === "lr_dataset";

  return (
    <SlideFrame
      title="Pendapatan Tol dan Lainnya"
      rightMeta={
        <>
          Pendapatan <b>(dalam juta)</b>
        </>
      }
      scopeLabel={scopeLabel}
      footnote={
        fromDataset
          ? "KPI (Tol, Usaha Lainnya, Total) & Pendapatan Tol per ruas mengikuti dataset kinerja lingkup terpilih; LHR per ruas dari evaluasi divisi."
          : scoped
            ? "Pendapatan Tol (kumulatif s.d) mengikuti lingkup terpilih; Usaha Lainnya, Total, dan kolom Periode Ini pada tingkat Divisi."
            : undefined
      }
    >
      <div className={styles.kpiWrap}>
        <PendapatanKpiCards
          kpiMonth={data.kpi_month}
          kpiSd={data.kpi_sd}
          monthLabel={monthLabel}
          sdLabel={sdLabel}
          unit="juta"
          presentation
        />
      </div>

      <div className={styles.charts}>
        <ChartPanel title={`Pencapaian LHR s.d ${periodForTitle}`} data={data.lhr} ariaLabel="Grafik pencapaian LHR per ruas" fs={fontScale} />
        <ChartPanel title={`Pencapaian Pendapatan Tol s.d ${periodForTitle}`} data={data.pendapatan_ruas} ariaLabel="Grafik pencapaian pendapatan per ruas" fs={fontScale} />
      </div>
    </SlideFrame>
  );
}

function ChartPanel({ title, data, ariaLabel, fs = 1 }: { title: string; data: RuasBar[]; ariaLabel: string; fs?: number }) {
  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <span className={styles.chartSpacer} />
        <span className={styles.legend}>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swRkap}`} />
            RKAP
          </span>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swReal}`} />
            Realisasi
          </span>
          <span className={styles.legItem}>
            <span className={styles.dots}>
              <span className={styles.d} style={{ background: "var(--sem-green)" }} />
              <span className={styles.d} style={{ background: "var(--sem-amber)" }} />
              <span className={styles.d} style={{ background: "var(--sem-red)" }} />
            </span>
            % Pencapaian
          </span>
        </span>
      </div>
      <div className={styles.chartBody}>
        <AchievementBars data={data} ariaLabel={ariaLabel} fs={fs} />
      </div>
    </div>
  );
}

/* ----------------------- Grafik (Recharts) ----------------------- */

const C = { rkap: "#7e97c4", rkapLine: "#5f79ad", real: "#e0a32e", axis: "#334155", region: "#64748b", sep: "#dbe2ec" };
const tipStyle: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 11, color: "#1f2d3f", padding: "4px 8px" };
const idFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function achFill(ach: number): string {
  if (ach >= 100) return "var(--sem-green)";
  if (ach >= 90) return "var(--sem-amber)";
  return "var(--sem-red)";
}
function achInk(ach: number): string {
  return ach >= 90 && ach < 100 ? "#2a2118" : "#fff";
}
function regionLabel(reg: string | null): string {
  if (!reg) return "";
  return reg === "JKT" ? "JKT" : `REG ${reg}`;
}

function AchievementBars({ data, ariaLabel, fs = 1 }: { data: RuasBar[]; ariaLabel: string; fs?: number }) {
  if (!data.length) {
    return <EmptyState icon="inbox" title="Belum ada realisasi" description="Tidak ada ruas berrealisasi pada periode ini." />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 26, right: 10, bottom: 24, left: 10 }} barGap={2} barCategoryGap="30%" role="img" aria-label={ariaLabel}>
        <XAxis dataKey="ruas" tickFormatter={toOperationalRuas} tick={{ fontSize: Math.round(9 * fs), fontWeight: 700, fill: C.axis }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval={0} height={16} />
        <YAxis hide domain={[0, (max: number) => max * 1.18]} />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.1)" }}
          contentStyle={tipStyle}
          labelFormatter={(label, payload) => {
            const p = payload && payload[0] && (payload[0].payload as RuasBar);
            return p ? `${toOperationalRuas(p.ruas)} · ${p.ach}%` : String(label);
          }}
          formatter={(v: number, n: string) => [idFmt.format(v), n]}
        />
        <Bar dataKey="rkap" name="RKAP" fill={C.rkap} stroke={C.rkapLine} strokeWidth={1} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={650}>
          <LabelList dataKey="rkap" content={topLabel(C.rkapLine, fs)} />
        </Bar>
        <Bar dataKey="real" name="Realisasi" fill={C.real} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={650}>
          <LabelList dataKey="real" content={topLabel("#a06d10", fs)} />
        </Bar>
        <Customized component={AchOverlay} rows={data} fs={fs} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Label nilai di atas ujung batang.
function topLabel(color: string, fs = 1) {
  return (props: { x?: number | string; y?: number | string; width?: number | string; value?: number | string | null }) => {
    const v = props.value == null ? null : Number(props.value);
    if (v == null || !Number.isFinite(v) || Math.round(v) === 0) return null;
    const x = Number(props.x) || 0;
    const y = Number(props.y) || 0;
    const width = Number(props.width) || 0;
    return (
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={Math.round(8 * fs)} fontWeight={700} fill={color} style={{ fontVariantNumeric: "tabular-nums" }}>
        {idFmt.format(v)}
      </text>
    );
  };
}

// Overlay (via <Customized>): badge %ACH per ruas + pemisah & label regional.
// Menerima scale sumbu dari chart sehingga posisi selaras batang.
interface OverlayProps {
  rows?: RuasBar[];
  fs?: number;
  xAxisMap?: Record<string, { scale?: AxisScale }>;
  yAxisMap?: Record<string, { scale?: AxisScale }>;
  offset?: { top: number; left: number; width: number; height: number };
}
type AxisScale = ((value: number | string) => number | undefined) & { bandwidth?: () => number; step?: () => number };

function AchOverlay({ rows, fs = 1, xAxisMap, yAxisMap, offset }: OverlayProps) {
  if (!rows || !rows.length || !xAxisMap || !yAxisMap || !offset) return null;
  const xScale = xAxisMap[Object.keys(xAxisMap)[0]]?.scale;
  const yScale = yAxisMap[Object.keys(yAxisMap)[0]]?.scale;
  if (!xScale || !yScale || typeof xScale.bandwidth !== "function") return null;

  const bw = xScale.bandwidth();
  const step = typeof xScale.step === "function" ? xScale.step() : bw;
  const baseY = offset.top + offset.height;

  const bands: { reg: string; start: number; end: number }[] = [];
  rows.forEach((d, i) => {
    const reg = d.regional ?? "";
    const last = bands[bands.length - 1];
    if (last && last.reg === reg) last.end = i;
    else bands.push({ reg, start: i, end: i });
  });

  return (
    <g>
      {/* Pemisah antar regional */}
      {rows.map((d, i) => {
        if (i === 0 || d.regional === rows[i - 1].regional) return null;
        const left = xScale(d.ruas);
        if (left == null) return null;
        const sx = left - (step - bw) / 2;
        return <line key={`sep-${i}`} x1={sx} y1={offset.top - 6} x2={sx} y2={baseY + 32} stroke={C.sep} strokeDasharray="3 3" />;
      })}

      {/* Badge %ACH di atas batang tertinggi tiap ruas */}
      {rows.map((d, i) => {
        const left = xScale(d.ruas);
        if (left == null) return null;
        const cx = left + bw / 2;
        const topBar = Math.min(yScale(d.rkap) ?? baseY, yScale(d.real) ?? baseY);
        const py = Math.max(topBar - 8, offset.top + 4);
        const text = `${d.ach}%`;
        const badgeFs = Math.round(11 * fs);
        const pw = text.length * 6.6 * fs + 12;
        const ph = Math.round(16 * fs);
        return (
          <g key={`ach-${i}`}>
            <rect x={cx - pw / 2} y={py - ph + 4} width={pw} height={ph} rx={ph / 2} fill={achFill(d.ach)} />
            <text x={cx} y={py} textAnchor="middle" fontSize={badgeFs} fontWeight={800} fill={achInk(d.ach)}>
              {text}
            </text>
          </g>
        );
      })}

      {/* Label regional */}
      {bands.map((b, i) => {
        const l = xScale(rows[b.start].ruas);
        const r = xScale(rows[b.end].ruas);
        if (l == null || r == null) return null;
        const cx = (l + r + bw) / 2;
        return (
          <text key={`reg-${i}`} x={cx} y={baseY + 30} textAnchor="middle" fontSize={Math.round(10 * fs)} fontWeight={700} fill={C.region}>
            {regionLabel(b.reg)}
          </text>
        );
      })}
    </g>
  );
}
