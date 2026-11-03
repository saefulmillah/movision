import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CSSProperties } from "react";
import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import type { KinerjaRegionalData } from "@/lib/kinerjaRegional";
import type { Cell, EntityData } from "@/types/labaRugi";
import { toOperationalRuas } from "@/lib/ruasAlias";
import styles from "./RencanaPendapatanSlide.module.css";

/* ============================================================
   Slide "Rencana Pendapatan Tol & Kinerja Laba Rugi" (scope regional).
   RKK = rencana BULAN BERIKUTNYA, diambil dari file periode terpilih (kolom
   `rkk_label`/`rkk_sd_label`): mis. periode September → RKK = Oktober. Slide ini
   murni rencana ke depan (RKAP vs RKK), bukan realisasi. Sumber: dataset Kinerja
   Regional (konsol + entities_rkk/entities_rkk_sd per ruas). Grafik = Recharts.
   ============================================================ */

interface Props {
  kinerja: KinerjaRegionalData | null;
  periodLabel: string;
  scopeLabel?: string | null;
  /** Pengali ukuran font (dipakai untuk KPI Cards Kinerja). */
  fontScale?: number;
}

const idNum = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idMrd = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const idPct = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const idPct1 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function numJuta(v: number | null | undefined): string {
  if (v == null) return "–";
  const r = Math.round(v);
  if (r === 0) return "–";
  const s = idNum.format(Math.abs(r));
  return r < 0 ? `(${s})` : s;
}
function toMrd(v: number | null | undefined): number | null {
  return v == null ? null : v / 1000;
}
function cell(ent: EntityData | undefined, acc: string): Cell {
  return (ent && ent[acc]) || [null, null];
}
function prettyRuas(id: string): string {
  // Seragamkan ke kode operasional (BINTAN→BINSA, dst.) sebelum dirapikan.
  const s = toOperationalRuas(id).replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
// "OKTOBER 2026" → "Oktober 2026"; "SD OKTOBER 2026" → "S.d Oktober 2026".
function titleMonth(label: string | null | undefined): string {
  if (!label) return "";
  const sd = /^SD\s+/i.test(label);
  const body = label.replace(/^SD\s+/i, "").replace(/([A-Za-zÀ-ÿ]+)/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return sd ? `S.d ${body}` : body;
}

// Identitas warna seri: RKAP teal, RKK navy. Merah DICADANGKAN untuk nilai
// negatif/di bawah (C.bad) — handoff Card Kinerja L/R per Ruas.
const C = { navy: "#16315d", teal: "#2d7d93", rkk: "#2a3f6e", bad: "#cf3a3f", green: "#15934e", red: "#d64141", axis: "#334155" };
const tipStyle: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 11, color: "#1f2d3f", padding: "4px 8px" };

const PL_METRICS = [
  { key: "pend_usaha", label: "Pendapatan" },
  { key: "beban_langsung", label: "Biaya Langsung" },
  { key: "laba_operasi", label: "Laba Operasi" },
  { key: "ebitda", label: "EBITDA" },
  { key: "bunga", label: "Bunga" },
  { key: "eat", label: "EAT" }
] as const;
type PlMetricKey = (typeof PL_METRICS)[number]["key"];

export function RencanaPendapatanSlide({ kinerja, periodLabel, scopeLabel, fontScale = 1 }: Props) {
  const [ruasPeriod, setRuasPeriod] = useState<"mo" | "sd">("mo");
  const [plPeriod, setPlPeriod] = useState<"mo" | "sd">("mo");
  const [plMetric, setPlMetric] = useState<PlMetricKey>("eat");

  const rkkLabel = kinerja?.rkk_label || null;
  const rkkSdLabel = kinerja?.rkk_sd_label || null;
  const entRkk = kinerja?.entities_rkk || {};
  const entRkkSd = kinerja?.entities_rkk_sd || {};

  const ruasList = useMemo(() => {
    if (!kinerja) return [];
    const present = new Set([...Object.keys(entRkk), ...Object.keys(entRkkSd)]);
    const ordered = (kinerja.ruas || []).map((r) => r.id).filter((id) => present.has(id));
    const extra = [...present].filter((id) => !ordered.includes(id));
    return [...ordered, ...extra];
  }, [kinerja, entRkk, entRkkSd]);

  const konsolMo = kinerja?.konsol[rkkLabel || ""] || undefined;
  const konsolSd = kinerja?.konsol[rkkSdLabel || ""] || undefined;
  const hasKonsol = !!(konsolMo && Object.keys(konsolMo).length) || !!(konsolSd && Object.keys(konsolSd).length);
  const hasData = !!(kinerja && rkkLabel && (hasKonsol || ruasList.length > 0));

  const rkkFull = titleMonth(rkkLabel);
  const monthShort = rkkFull.replace(/\s*20\d\d$/, "") || "Bulan";

  if (!hasData) {
    return (
      <SlideFrame title="Rencana Pendapatan Tol & Kinerja Laba Rugi" subtitle={periodLabel} scopeLabel={scopeLabel}>
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Rencana (RKK) belum tersedia"
            description="Unggah file Kinerja L/R regional (yang memuat RKK bulan berikutnya) untuk periode ini."
          />
        </div>
      </SlideFrame>
    );
  }

  const periods = [
    { id: "mo" as const, name: monthShort },
    { id: "sd" as const, name: `S.d ${monthShort}` }
  ];

  // ---- Blok 1: Rencana Pendapatan Tol & Lainnya (konsol RKK) ----
  const revRow = (label: string, ent: EntityData | undefined, acc: string, bold: boolean) => {
    const [rkap, rkk] = cell(ent, acc);
    const ach = rkap ? ((rkk ?? 0) / rkap) * 100 : null;
    const good = ach != null && ach >= 100;
    return {
      label,
      rkap: numJuta(rkap),
      rkk: numJuta(rkk),
      ach: ach == null ? "–" : `${idPct.format(ach)}%`,
      arrow: ach == null ? "" : good ? "▲" : "▼",
      good,
      bold
    };
  };
  const revBlock = (ent: EntityData | undefined) => [
    revRow("Pendapatan Tol", ent, "tol", false),
    revRow("Usaha Lainnya", ent, "usaha_lainnya", false),
    revRow("Total Pendapatan", ent, "pend_usaha", true)
  ];
  // Chip periode memakai identitas warna deck (teal & navy), bukan merah
  // (merah dicadangkan utk status di bawah budget pada badge % ACH).
  const revPlan = [
    { period: monthShort.toUpperCase(), chip: C.teal, rows: revBlock(konsolMo) },
    { period: `S.D ${monthShort.toUpperCase()}`, chip: C.navy, rows: revBlock(konsolSd) }
  ];

  // ---- Blok 2: Pendapatan per Ruas (RKK pend_usaha, juta) ----
  const ruasRows = ruasList.map((id) => {
    const ent = ruasPeriod === "mo" ? entRkk[id] : entRkkSd[id];
    return { name: prettyRuas(id), value: cell(ent, "pend_usaha")[1] };
  });

  // ---- Blok 3: Kinerja L/R per Ruas (RKAP vs RKK, miliar) ----
  const plRows = ruasList.map((id) => {
    const ent = plPeriod === "mo" ? entRkk[id] : entRkkSd[id];
    const c = cell(ent, plMetric);
    return { name: prettyRuas(id), rkap: toMrd(c[0]), rkk: toMrd(c[1]) };
  });
  const plSummary = [
    { period: monthShort.toUpperCase(), ...sumFor(konsolMo, plMetric) },
    { period: `S.D ${monthShort.toUpperCase()}`, ...sumFor(konsolSd, plMetric) }
  ];

  // ---- Lapis 1: KPI Total Konsol per metrik (selektor) ----
  // Nilai besar = RKK konsol metrik pada periode aktif; delta = |RKK/RKAP−1|×100
  // (arah hanya indikator besaran, tidak diwarnai baik/buruk). RKAP=0/null → "—".
  const activeKonsol = plPeriod === "mo" ? konsolMo : konsolSd;
  const plPeriodName = plPeriod === "mo" ? monthShort : `S.d ${monthShort}`;
  const metricLabel = PL_METRICS.find((m) => m.key === plMetric)?.label ?? "";
  const kpiCards = PL_METRICS.map((m) => {
    const [rkap, rkk] = cell(activeKonsol, m.key);
    const rkkMrd = toMrd(rkk);
    const hasDelta = rkap != null && rkap !== 0 && rkk != null;
    const pct = hasDelta ? (rkk / rkap - 1) * 100 : null;
    return {
      key: m.key,
      label: m.label,
      valStr: rkkMrd == null ? "–" : idMrd.format(rkkMrd),
      arrow: pct == null ? "" : (rkk ?? 0) >= (rkap ?? 0) ? "▲" : "▼",
      deltaStr: pct == null ? "—" : `${idPct1.format(Math.abs(pct))}%`
    };
  });

  const periodTabBtns = (active: "mo" | "sd", set: (v: "mo" | "sd") => void, accent: string) =>
    periods.map((pp) => {
      const on = active === pp.id;
      return (
        <button key={pp.id} type="button" className={styles.tab} style={{ background: on ? accent : "#eef1f6", color: on ? "#fff" : "#64748b" }} onClick={() => set(pp.id)}>
          {pp.name}
        </button>
      );
    });

  return (
    <SlideFrame
      title="Rencana Pendapatan Tol & Kinerja Laba Rugi"
      subtitle={<>Rencana (RKK) · {rkkFull}</>}
      scopeLabel={scopeLabel}
      rightMeta={
        <span className={styles.legend}>
          <span className={styles.legItem}><span className={styles.sw} style={{ background: C.teal }} />RKAP</span>
          <span className={styles.legItem}><span className={styles.sw} style={{ background: C.rkk }} />RKK</span>
        </span>
      }
    >
      <div className={styles.grid}>
        {/* Kolom kiri */}
        <div className={styles.leftCol}>
          {/* Blok 1 */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>RENCANA PENDAPATAN TOL &amp; LAINNYA</div>
            <div className={styles.cardSub}>RKAP vs RKK · dalam Juta Rupiah</div>
            {revPlan.map((g) => (
              <div key={g.period} className={styles.revGroup}>
                <span className={styles.revChip} style={{ "--chip-accent": g.chip } as CSSProperties}>{g.period}</span>
                <div className={`${styles.revRow} ${styles.revHead}`}>
                  <span />
                  <span className={styles.rHead}>RKAP</span>
                  <span className={styles.rHead}>RKK</span>
                  <span className={styles.achHead}>% ACH</span>
                </div>
                <div className={styles.revRows}>
                  {g.rows.map((r) => (
                    <div key={r.label} className={`${styles.revRow} ${r.bold ? styles.revTotal : ""}`}>
                      <span className={styles.revLabel}>{r.label}</span>
                      <span className={styles.r}>{r.rkap}</span>
                      <span className={styles.r}>{r.rkk}</span>
                      <span className={styles.rPill}>
                        <span className={styles.pill} style={{ background: r.good ? C.green : C.bad }}>
                          {r.arrow} {r.ach}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Blok 2 */}
          <div className={`${styles.card} ${styles.grow}`}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>RENCANA PENDAPATAN PER RUAS</div>
                <div className={styles.cardSub}>RKK · dalam Juta Rupiah</div>
              </div>
              <div className={styles.tabs}>{periodTabBtns(ruasPeriod, setRuasPeriod, C.teal)}</div>
            </div>
            <div className={`${styles.chart} ${styles.grow}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ruasRows} margin={{ top: 20, right: 6, bottom: 2, left: 2 }} barCategoryGap="22%">
                  <XAxis dataKey="name" tick={{ fontSize: 10.5, fontWeight: 700, fill: C.axis }} tickLine={false} axisLine={false} interval={0} height={16} />
                  <YAxis hide domain={[0, (max: number) => max * 1.2]} />
                  <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tipStyle} formatter={(v: number) => [numJuta(v), "RKK"]} />
                  <Bar dataKey="value" name="RKK" fill={C.teal} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={650}>
                    <LabelList dataKey="value" content={TopLabel(numJuta, C.axis, 10.5)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Kolom kanan: Kinerja L/R per Ruas */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>KINERJA LABA RUGI PER RUAS</div>
              <div className={styles.cardSub}>RKAP vs RKK · dalam Miliar Rupiah</div>
            </div>
            <div className={styles.tabs}>{periodTabBtns(plPeriod, setPlPeriod, C.navy)}</div>
          </div>

          {/* Lapis 1 — KPI Total Konsol per metrik (sekaligus selektor metrik) */}
          <div className={styles.kpiRow} role="tablist" aria-label="Pilih metrik Laba Rugi" style={{ "--pfx-fs": fontScale } as CSSProperties}>
            {kpiCards.map((k) => {
              const on = plMetric === k.key;
              return (
                <button
                  key={k.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`${styles.kpiCard} ${on ? styles.kpiCardOn : ""}`}
                  onClick={() => setPlMetric(k.key)}
                >
                  <span className={styles.kpiName}>{k.label}</span>
                  <span className={styles.kpiVal}>{k.valStr}</span>
                  <span className={styles.kpiDelta}>
                    RKK {k.arrow} {k.deltaStr} <em>vs RKAP</em>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Lapis 2 — grafik grouped bar per ruas (metrik & periode aktif) */}
          <div className={styles.chartTitle}>
            {metricLabel} — {plPeriodName} · RKAP vs RKK
          </div>
          <div className={`${styles.chart} ${styles.grow}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plRows} margin={{ top: 22, right: 10, bottom: 2, left: 4 }} barGap={4} barCategoryGap="16%">
                {/* Gridline latar (horizontal = nilai Y, vertical = pembatas antar ruas) */}
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fontWeight: 700, fill: C.axis }}
                  tickLine={{ stroke: "#94a3b8" }}
                  axisLine={{ stroke: "#94a3b8" }}
                  interval={0}
                  height={20}
                />
                <YAxis
                  domain={[(min: number) => Math.min(0, min) * 1.25, (max: number) => Math.max(0, max) * 1.2]}
                  tickFormatter={(v: number) => idMrd.format(v)}
                  tick={{ fontSize: 11, fontWeight: 600, fill: C.axis }}
                  tickLine={{ stroke: "#94a3b8" }}
                  axisLine={{ stroke: "#94a3b8" }}
                  width={42}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.75} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tipStyle} formatter={(v: number, n: string) => [idMrd.format(v), n]} />
                <Bar dataKey="rkap" name="RKAP" fill={C.teal} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={650}>
                  <LabelList dataKey="rkap" content={TopLabel((v) => idMrd.format(v), C.teal, 12)} />
                </Bar>
                <Bar dataKey="rkk" name="RKK" fill={C.rkk} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={650}>
                  <LabelList dataKey="rkk" content={TopLabel((v) => idMrd.format(v), C.rkk, 12)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lapis 3 — ringkasan 2-periode (SELALU kedua periode, tak ikut toggle) */}
          <div className={styles.summaryHead}>Total Konsol · {metricLabel}</div>
          <div className={styles.summary}>
            {plSummary.map((s) => (
              <div key={s.period} className={styles.summaryCard}>
                <div className={styles.summaryPeriod}>{s.period}</div>
                <div className={styles.summaryVals}>
                  <div>
                    <div className={styles.summaryLbl}>RKAP</div>
                    <div className={styles.summaryVal} style={{ color: C.teal }}>{s.rkap}</div>
                  </div>
                  <div className={styles.summaryRight}>
                    <div className={styles.summaryLbl}>RKK</div>
                    <div className={styles.summaryVal} style={{ color: C.rkk }}>{s.rkk}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

// Total konsol untuk sebuah metrik (juta): [rkap, rkk].
function sumFor(ent: EntityData | undefined, metric: string) {
  const c = cell(ent, metric);
  return { rkap: numJuta(c[0]), rkk: numJuta(c[1]) };
}

// Label nilai di ujung batang: di atas untuk positif, di bawah untuk negatif.
function TopLabel(fmt: (v: number) => string, color: string, size: number) {
  return (props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string | null }) => {
    const v = props.value == null ? null : Number(props.value);
    if (v == null || !Number.isFinite(v) || Math.round(v * 10) === 0) return null;
    const x = Number(props.x) || 0;
    const y = Number(props.y) || 0;
    const width = Number(props.width) || 0;
    const height = Number(props.height) || 0;
    const cx = x + width / 2;
    const neg = v < 0;
    // Robust thd konvensi Recharts: tepi atas batang = sisi-y terkecil, tepi bawah
    // = terbesar. Positif → label di atas tepi atas; negatif → di bawah tepi bawah.
    const top = Math.min(y, y + height);
    const bot = Math.max(y, y + height);
    const yy = neg ? bot + size + 1 : top - 4;
    // Nilai negatif selalu merah (C.bad); positif pakai warna seri.
    return (
      <text x={cx} y={yy} textAnchor="middle" fontSize={size} fontWeight={700} fill={neg ? C.bad : color} style={{ fontVariantNumeric: "tabular-nums" }}>
        {fmt(v)}
      </text>
    );
  };
}
