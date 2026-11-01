import { useEffect, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, PieChart, Pie, Cell
} from "recharts";
import type { CSSProperties, ReactNode } from "react";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import { getOdolPresentation } from "@/lib/insights";
import type { OdolPresentation } from "@/types/insights";
import styles from "./OdolSlide.module.css";

/* ============================================================================
   Slide ODOL (Rapat Direktorat) — sadar-scope + drill sebaran. Tata letak:
   kolom KPI | grafik batang | donut Normal vs ODOL (atas); Komposisi Golongan |
   Sebaran (drill) | Top Pelat/Perusahaan (tab) (bawah). Catatan pakai ikon pencil.
   ============================================================================ */

const C = { navy: "#1e3a6b", red: "#d1495b", line: "#2e8fd0", ink: "#1f2d3f", muted: "#64748b", faint: "#94a3b8", gLine: "#eef2f7", amber: "#c08a1e", green: "#1f9d6b" };
const CLASS_PALETTE = ["#17607f", "#e0792e", "#1f7a3f", "#3c9ad1", "#8a6fb0"];
const SEB_PALETTE = ["#17607f", "#e0792e", "#1f7a3f", "#3c9ad1", "#c0603a", "#8a6fb0"];
const tip: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 12, color: C.ink };

const fmt = (n: number | null | undefined) => (n == null ? "–" : Number(n).toLocaleString("id-ID"));
const pct = (n: number | null | undefined, d = 1) => (n == null ? "–" : `${Number(n).toFixed(d).replace(".", ",")}%`);
const compact = (n: number | null | undefined) => {
  const v = Number(n || 0);
  if (v == null || v === 0) return "";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")}jt`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}rb`;
  return String(Math.round(v));
};

