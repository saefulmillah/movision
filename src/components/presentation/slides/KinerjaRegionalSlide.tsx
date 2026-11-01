import { useMemo, useState } from "react";
import { Bar, BarChart, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CSSProperties } from "react";
import { EmptyState } from "@/components/ui";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import type { KinerjaRegionalData, TrafficRow } from "@/lib/kinerjaRegional";
import type { Cell, EntityData } from "@/types/labaRugi";
import styles from "./KinerjaRegionalSlide.module.css";

/* ============================================================
   Slide "Kinerja Keuangan Regional" (handoff 04. Kinerja Regional).
   Hanya scope regional. Sumber: dataset L/R per-scope (KPI + P&L per ruas) +
   LHR/PHR per ruas (upload LHR). Grafik = inline SVG (idiom codebase).
   ============================================================ */

interface Props {
  data: KinerjaRegionalData | null;
  periodLabel: string;
  scopeLabel?: string | null;
}

const idNum = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idPct = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function num(v: number | null | undefined): string {
  if (v == null) return "–";
  const r = Math.round(v);
  if (r === 0) return "–";
  const s = idNum.format(Math.abs(r));
  return r < 0 ? `(${s})` : s;
}
function ratio(real: number | null | undefined, rkap: number | null | undefined): number | null {
  if (real == null || rkap == null || rkap === 0) return null;
  return (real / rkap) * 100;
}
function cell(ent: EntityData | undefined, acc: string): Cell {
  return (ent && ent[acc]) || [null, null];
}

// Nilai "HPP" (%) dari sepasang [beban_langsung, pend_usaha] pada satu kolom.
function hppPct(ent: EntityData | undefined, idx: 0 | 1): number | null {
  const bl = cell(ent, "beban_langsung")[idx];
  const pu = cell(ent, "pend_usaha")[idx];
  if (bl == null || pu == null || pu === 0) return null;
  return (bl / pu) * 100;
}

const GREEN = "var(--sem-green)";
const RED = "var(--sem-red)";

