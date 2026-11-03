import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { CSSProperties, ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import type { LhrPhrEvalData, RuasEval, TrafficSeries } from "@/lib/lhrPhrEval";
import { toOperationalRuas } from "@/lib/ruasAlias";
import styles from "./LhrPhrBpSlide.module.css";

/* ============================================================
   Slide "Evaluasi Pencapaian LHR & PHR terhadap Business Plan" (handoff 05).
   Hanya scope regional. Satu baris nama ruas di atas, lalu 3 section (LHR vs BP,
   PHR vs BP, Komposisi Golongan vs BP) — tiap section 1 KARTU per ruas, kolom
   menyesuaikan jumlah ruas (tanpa wrap) agar kartu lega & label terbaca.
   ============================================================ */

interface Props {
  data: LhrPhrEvalData | null;
  periodLabel: string;
  scopeLabel?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const C = { navy: "#16315d", teal: "#2d7d93", realLight: "#9ec5d2", bpRed: "#cf3a3f", amber: "#e0a43b", grid: "#eef2f7", axis: "#94a3b8" };
const tipStyle: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 11, color: "#1f2d3f", padding: "4px 8px" };

const idNum = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const fmt = (v: number | null | undefined) => (v == null ? "–" : idNum.format(Math.round(v)));
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}rb` : String(Math.round(v)));

type Tier = { color: string; bg: string; border: string; arrow: string };
function tier(ach: number | null): Tier {
  if (ach == null) return { color: "var(--text-muted)", bg: "var(--surface-2)", border: "var(--line)", arrow: "" };
  if (ach >= 100) return { color: "#15934e", bg: "#eaf6ef", border: "#c9e9d5", arrow: "▲" };
  return { color: "#cf3a3f", bg: "#fcebec", border: "#f5ccce", arrow: "▼" };
}

export function LhrPhrBpSlide({ data, periodLabel, scopeLabel }: Props) {
  if (!data || data.ruas.length === 0) {
    return (
      <SlideFrame title="Evaluasi Pencapaian LHR & PHR" subtitle="Terhadap Business Plan" scopeLabel={scopeLabel}>
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Data LHR/PHR belum tersedia"
            description="Unggah file LHR (dengan kolom per Golongan, BP PHR) di menu Pendapatan untuk lingkup & periode ini."
          />
        </div>
      </SlideFrame>
    );
  }

  const reportIdx = (data.report_month || 1) - 1;
  const monthAbbr = MONTHS[reportIdx] || "";
  const cols: CSSProperties = { gridTemplateColumns: `repeat(${data.ruas.length}, minmax(0, 1fr))` };

  return (
    <SlideFrame
      title="Evaluasi Pencapaian LHR & PHR"
      subtitle="Terhadap Business Plan"
      scopeLabel={scopeLabel}
      rightMeta={<b>{periodLabel}</b>}
    >
      {/* Nama ruas (satu baris, selaras kolom kartu) */}
      <div className={styles.band} style={cols}>
        {data.ruas.map((r) => (
          <div key={r.ruas} className={styles.chip}>
            <span className={styles.dot} />
            <span className={styles.chipName}>{toOperationalRuas(r.ruas)}</span>
          </div>
        ))}
      </div>

      <Section title="LHR TERHADAP BUSINESS PLAN" legend={<MonthLegend monthAbbr={monthAbbr} />}>
        <div className={styles.cards} style={cols}>
          {data.ruas.map((r) => (
            <MonthlyCard key={r.ruas} series={r.lhr} reportIdx={reportIdx} monthAbbr={monthAbbr} />
          ))}
        </div>
      </Section>

      <Section title="PHR TERHADAP BUSINESS PLAN" legend={<MonthLegend monthAbbr={monthAbbr} />}>
        <div className={styles.cards} style={cols}>
          {data.ruas.map((r) => (
            <MonthlyCard key={r.ruas} series={r.phr} reportIdx={reportIdx} monthAbbr={monthAbbr} />
          ))}
        </div>
      </Section>

      <Section
        title="KOMPOSISI GOLONGAN TERHADAP BUSINESS PLAN"
        legend={
          <span className={styles.legend}>
            <Lg c={C.navy} t="BP" />
            <Lg c={C.teal} t="Realisasi" />
            <Lg c={C.amber} t="% RL" />
          </span>
        }
      >
        <div className={styles.cards} style={cols}>
          {data.ruas.map((r) => (
            <GolCard key={r.ruas} gol={r.gol} />
          ))}
        </div>
      </Section>
    </SlideFrame>
  );
}

function Section({ title, legend, children }: { title: string; legend: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.secHead}>
        <div className={styles.secTitleWrap}>
          <span className={styles.accent} />
          <span className={styles.secTitle}>{title}</span>
        </div>
        {legend}
      </div>
      {children}
    </div>
  );
}

function MonthLegend({ monthAbbr }: { monthAbbr: string }) {
  return (
    <span className={styles.legend}>
      <Lg c={C.realLight} t="Realisasi" />
      <Lg c={C.navy} t={monthAbbr} />
      <Lg c={C.bpRed} t="Business Plan" dash />
    </span>
  );
}
function Lg({ c, t, dash }: { c: string; t: string; dash?: boolean }) {
  return (
    <span className={styles.legItem}>
      <span className={dash ? styles.swDash : styles.sw} style={dash ? { borderColor: c } : { background: c }} />
      {t}
    </span>
  );
}

function MonthlyCard({ series, reportIdx, monthAbbr }: { series: TrafficSeries; reportIdx: number; monthAbbr: string }) {
  const t = tier(series.ach);
  // Hanya tampilkan bulan yang sudah berjalan (s.d bulan laporan) — bulan ke depan disembunyikan.
  const rows = MONTHS.slice(0, reportIdx + 1).map((mo, i) => ({ mo, real: series.monthly[i] ?? null }));
  return (
    <div className={styles.card}>
      <div className={styles.stat}>
        <div className={styles.statBlocks}>
          <div className={styles.statBlock}>
            <div className={styles.statLbl}>BP</div>
            <div className={styles.statVal} style={{ color: C.bpRed }}>{fmt(series.bp)}</div>
          </div>
          <div className={`${styles.statBlock} ${styles.statDiv}`}>
            <div className={styles.statLbl}>REAL {monthAbbr.toUpperCase()}</div>
            <div className={styles.statVal} style={{ color: "var(--text)" }}>{fmt(series.real_month)}</div>
          </div>
        </div>
        <span className={styles.pill} style={{ background: t.bg, borderColor: t.border, color: t.color }}>
          {t.arrow} {series.ach == null ? "–" : `${series.ach}%`}
        </span>
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="mo" tick={{ fontSize: 9.5, fill: C.axis }} tickLine={false} axisLine={false} interval={0} height={15} />
            <YAxis
              tick={{ fontSize: 9, fill: "#b4bcc7" }}
              tickLine={false}
              axisLine={false}
              width={30}
              tickCount={4}
              tickFormatter={(v: number) => compact(v)}
            />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tipStyle} formatter={(v: number) => [fmt(v), "Realisasi"]} />
            {series.bp != null && <ReferenceLine y={series.bp} stroke={C.bpRed} strokeWidth={2} strokeDasharray="5 4" ifOverflow="extendDomain" />}
            <Bar dataKey="real" name="Realisasi" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive animationDuration={700}>
              {rows.map((_, i) => (
                <Cell key={i} fill={i === reportIdx ? C.navy : C.realLight} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GolCard({ gol }: { gol: RuasEval["gol"] }) {
  const rows = [0, 1, 2, 3, 4].map((i) => ({ g: `Gol ${i + 1}`, bp: gol.bp[i], real: gol.real[i], rl: gol.rl[i] }));
  return (
    <div className={styles.card}>
      <div className={styles.chartFull}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} barGap={1} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="g" tick={{ fontSize: 9.5, fontWeight: 600, fill: "#475569" }} tickLine={false} axisLine={false} interval={0} height={15} />
            <YAxis tick={{ fontSize: 9, fill: "#b4bcc7" }} tickLine={false} axisLine={false} width={30} tickCount={4} tickFormatter={(v: number) => compact(v)} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 8.5, fill: C.amber }} tickLine={false} axisLine={false} width={26} tickCount={4} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tipStyle} formatter={(v: number, n: string) => [n === "% RL" ? `${v}%` : fmt(v), n]} />
            <Bar dataKey="bp" name="BP" fill={C.navy} radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={700} />
            <Bar dataKey="real" name="Realisasi" fill={C.teal} radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={700} />
            <Line yAxisId="r" type="monotone" dataKey="rl" name="% RL" stroke={C.amber} strokeWidth={2} dot={{ r: 2.5, fill: C.amber, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