// Ikon pencil (catatan) + warning (peringatan) — satu-satunya ikon di slide.
const IcPencil = (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IcWarn = (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
  </svg>
);
const IcBack = (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);

type NoteType = "info" | "warn" | "critical";
function Note({ type, children }: { type: NoteType; children: ReactNode }) {
  const warn = type !== "info";
  return (
    <div className={`${styles.note} ${styles[`note_${type}`]}`}>
      <span className={styles.noteIcon}>{warn ? IcWarn : IcPencil}</span>
      <span className={styles.noteText}>{children}</span>
    </div>
  );
}

const SEB_TITLE: Record<string, string> = { regional: "SEBARAN PER REGIONAL", cabang: "SEBARAN PER RUAS", plate: "SEBARAN PER ASAL PELAT" };

interface Props {
  data: OdolPresentation | null;
  scopeLabel?: string | null;
}

export function OdolSlide({ data, scopeLabel }: Props) {
  // Drill sebaran: tumpukan hasil fetch sub-scope; tampilan = puncak tumpukan atau base.
  const [stack, setStack] = useState<OdolPresentation[]>([]);
  const [drilling, setDrilling] = useState(false);
  useEffect(() => setStack([]), [data?.scope.key]);

  const cur = stack[stack.length - 1] || data;

  async function drill(key: string) {
    setDrilling(true);
    try {
      const d = await getOdolPresentation(key);
      setStack((s) => [...s, d]);
    } catch {
      /* abaikan */
    } finally {
      setDrilling(false);
    }
  }
  const back = () => setStack((s) => s.slice(0, -1));

  if (!cur || cur.empty || !cur.kpi.total_weighed) {
    return (
      <SlideFrame title="ODOL — Over Dimension Over Loading" subtitle={cur ? `Tahun ${cur.period.year}` : ""} scopeLabel={scopeLabel} flush stagger={false}>
        <div className={styles.slide}>
          <div className={styles.emptyBox}>
            <div className={styles.emptyTitle}>Belum ada data ODOL</div>
            <div className={styles.emptySub}>{cur?.narratives.overall || "Data tidak tersedia untuk lingkup ini."}</div>
          </div>
        </div>
      </SlideFrame>
    );
  }

  const k = cur.kpi;
  const nvo = cur.normal_vs_odol;
  const nvoTotal = nvo.normal + nvo.odol || 1;
  const normalPct = (nvo.normal / nvoTotal) * 100;
  const odolPct = (nvo.odol / nvoTotal) * 100;
  const pieNvo = [{ name: "Normal", value: nvo.normal, c: C.navy }, { name: "ODOL", value: nvo.odol, c: C.red }].filter((d) => d.value > 0);
  const trend = cur.trend.map((t) => ({ label: t.label.slice(0, 3), normal: t.total_normal, odol: t.total_odol, pct: t.odol_percent }));
  const drilledLabel = stack.length > 0 ? cur.scope.label : scopeLabel;

  const cmp = k.comparison;
  const cmpNote: { type: NoteType; text: string } = cmp && cmp.change_percent != null && cmp.direction
    ? { type: cmp.direction === "up" && cmp.is_higher_worse ? "warn" : "info", text: `${cmp.direction === "up" ? "Naik" : "Turun"} ${pct(Math.abs(cmp.change_percent))} dibanding tahun lalu.` }
    : { type: "warn", text: "Perlu pengawasan muatan berlebih." };
  const kpis = [
    { value: fmt(k.total_weighed), title: "Kendaraan Tertimbang", color: C.navy, note: { type: "info" as NoteType, text: `Akumulasi penimbangan tahun ${cur.period.year}.` } },
    { value: fmt(k.total_normal), title: "Normal", color: C.green, note: { type: "info" as NoteType, text: `${pct(normalPct)} dari total kendaraan.` } },
    { value: fmt(k.total_odol), title: "Pelanggaran ODOL", color: C.red, note: { type: "critical" as NoteType, text: `${pct(odolPct)} dari total kendaraan.` } },
    { value: pct(k.odol_percent), title: "Persentase ODOL", color: C.amber, note: cmpNote }
  ];
  const sebItems = cur.sebaran.items.filter((i) => i.key !== "lainnya" && i.label !== "Lainnya").slice(0, 6);

  return (
    <SlideFrame
      title="ODOL — Over Dimension Over Loading"
      subtitle={`Tahun ${cur.period.year}`}
      scopeLabel={drilledLabel}
      flush
      stagger={false}
      rightMeta={
        <span className={styles.legend}>
          <span><span className={styles.sw} style={{ background: C.navy }} />Normal</span>
          <span><span className={styles.sw} style={{ background: C.red }} />ODOL</span>
          <span><span className={styles.sw} style={{ background: C.line }} />% ODOL</span>
        </span>
      }
    >
      <div className={styles.slide}>
        <div key={cur.scope.key} className={`${styles.body} pfx-stagger`}>
          {/* ATAS: KPI | batang | donut normal vs odol */}
          <div className={styles.topBand}>
            <div className={styles.kpiCol}>
              {kpis.map((kp) => (
                <div key={kp.title} className={styles.kpiCard}>
                  <div className={styles.kpiHead}>
                    <span className={styles.kpiDot} style={{ background: kp.color }} />
                    <span className={styles.kpiTitle}>{kp.title}</span>
                  </div>
                  <div className={styles.kpiValue}>{kp.value}</div>
                  <div className={styles.kpiDesc}>{kp.note.text}</div>
                </div>
              ))}
            </div>

            <div className={`${styles.card} ${styles.barCard}`}>
              <div className={styles.cardTitle}>PERBANDINGAN NORMAL VS ODOL PER BULAN</div>
              <div className={styles.barBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trend} margin={{ top: 22, right: 8, bottom: 2, left: 2 }} barGap={2} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke={C.gLine} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: "#e4e9ef" }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: C.faint }} width={44} tickLine={false} axisLine={false} tickFormatter={(v) => compact(v)} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, "auto"]} tick={{ fontSize: 10, fill: C.faint }} width={34} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [n === "% ODOL" ? pct(v) : fmt(v), n]} />
                    <Bar yAxisId="l" dataKey="normal" name="Normal" fill={C.navy} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={700}>
                      <LabelList dataKey="normal" position="top" formatter={(v: number) => compact(v)} style={{ fontSize: 8.5, fontWeight: 700, fill: C.navy }} />
                    </Bar>
                    <Bar yAxisId="l" dataKey="odol" name="ODOL" fill={C.red} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive animationDuration={700}>
                      <LabelList dataKey="odol" position="top" formatter={(v: number) => compact(v)} style={{ fontSize: 8.5, fontWeight: 700, fill: C.red }} />
                    </Bar>
                    <Line yAxisId="r" type="monotone" dataKey="pct" name="% ODOL" stroke={C.line} strokeWidth={2.6} dot={{ r: 3, fill: C.line, strokeWidth: 0 }} connectNulls isAnimationActive animationDuration={900}>
                      <LabelList dataKey="pct" position="top" offset={10} formatter={(v: number) => (v == null ? "" : pct(v, 0))} style={{ fontSize: 9.5, fontWeight: 800, fill: C.line }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Note type="info">{cur.narratives.trend}</Note>
            </div>

            <DonutCard
              title="NORMAL VS ODOL"
              legendBelow
              pieData={pieNvo}
              center={{ big: pct(odolPct), small: "ODOL" }}
              legend={[{ label: "Normal", value: nvo.normal, color: C.navy, pctVal: normalPct }, { label: "ODOL", value: nvo.odol, color: C.red, pctVal: odolPct }]}
              note={{ type: "info", text: `${pct(normalPct)} kendaraan normal, ${pct(odolPct)} melanggar ODOL.` }}
            />
          </div>

          {/* BAWAH: komposisi | sebaran (drill) | top (tab) */}
          <div className={styles.botBand}>
            <DonutCard
              title="KOMPOSISI PER GOLONGAN"
              pieData={cur.by_class.map((c, i) => ({ name: c.label.replace("Golongan ", "Gol "), value: c.total_odol, c: CLASS_PALETTE[i % CLASS_PALETTE.length], pctVal: c.percent }))}
              sliceLabels
              legend={cur.by_class.map((c, i) => ({ label: c.label.replace("Golongan ", "Gol "), value: c.total_odol, color: CLASS_PALETTE[i % CLASS_PALETTE.length], pctVal: c.percent }))}
              note={{ type: "info", text: cur.narratives.composition }}
            />

            <DonutCard
              title={SEB_TITLE[cur.sebaran.mode]}
              headerRight={stack.length > 0 ? (
                <button className={styles.backBtn} onClick={back} title="Kembali"><span className={styles.backIc}>{IcBack}</span>Kembali</button>
              ) : sebItems.some((i) => i.drill_key) ? (
                <span className={styles.drillHint}>{drilling ? "memuat…" : "klik untuk telusuri"}</span>
              ) : null}
              pieData={sebItems.map((it, i) => ({ name: it.label, value: it.total_odol, c: SEB_PALETTE[i % SEB_PALETTE.length], pctVal: it.percent }))}
              sliceLabels
              legend={sebItems.map((it, i) => ({ label: it.label, value: it.total_odol, color: SEB_PALETTE[i % SEB_PALETTE.length], pctVal: it.percent, drillKey: it.drill_key || undefined }))}
              onDrill={(key) => void drill(key)}
              note={{ type: "info", text: cur.narratives.sebaran }}
            />

            <TopCard data={cur} />
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function DonutCard({ title, pieData, center, legend, note, sliceLabels, onDrill, headerRight, legendBelow }: {
  title: string;
  pieData: { name: string; value: number; c: string; pctVal?: number }[];
  center?: { big: string; small: string };
  legend: { label: string; value: number; color: string; pctVal?: number; drillKey?: string }[];
  note: { type: NoteType; text: string };
  sliceLabels?: boolean;
  onDrill?: (key: string) => void;
  headerRight?: ReactNode;
  legendBelow?: boolean;
}) {
  const sliceLabel = sliceLabels ? (p: { pctVal?: number }) => (p.pctVal != null && p.pctVal >= 2 ? `${String(p.pctVal).replace(".", ",")}%` : "") : undefined;
  const chart = (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie data={pieData.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius={center ? "58%" : "0%"} outerRadius="94%" paddingAngle={1} label={sliceLabel} labelLine={sliceLabels ? { stroke: "#cbd5e1" } : false} isAnimationActive animationDuration={700}>
            {pieData.map((d) => <Cell key={d.name} fill={d.c} />)}
          </Pie>
          <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [fmt(v), n]} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className={styles.donutCenter}><div className={styles.donutBig}>{center.big}</div><div className={styles.donutSmall}>{center.small}</div></div>}
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>{title}</div>
        {headerRight}
      </div>
      {legendBelow ? (
        <div className={styles.donutColumn}>
          {chart}
          <div className={styles.legendBelow}>
            {legend.map((l) => (
              <span key={l.label}><span className={styles.legDot} style={{ background: l.color }} />{l.label} <b>{l.pctVal != null ? pct(l.pctVal) : fmt(l.value)}</b></span>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.donutRow}>
          {chart}
          <div className={styles.legendList}>
            {legend.map((l) => {
              const clickable = Boolean(l.drillKey && onDrill);
              const content = (
                <>
                  <span className={styles.legDot} style={{ background: l.color }} />
                  <span className={styles.legName} title={l.label}>{l.label}</span>
                  <span className={styles.legPct}>{l.pctVal != null ? pct(l.pctVal) : fmt(l.value)}</span>
                </>
              );
              return clickable ? (
                <button key={l.label} className={`${styles.legRow} ${styles.legRowBtn}`} onClick={() => onDrill!(l.drillKey!)}>{content}</button>
              ) : (
                <div key={l.label} className={styles.legRow}>{content}</div>
              );
            })}
          </div>
        </div>
      )}
      <Note type={note.type}>{note.text}</Note>
    </div>
  );
}

function TopCard({ data }: { data: OdolPresentation }) {
  const [tab, setTab] = useState<"pelat" | "perusahaan">("pelat");
  return (
    <div className={`${styles.card} ${styles.topCard}`}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>{tab === "pelat" ? "TOP ASAL KENDARAAN" : "TOP PERUSAHAAN ANGKUTAN"}</div>
        <div className={styles.tabs}>
          <button className={tab === "pelat" ? styles.tabOn : ""} onClick={() => setTab("pelat")}>Pelat</button>
          <button className={tab === "perusahaan" ? styles.tabOn : ""} onClick={() => setTab("perusahaan")}>Perusahaan</button>
        </div>
      </div>
      <div className={styles.tableWrap}>
        {tab === "pelat" ? (
          <table className={styles.table}>
            <thead><tr><th className={styles.rank}>#</th><th>Wilayah</th><th className={styles.num}>ODOL</th><th className={styles.num}>%</th></tr></thead>
            <tbody>
              {data.top_plates.slice(0, 10).map((it, i) => (
                <tr key={it.key}><td className={styles.rank}>{i + 1}</td><td><b>{it.key}</b> · {it.label}</td><td className={styles.num}>{fmt(it.total_odol)}</td><td className={styles.num}>{pct(it.odol_percent)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead><tr><th className={styles.rank}>#</th><th>Perusahaan</th><th className={styles.num}>ODOL</th><th className={styles.num}>Pangsa</th></tr></thead>
            <tbody>
              {data.top_companies.slice(0, 10).map((it) => (
                <tr key={it.rank}><td className={styles.rank}>{it.rank}</td><td title={it.company_name}>{it.company_name}</td><td className={styles.num}>{fmt(it.total_odol)}</td><td className={styles.num}>{pct(it.company_share_percent)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Note type="info">{tab === "pelat" ? data.narratives.plates : data.narratives.companies}</Note>
    </div>
  );
}