export function KinerjaRegionalSlide({ data, periodLabel, scopeLabel }: Props) {
  const [showSept, setShowSept] = useState(false);

  // Daftar entitas grafik dari `entities` yang benar-benar ada (urut mengikuti
  // `data.ruas` dulu, lalu entitas lain yg tak ada di meta — mis. PBBL/Cabang Jambi
  // yang tidak terdaftar di RUAS_TO_REGIONAL sehingga absen dari `data.ruas`).
  const ruasList = useMemo(() => {
    if (!data) return [];
    const present = new Set([...Object.keys(data.entities || {}), ...Object.keys(data.entities_month || {})]);
    const ordered = (data.ruas || []).map((r) => r.id).filter((id) => present.has(id));
    const extra = [...present].filter((id) => !ordered.includes(id));
    return [...ordered, ...extra];
  }, [data]);

  if (!data || (data.meta.empty && data.lhr.length === 0 && data.phr.length === 0 && ruasList.length === 0)) {
    return (
      <SlideFrame title="Kinerja Keuangan Regional" scopeLabel={scopeLabel}>
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Data kinerja regional belum tersedia"
            description="Unggah file kinerja L/R di menu Laba Rugi Regional untuk lingkup & periode ini."
          />
        </div>
      </SlideFrame>
    );
  }

  const sd = data.konsol[data.sd_label || ""] || {};
  const fy = data.fy_rkap || {};

  // ---- KPI cards (5) dari konsol regional ----
  const kpis = buildKpis(sd, fy);

  // ---- P&L panels: 5 metrik × per ruas (SD + opsional bulan) ----
  const entities = ruasList.map((code) => ({
    code,
    abbr: abbrev(code),
    name: code,
    sd: data.entities[code] || {},
    month: data.entities_month[code] || {}
  }));

  const monthName = (data.month_label || "").replace(/ 20\d\d$/, "") || "Bulan";

  // ---- Ringkasan regional (konsol SD realisasi) ----
  const summary = [
    { k: "Total Pendapatan", v: num(cell(sd, "pend_usaha")[1]), color: "#fff" },
    { k: "Total EBITDA", v: num(cell(sd, "ebitda")[1]), color: "#7fd4a8" },
    { k: "Total Laba Operasi", v: num(cell(sd, "laba_operasi")[1]), color: "#7fd4a8" },
    { k: "Total EAT", v: num(cell(sd, "eat")[1]), color: "#ff8f93" }
  ];

  return (
    <SlideFrame
      title="Kinerja Keuangan Regional"
      subtitle={periodLabel}
      scopeLabel={scopeLabel}
      rightMeta={
        <>
          dalam <b>juta rupiah</b>
        </>
      }
    >
      <div className={styles.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{k.label}</div>
            <div className={`${styles.kpiValue} ${k.valueNeg ? styles.neg : ""}`}>{k.value}</div>
            <div className={styles.kpiSubs}>
              {k.subs.map((s) => (
                <div key={s.k} className={styles.kpiSub}>
                  <span>{s.k}</span>
                  <span className={s.neg ? styles.neg : ""}>{s.v}</span>
                </div>
              ))}
            </div>
            <div className={styles.kpiVs}>
              {k.vs.map((v) => (
                <div key={v.label} className={styles.kpiVsRow}>
                  <span style={{ color: v.color }}>{v.arrow}</span>
                  <span className={styles.kpiVsPct} style={{ color: v.color }}>
                    {v.pct}
                  </span>
                  <span className={styles.kpiVsLabel}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.main}>
        {/* Kiri — P&L per tipe */}
        <div className={styles.pnlCard}>
          <div className={styles.pnlHead}>
            <div>
              <div className={styles.pnlTitle}>KINERJA LABA RUGI PER TIPE</div>
              <div className={styles.pnlSub}>RKAP vs Realisasi · per ruas</div>
            </div>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${showSept ? styles.tabOn : ""}`}
                onClick={() => setShowSept((v) => !v)}
              >
                {monthName}
              </button>
              <button type="button" className={`${styles.tab} ${styles.tabOn} ${styles.tabStatic}`}>
                S.d {monthName}
              </button>
            </div>
          </div>

          <div className={styles.legend}>
            {showSept && (
              <>
                <LegItem c={PNL_COLORS.rkapMo} t={`RKAP ${monthName}`} />
                <LegItem c={PNL_COLORS.realMo} t={`Real ${monthName}`} />
              </>
            )}
            <LegItem c={PNL_COLORS.rkapSd} t={showSept ? "RKAP S.d" : "RKAP"} />
            <LegItem c={PNL_COLORS.realSd} t={showSept ? "Real S.d" : "Realisasi"} />
            <span className={styles.entKey}>{entities.map((e) => `${e.abbr} ${e.name}`).join(" · ")}</span>
          </div>

          <div className={styles.pnlGrid}>
            {PNL_METRICS.map((m) => {
              const ach = panelAch(entities, m, showSept);
              return (
                <div key={m.key} className={styles.panel}>
                  <div className={styles.panelHead}>
                    <span className={styles.panelLabel}>{m.label}</span>
                    <span className={styles.panelAchs}>
                      {showSept && ach.month != null && (
                        <span className={styles.panelAch} style={{ color: ach.monthGood ? GREEN : RED }}>
                          <em>{monthName.slice(0, 3)}</em> {idPct.format(ach.month)}%
                        </span>
                      )}
                      {ach.sd != null && (
                        <span className={styles.panelAch} style={{ color: ach.sdGood ? GREEN : RED }}>
                          {showSept && <em>S.d</em>} {idPct.format(ach.sd)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.panelChart}>
                    <PnlMiniChart entities={entities} metric={m.key} showSept={showSept} />
                  </div>
                </div>
              );
            })}

            {/* Tile ringkasan (sel ke-6) */}
            <div className={styles.summary}>
              <div className={styles.summaryTitle}>RINGKASAN REGIONAL</div>
              {summary.map((s) => (
                <div key={s.k} className={styles.summaryRow}>
                  <span>{s.k}</span>
                  <span style={{ color: s.color }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kanan — LHR & PHR */}
        <div className={styles.sideCol}>
          <TrafficTable title={`LHR TERHADAP RKAP · ${monthName.toUpperCase()}`} rows={data.lhr} empty="Belum ada data LHR" />
          <TrafficTable title={`PHR TERHADAP RKAP · ${monthName.toUpperCase()}`} rows={data.phr} empty="Belum ada data PHR" />
        </div>
      </div>
    </SlideFrame>
  );
}

function LegItem({ c, t }: { c: string; t: string }) {
  return (
    <span className={styles.legItem}>
      <span className={styles.sw} style={{ background: c }} />
      {t}
    </span>
  );
}

// ---- KPI builder ----
interface KpiDef {
  label: string;
  value: string;
  valueNeg: boolean;
  subs: { k: string; v: string; neg: boolean }[];
  vs: { arrow: string; pct: string; label: string; color: string }[];
}
const UP = "▲";
const DOWN = "▼";

function buildKpis(sd: EntityData, fy: EntityData): KpiDef[] {
  // amount KPI: value = real s.d; subs = YTD RKAP (rkap s.d) + FY RKAP (jumlah); vs = pencapaian.
  const amount = (label: string, acc: string, lowerBetter: boolean): KpiDef => {
    const [rkapSd, realSd] = cell(sd, acc);
    const fyRkap = cell(fy, acc)[0];
    const vsYtd = ratio(realSd, rkapSd);
    const vsFy = ratio(realSd, fyRkap);
    const good = (r: number | null | undefined, k: number | null | undefined) =>
      r == null || k == null ? false : lowerBetter ? r <= k : r >= k;
    const mkVs = (pct: number | null, k: number | null | undefined, label: string) => ({
      arrow: realSd != null && k != null && realSd >= k ? UP : DOWN,
      pct: pct == null ? "–" : `${idPct.format(pct)}%`,
      label,
      color: good(realSd, k) ? GREEN : RED
    });
    return {
      label,
      value: num(realSd),
      valueNeg: (realSd ?? 0) < 0,
      subs: [
        { k: "YTD RKAP", v: num(rkapSd), neg: (rkapSd ?? 0) < 0 },
        { k: "FY RKAP", v: num(fyRkap), neg: (fyRkap ?? 0) < 0 }
      ],
      vs: [mkVs(vsYtd, rkapSd, "VS YTD RKAP"), mkVs(vsFy, fyRkap, "VS FY RKAP")]
    };
  };

  // HPP (%): value = beban_langsung/pend_usaha; lower better (selisih poin persen).
  const hppVal = hppPct(sd, 1);
  const hppYtd = hppPct(sd, 0);
  const hppFy = (() => {
    const bl = cell(fy, "beban_langsung")[0];
    const pu = cell(fy, "pend_usaha")[0];
    return bl == null || pu == null || pu === 0 ? null : (bl / pu) * 100;
  })();
  const hppDiff = (v: number | null, base: number | null) => (v == null || base == null ? null : v - base);
  const hppVs = (v: number | null, base: number | null, label: string) => {
    const d = hppDiff(v, base);
    return {
      arrow: d != null && d > 0 ? UP : DOWN,
      pct: d == null ? "–" : `${idPct.format(d)}`,
      label,
      color: d != null && d <= 0 ? GREEN : RED // HPP turun = baik
    };
  };
  const hpp: KpiDef = {
    label: "HPP (%)",
    value: hppVal == null ? "–" : idPct.format(hppVal),
    valueNeg: false,
    subs: [
      { k: "YTD RKAP", v: hppYtd == null ? "–" : `${idPct.format(hppYtd)}%`, neg: false },
      { k: "FY RKAP", v: hppFy == null ? "–" : `${idPct.format(hppFy)}%`, neg: false }
    ],
    vs: [hppVs(hppVal, hppYtd, "VS YTD RKAP"), hppVs(hppVal, hppFy, "VS FY RKAP")]
  };

  return [
    amount("Pendapatan", "pend_usaha", false),
    hpp,
    amount("EBITDA", "ebitda", false),
    amount("Laba Bersih", "eat", false),
    amount("Interest", "bunga", true)
  ];
}

// ---- P&L metrik ----
const PNL_METRICS = [
  { key: "pend_usaha", label: "Pendapatan", lower: false },
  { key: "beban_langsung", label: "Biaya Langsung", lower: true },
  { key: "laba_operasi", label: "Laba Operasi", lower: false },
  { key: "ebitda", label: "EBITDA", lower: false },
  { key: "eat", label: "EAT", lower: false }
] as const;

type PnlMetric = (typeof PNL_METRICS)[number];
interface PnlEntity {
  code: string;
  abbr: string;
  name: string;
  sd: EntityData;
  month: EntityData;
}

function panelAch(entities: PnlEntity[], m: PnlMetric, showSept: boolean) {
  const agg = (idxCol: "sd" | "month") => {
    let r = 0;
    let a = 0;
    for (const e of entities) {
      const c = cell(e[idxCol], m.key);
      if (c[0] != null) r += c[0];
      if (c[1] != null) a += c[1];
    }
    const pct = r === 0 ? null : (a / r) * 100;
    const good = m.lower ? a <= r : a >= r;
    return { pct, good };
  };
  const s = agg("sd");
  const mo = showSept ? agg("month") : { pct: null, good: false };
  return { sd: s.pct, sdGood: s.good, month: mo.pct, monthGood: mo.good };
}

// ---- Mini grouped bar chart (Recharts, dukung nilai negatif) ----
// Warna = IDENTITAS seri (RKAP = teal, Real = merah) dan konsisten di kedua
// periode. Dimensi periode dibedakan lewat shade: bulan ini = shade lebih terang,
// S.d = shade penuh. Jadi "periode ini" & "s.d periode ini" memakai pewarnaan yang
// sama per seri, tetap terbaca saat ditampilkan bersamaan.
const PNL_COLORS = { rkapSd: "#2d7d93", realSd: "#cf3a3f", rkapMo: "#7ab8c7", realMo: "#e38a8d" } as const;
const tipStyle: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 11, color: "#1f2d3f", padding: "4px 8px" };

// Label nilai per batang: VERTIKAL (rotate -90) dan SELALU menempel di ujung LUAR
// batang (jauh dari garis nol) → positif: di atas puncak, tumbuh ke atas; negatif:
// di bawah dasar batang, tumbuh ke bawah. Jadi label batang minus konsisten dengan
// yang positif (tetap vertikal, menempel pada ujung batang), bukan mengambang di
// garis nol. Halo sewarna latar utk kontras.
function VBarLabel(color: string, size: number) {
  return (props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string | null }) => {
    const x = Number(props.x) || 0;
    const y = Number(props.y) || 0;
    const width = Number(props.width) || 0;
    const height = Number(props.height) || 0;
    const value = props.value == null ? null : Number(props.value);
    if (value == null || !Number.isFinite(value) || Math.round(value) === 0) return null;
    const cx = x + width / 2;
    const negative = value < 0;
    // Positif: `y` = puncak → label 3px di atasnya, anchor "start" (tumbuh ke atas).
    // Negatif: `y` = garis nol, `y + height` = dasar batang → label 3px di bawahnya,
    // anchor "end" (tumbuh ke bawah) → cermin dari batang positif.
    const ay = negative ? y + height + 3 : y - 3;
    return (
      <text
        x={cx}
        y={ay}
        transform={`rotate(-90, ${cx}, ${ay})`}
        textAnchor={negative ? "end" : "start"}
        dominantBaseline="central"
        fontSize={size}
        fontWeight={800}
        fill={color}
        style={{ fontVariantNumeric: "tabular-nums", paintOrder: "stroke" }}
        stroke="var(--surface-2)"
        strokeWidth={2.6}
      >
        {idNum.format(Math.round(value))}
      </text>
    );
  };
}

function PnlMiniChart({ entities, metric, showSept }: { entities: PnlEntity[]; metric: string; showSept: boolean }) {
  const rows = entities.map((e) => {
    const s = cell(e.sd, metric);
    const m = cell(e.month, metric);
    return { abbr: e.abbr, name: e.name, rkapSd: s[0], realSd: s[1], rkapMo: m[0], realMo: m[1] };
  });

  // Domain dgn headroom di atas (label positif) & bawah (label negatif) agar
  // label tak terpotong di tepi panel (ruang disediakan lewat skala, bukan margin).
  const vals = rows
    .flatMap((r) => (showSept ? [r.rkapMo, r.realMo, r.rkapSd, r.realSd] : [r.rkapSd, r.realSd]))
    .filter((v): v is number => v != null);
  const dmax = Math.max(0, ...vals);
  const dmin = Math.min(0, ...vals);
  const span = dmax - dmin || 1;
  // Label menempel di ujung luar batang → butuh headroom ATAS (0.34) utk label
  // positif dan, bila ada nilai negatif, headroom BAWAH yang sepadan utk label minus
  // agar tak terpotong tepi panel.
  const lo = dmin < 0 ? dmin - span * 0.34 : 0;
  let hi = Math.max(dmax, 0) + span * 0.34;
  if (hi === 0) hi = 1;

  const lblSize = showSept ? 8 : 10;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={rows}
        margin={{ top: 6, right: 4, bottom: 2, left: 2 }}
        barGap={showSept ? 1 : 2}
        barCategoryGap={showSept ? "12%" : "22%"}
      >
        <XAxis dataKey="abbr" tick={{ fontSize: 10, fontWeight: 700, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={0} height={15} />
        <YAxis hide domain={[lo, hi]} />
        <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
          contentStyle={tipStyle}
          labelFormatter={(_l, pl) => (pl && pl[0] ? (pl[0].payload as { name: string }).name : "")}
          formatter={(v: number, n: string) => [num(v), TIP_LABEL[n] || n]}
        />
        {showSept && (
          <>
            <Bar dataKey="rkapMo" name="rkapMo" fill={PNL_COLORS.rkapMo} radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive animationDuration={650} animationEasing="ease-out">
              <LabelList dataKey="rkapMo" content={VBarLabel(PNL_COLORS.rkapMo, lblSize)} />
            </Bar>
            <Bar dataKey="realMo" name="realMo" fill={PNL_COLORS.realMo} radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive animationDuration={650} animationEasing="ease-out">
              <LabelList dataKey="realMo" content={VBarLabel(PNL_COLORS.realMo, lblSize)} />
            </Bar>
          </>
        )}
        <Bar dataKey="rkapSd" name="rkapSd" fill={PNL_COLORS.rkapSd} radius={[2, 2, 0, 0]} maxBarSize={showSept ? 14 : 30} isAnimationActive animationDuration={650} animationEasing="ease-out">
          <LabelList dataKey="rkapSd" content={VBarLabel(PNL_COLORS.rkapSd, lblSize)} />
        </Bar>
        <Bar dataKey="realSd" name="realSd" fill={PNL_COLORS.realSd} radius={[2, 2, 0, 0]} maxBarSize={showSept ? 14 : 30} isAnimationActive animationDuration={650} animationEasing="ease-out">
          <LabelList dataKey="realSd" content={VBarLabel(PNL_COLORS.realSd, lblSize)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const TIP_LABEL: Record<string, string> = {
  rkapSd: "RKAP S.d",
  realSd: "Realisasi S.d",
  rkapMo: "RKAP Bulan",
  realMo: "Realisasi Bulan"
};

// ---- Tabel LHR / PHR ----
function TrafficTable({ title, rows, empty }: { title: string; rows: TrafficRow[]; empty: string }) {
  return (
    <div className={styles.tblCard}>
      <div className={styles.tblTitle}>{title}</div>
      {rows.length === 0 ? (
        <div className={styles.tblEmpty}>{empty}</div>
      ) : (
        <>
          <div className={`${styles.tblRow} ${styles.tblHeadRow}`}>
            <span>RUAS</span>
            <span className={styles.r}>RKAP</span>
            <span className={styles.r}>REAL</span>
            <span className={styles.r}>ACH</span>
          </div>
          <div className={styles.tblBody}>
            {rows.map((r) => {
              // Pencapaian <100% = merah (tanpa tier amber); >=100% = hijau.
              const good = r.ach >= 100;
              const pill = good ? GREEN : RED;
              return (
                <div key={r.ruas} className={styles.tblRow}>
                  <span className={styles.ruasName}>{r.ruas}</span>
                  <span className={styles.r}>{num(r.rkap)}</span>
                  <span className={styles.r}>{num(r.real)}</span>
                  <span className={styles.rPill}>
                    <span className={styles.pill} style={{ background: pill, color: "#fff" }}>
                      {good ? UP : DOWN} {idNum.format(Math.round(r.ach))}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function abbrev(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "");
  return clean.slice(0, 4).toUpperCase();
}
