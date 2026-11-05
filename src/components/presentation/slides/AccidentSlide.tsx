import { useEffect, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell, Customized
} from "recharts";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import { toOperationalRuas } from "@/lib/ruasAlias";
import type { AccidentPresentation } from "@/types/insights";
import styles from "./AccidentSlide.module.css";

/* ============================================================================
   Slide Kecelakaan (Rapat Direktorat) — scope regional. Dashboard eksekutif:
   KPI strip + hero (per lokasi | total tren) + analisis (penyebab | per waktu |
   korban | TK&TF gabung). Perbandingan 3 tahun mengikuti periode presentasi;
   TAHUN BERJALAN ditandai arsir + "s.d <bulan>" (belum setahun penuh).
   Warna: identitas tahun (navy/teal/amber) terpisah dari semantik (naik=merah,
   turun=hijau). Sumber: HK Partner API (/insights/accidents/*).
   ============================================================================ */

const C = {
  c24: "#123a5e", c25: "#1a8f9e", c26: "#e0a233",
  good: "#128a5a", bad: "#d4484b",
  ink: "#16202e", muted: "#5b6b80", faint: "#8a99ac", line: "#e2e7ee", grid: "#eef2f6",
  tk: "#123a5e", tf: "#d4484b"
};
const YEAR_COLORS = [C.c24, C.c25, C.c26];
const HATCH = ["acc-h-0", "acc-h-1", "acc-h-2"];
const tip: CSSProperties = { background: "#fff", border: "1px solid #e4e9ef", borderRadius: 8, fontSize: 12, color: C.ink };

// Format id-ID. TK/TF = 2 desimal di muka (leading "0," terjaga via toLocaleString),
// 4 desimal hanya di tooltip. Jumlah = bilangan bulat.
const nf = (n: number | null | undefined, d = 0) =>
  n == null ? "–" : Number(n).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const rate2 = (n: number | null | undefined) => nf(n, 2);
const rate4 = (n: number | null | undefined) => nf(n, 4);
const labelInt = (v: number | string) => (Number(v) > 0 ? nf(Number(v)) : "");
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

interface Props {
  data: AccidentPresentation | null;
  periodLabel?: string;
  scopeLabel?: string | null;
  /** Pengali ukuran font label grafik (1 = normal). */
  fontScale?: number;
}

// Pola arsir untuk tahun berjalan (belum setahun penuh) — satu per warna tahun.
// Didefinisikan di SATU <svg> tersembunyi di root slide (bukan di dalam chart:
// Recharts tidak merender komponen anak kustom, jadi rujukan url(#id) akan gagal
// → batang transparan). Rujukan url(#id) lintas-SVG berfungsi di Chromium.
function HatchSvg() {
  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <defs>
        {YEAR_COLORS.map((color, i) => (
          <pattern key={i} id={HATCH[i]} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
            <rect width={6} height={6} fill={color} />
            <line x1={0} y1={0} x2={0} y2={6} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={2} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

export function AccidentSlide({ data, periodLabel, scopeLabel, fontScale = 1 }: Props) {
  // Skala ukuran font label grafik (tick & label nilai) mengikuti setelan slide.
  const fz = (n: number) => Math.round(n * fontScale * 100) / 100;
  const hasData = !!data && !data.empty && data.total_by_year.some((t) => t.total > 0);

  // Posisi geser (drag) tiap callout — offset dari posisi default. Reset saat
  // ganti scope/periode. Tidak dipersist (sesi tampilan saja).
  const [calloutPos, setCalloutPos] = useState<Record<string, { dx: number; dy: number }>>({});
  useEffect(() => {
    setCalloutPos({});
  }, [data?.scope.key, data?.period?.year]);

  // Mulai drag sebuah callout: konversi delta client→unit SVG (perhitungkan skala
  // stage presentasi yang bisa di-transform scale).
  const startCalloutDrag = (id: string) => (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    let scale = 1;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const wAttr = svg.width?.baseVal?.value || rect.width;
      scale = wAttr ? rect.width / wAttr : 1;
    }
    const sx = e.clientX, sy = e.clientY;
    const base = calloutPos[id] || { dx: 0, dy: 0 };
    const move = (ev: globalThis.PointerEvent) => {
      const dx = base.dx + (ev.clientX - sx) / (scale || 1);
      const dy = base.dy + (ev.clientY - sy) / (scale || 1);
      setCalloutPos((p) => ({ ...p, [id]: { dx, dy } }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!data || !hasData) {
    return (
      <SlideFrame title="Data Kecelakaan" subtitle={periodLabel} scopeLabel={scopeLabel} flush stagger={false}>
        <div className={styles.slide}>
          <div className={styles.emptyBox}>
            <div className={styles.emptyTitle}>Belum ada data kecelakaan</div>
            <div className={styles.emptySub}>{data?.narratives.overall || "Data tidak tersedia untuk lingkup ini."}</div>
          </div>
        </div>
      </SlideFrame>
    );
  }

  const years = data.years;
  const nY = years.length;
  const isPartial = data.period.month < 12; // tahun berjalan belum setahun penuh
  const partialYear = years[nY - 1];
  const mon = data.period.report_month_label ? data.period.report_month_label.slice(0, 3) : "";
  const prevYear = years[nY - 2];
  const yrColor = (i: number) => YEAR_COLORS[i] ?? C.c25;
  // Arsir utk tahun berjalan; warna solid sebagai fallback (SVG2 paint fallback)
  // agar batang tetap tampil bila pola tak ter-resolve.
  const yrFill = (i: number) => (i === nY - 1 && isPartial ? `url(#${HATCH[i]}) ${yrColor(i)}` : yrColor(i));
  const seriesFill = (si: number, i: number) =>
    i === nY - 1 && isPartial ? `url(#${HATCH[si]}) ${YEAR_COLORS[si]}` : YEAR_COLORS[si];

  // --- KPI strip ---
  const T = data.total_by_year, V = data.victims_by_year, TKa = data.tk_by_year, TFa = data.tf_by_year;
  const curTotal = T[nY - 1]?.total ?? null, prevTotal = T[nY - 2]?.total ?? null;
  const curMd = V[nY - 1]?.md ?? null, prevMd = V[nY - 2]?.md ?? null;
  const curTk = TKa[nY - 1]?.rate ?? null, prevTk = TKa[nY - 2]?.rate ?? null;
  const curTf = TFa[nY - 1]?.rate ?? null, prevTf = TFa[nY - 2]?.rate ?? null;

  // Arah semantik (semua metrik keselamatan: naik = buruk = merah ▲, turun = membaik = hijau ▼).
  const dirOf = (cur: number | null, base: number | null): "bad" | "good" | "flat" =>
    cur == null || base == null ? "flat" : cur > base ? "bad" : cur < base ? "good" : "flat";

  const kpis = [
    { lab: "Total Kejadian", big: nf(curTotal), unit: `s.d ${mon}`, dir: dirOf(curTotal, prevTotal),
      delta: prevTotal == null ? "" : `${(curTotal ?? 0) > prevTotal ? ">" : "≤"} ${prevYear} penuh`,
      ctx: prevTotal == null ? "" : `${nf(curTotal)} (s.d ${mon}) vs ${nf(prevTotal)} (${prevYear} setahun)` },
    { lab: "Korban Meninggal", big: nf(curMd), unit: `MD · s.d ${mon}`, dir: dirOf(curMd, prevMd),
      delta: prevMd == null ? "" : `dari ${nf(prevMd)} (${prevYear})`,
      ctx: prevMd == null ? "" : `Dibanding ${nf(prevMd)} di ${prevYear} penuh` },
    { lab: "Tingkat Kecelakaan", big: rate2(curTk), unit: "TK", dir: dirOf(curTk, prevTk),
      delta: prevTk == null ? "" : `dari ${rate2(prevTk)} (${prevYear})`,
      ctx: prevTk == null ? "" : `Accident rate ${(curTk ?? 0) > prevTk ? "menanjak" : "menurun"}` },
    { lab: "Tingkat Fatality", big: rate2(curTf), unit: "TF", dir: dirOf(curTf, prevTf),
      delta: prevTf == null ? "" : `dari ${rate2(prevTf)} (${prevYear})`,
      ctx: prevTf == null ? "" : `Fatality rate ${(curTf ?? 0) > prevTf ? "memburuk" : "membaik"}` }
  ];

  // --- data per kartu ---
  // Label sumbu-X memakai KODE RUAS operasional (mis. TERPEKA, ATP, BINSA) — ringkas
  // & konsisten lintas slide — bukan nama lokasi panjang. [[ruas-naming-canonical]]
  const locCode = (l: { key: string; label: string }) => toOperationalRuas(l.key || l.label);
  // Tampilkan SEMUA lokasi/cabang (diurut terbanyak di backend), bukan hanya top-N,
  // agar seluruh ruas lingkup terlihat (mis. 13 cabang di divisi).
  const locData = data.per_location.map((l) => {
    const row: Record<string, number | string> = { label: locCode(l) };
    for (const y of l.by_year) row[String(y.year)] = y.count;
    return row;
  });
  const totalData = T.map((t) => ({ label: String(t.year), v: t.total, year: t.year }));
  const victimData = V.map((v) => ({ label: String(v.year), year: v.year, LR: v.lr, LB: v.lb, MD: v.md }));
  const causeTotal = data.causes.reduce((s, c) => s + c.count, 0);
  const causeData = [...data.causes].sort((a, b) => b.count - a.count).slice(0, 5).map((c) => ({ label: c.label, count: c.count }));
  const blockData = data.by_time_block;
  const blockPeak = Math.max(0, ...blockData.map((b) => b.count));
  const rateData = years.map((y, i) => ({ label: String(y), tk: TKa[i]?.rate ?? null, tf: TFa[i]?.rate ?? null }));

  // --- takeaway (diturunkan dari data) ---
  const locDeltas = data.per_location.map((l) => {
    const cur = l.by_year[nY - 1]?.count ?? 0, prev = l.by_year[nY - 2]?.count ?? 0;
    return { label: locCode(l), cur, prev, delta: cur - prev };
  });
  const locTop = [...locDeltas].sort((a, b) => b.delta - a.delta)[0];
  const causeTop = causeData[0];
  const causePct = causeTop && causeTotal ? Math.round((causeTop.count / causeTotal) * 100) : 0;
  const locTopIdx = locTop ? locData.findIndex((r) => r.label === locTop.label) : -1;
  const blockTop = [...blockData].sort((a, b) => b.count - a.count)[0];
  const blockTopIdx = blockTop ? blockData.findIndex((b) => b.key === blockTop.key) : -1;

  // Tick sumbu-X tahun: tambah "s.d <bln>" di bawah tahun berjalan.
  const YearTick = (star = false) =>
    function Tick(p: { x?: number; y?: number; payload?: { value?: string } }) {
      const val = p.payload?.value ?? "";
      const partial = Number(val) === partialYear && isPartial;
      return (
        <g transform={`translate(${p.x},${p.y})`}>
          <text x={0} y={0} dy={12} textAnchor="middle" fontSize={fz(11)} fontWeight={700} fill={C.muted}>
            {val}{partial && star ? " *" : ""}
          </text>
          {partial ? <text x={0} y={0} dy={24} textAnchor="middle" fontSize={fz(9)} fill={C.faint}>s.d {mon}</text> : null}
        </g>
      );
    };

  // Tick ruas (bisa panjang) → bungkus ≤2 baris.
  function RuasTick(p: { x?: number; y?: number; payload?: { value?: string } }) {
    const raw = String(p.payload?.value ?? "");
    const words = raw.split(/\s*[–-]\s*|\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 16 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
      if (lines.length === 2) break;
    }
    if (cur && lines.length < 2) lines.push(cur);
    return (
      <g transform={`translate(${p.x},${p.y})`}>
        {lines.map((ln, i) => (
          <text key={i} x={0} y={0} dy={11 + i * 10} textAnchor="middle" fontSize={fz(9)} fill={C.muted}>{ln}</text>
        ))}
      </g>
    );
  }

  // Tick blok waktu: nama + rentang jam (2 baris).
  function BlockTick(p: { x?: number; y?: number; payload?: { value?: string }; index?: number }) {
    const val = p.payload?.value ?? "";
    const range = blockData[p.index ?? -1]?.range ?? "";
    return (
      <g transform={`translate(${p.x},${p.y})`}>
        <text x={0} y={0} dy={11} textAnchor="middle" fontSize={fz(9.5)} fontWeight={700} fill={C.ink}>{val}</text>
        {range ? <text x={0} y={0} dy={22} textAnchor="middle" fontSize={fz(8.5)} fill={C.faint}>{range}</text> : null}
      </g>
    );
  }

  // Titik garis: titik terakhir (tahun berjalan) dibuat kosong (hollow).
  const rateDot = (color: string) =>
    function Dot(p: { cx?: number; cy?: number; index?: number; value?: number | null }) {
      if (p.cx == null || p.cy == null || p.value == null) return <g key={`${p.index}`} />;
      const hollow = p.index === nY - 1 && isPartial;
      return <circle key={`${p.index}`} cx={p.cx} cy={p.cy} r={4.5} fill={hollow ? "#fff" : color} stroke={color} strokeWidth={2} />;
    };

  return (
    <SlideFrame
      title="Data Kecelakaan"
      subtitle={`Data s.d ${data.period.report_month_label ?? ""} ${data.period.year}`.trim()}
      scopeLabel={scopeLabel}
      flush
      stagger={false}
      rightMeta={
        <span className={styles.legend}>
          {years.map((y, i) => <span key={y}><span className={styles.sw} style={{ background: yrColor(i) }} />{y}</span>)}
          {isPartial ? <span><span className={`${styles.sw} ${styles.swHatch}`} />s.d {mon}</span> : null}
        </span>
      }
      footnote={
        <>
          Tahun berjalan ({partialYear}) dipotong di bulan laporan dan ditandai arsir. TK/TF ditampilkan 2 desimal; presisi penuh (4 desimal) di tooltip.
          {isPartial ? ` * ${partialYear} s.d ${mon}.` : ""}
          {data.stale ? " · Menampilkan data terakhir tersimpan (sumber tidak tersedia)." : ""}
        </>
      }
    >
      <div className={styles.slide}>
        <HatchSvg />
        <div className={`${styles.body} pfx-stagger`}>
          {/* KPI strip */}
          <div className={styles.kpis}>
            {kpis.map((k) => (
              <div key={k.lab} className={styles.kpi}>
                <span className={styles.kpiLab}>{k.lab}</span>
                <div className={styles.kpiVal}><span className={styles.kpiBig}>{k.big}</span><span className={styles.kpiUnit}>{k.unit}</span></div>
                {k.delta ? (
                  <span className={`${styles.delta} ${k.dir === "bad" ? styles.upBad : k.dir === "good" ? styles.downGood : ""}`}>
                    {k.dir === "bad" ? "▲" : k.dir === "good" ? "▼" : ""} {k.delta}
                  </span>
                ) : null}
                <span className={styles.kpiCtx}>{k.ctx}</span>
              </div>
            ))}
          </div>

          {/* HERO: per lokasi | total tren */}
          <div className={styles.heroBand}>
            <div className={`${styles.card} ${styles.cLok}`}>
              <div className={styles.ch}>
                <h3 className={styles.cTitle}>Kejadian Kecelakaan per Lokasi</h3>
                <span className={styles.legend}>
                  {years.map((y, i) => <span key={y}><span className={styles.sw} style={{ background: yrColor(i) }} />{y}</span>)}
                  {isPartial ? <span><span className={`${styles.sw} ${styles.swHatch}`} />s.d {mon}</span> : null}
                </span>
              </div>
              <div className={styles.plot}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locData} margin={{ top: 20, right: 6, bottom: 20, left: 2 }} barGap={2} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={RuasTick} tickLine={false} axisLine={{ stroke: C.line }} interval={0} height={30} />
                    <YAxis tick={{ fontSize: fz(10), fill: C.faint }} width={30} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [nf(v), n]} />
                    {years.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={yrFill(i)} radius={[4, 4, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey={String(y)} position="top" formatter={labelInt} style={{ fontSize: fz(10), fontWeight: 700, fill: C.muted }} />
                      </Bar>
    ))}
                    {locTop && locTopIdx >= 0 ? (
                      <Customized component={(p: unknown) => <BarCallout chart={p} seriesKey={String(partialYear)} index={locTopIdx} orient="v" title={`Titik rawan · ${data.period.year}`} sub={`${short(locTop.label, 15)}: ${nf(locTop.cur)} kejadian`} offDx={calloutPos.lok?.dx || 0} offDy={calloutPos.lok?.dy || 0} onDragStart={startCalloutDrag("lok")} />} />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${styles.card} ${styles.cTot}`}>
              <div className={styles.ch}><h3 className={styles.cTitle}>Total Kejadian Kecelakaan</h3><span className={styles.yr}>tren tahunan</span></div>
              <div className={styles.plot}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={totalData} margin={{ top: 22, right: 8, bottom: 22, left: 2 }} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={YearTick(false)} tickLine={false} axisLine={{ stroke: C.line }} height={34} interval={0} />
                    <YAxis tick={{ fontSize: fz(10), fill: C.faint }} width={30} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tip} formatter={(v: number) => [nf(v), "Kejadian"]} />
                    <Bar dataKey="v" radius={[5, 5, 0, 0]} maxBarSize={70}>
                      {totalData.map((d, i) => <Cell key={d.year} fill={yrFill(i)} />)}
                      <LabelList dataKey="v" position="top" formatter={labelInt} style={{ fontSize: fz(13), fontWeight: 700, fill: C.ink }} />
                    </Bar>
                    {curTotal != null && prevTotal != null ? (
                      <Customized component={(p: unknown) => <BarCallout chart={p} seriesKey="v" index={nY - 1} orient="v" title={`${nf(curTotal)} kejadian · s.d ${mon}`} sub={`${curTotal > prevTotal ? "melewati" : "di bawah"} ${prevYear} penuh (${nf(prevTotal)})`} offDx={calloutPos.total?.dx || 0} offDy={calloutPos.total?.dy || 0} onDragStart={startCalloutDrag("total")} />} />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ANALISIS: penyebab | per waktu | korban | TK&TF */}
          <div className={styles.gridBand}>
            <div className={styles.card}>
              <div className={styles.ch}><h3 className={styles.cTitle}>Penyebab Kecelakaan</h3><span className={styles.yr}>s.d {mon} {data.period.year}</span></div>
              <div className={styles.plot}>
                {causeData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={causeData} layout="vertical" margin={{ top: 2, right: 34, bottom: 2, left: 2 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: fz(9.5), fill: C.muted }} width={92} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tip} formatter={(v: number) => [nf(v), "Kejadian"]} />
                      <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={20}>
                        {causeData.map((d, i) => <Cell key={d.label} fill={i === 0 ? C.bad : C.c24} />)}
                        <LabelList dataKey="count" position="right" formatter={labelInt} style={{ fontSize: fz(10), fontWeight: 700, fill: C.ink }} />
                      </Bar>
                      {causeTop && causeTotal ? (
                        <Customized component={(p: unknown) => <BarCallout chart={p} seriesKey="count" index={0} orient="h" title={`Penyebab dominan · ${causePct}%`} sub={`${short(causeTop.label, 16)}: ${nf(causeTop.count)}`} offDx={calloutPos.cause?.dx || 0} offDy={calloutPos.cause?.dy || 0} onDragStart={startCalloutDrag("cause")} />} />
                      ) : null}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className={styles.miniEmpty}>Tidak ada data</div>}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.ch}><h3 className={styles.cTitle}>Kejadian per Waktu</h3><span className={styles.yr}>s.d {mon} {data.period.year}</span></div>
              <div className={styles.plot}>
                {blockData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={blockData} margin={{ top: 16, right: 6, bottom: 22, left: 2 }} barCategoryGap="22%">
                      <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={BlockTick} tickLine={false} axisLine={{ stroke: C.line }} interval={0} height={32} />
                      <YAxis tick={{ fontSize: fz(9), fill: C.faint }} width={24} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tip} formatter={(v: number, _n: string, pl: { payload?: { range?: string } }) => [nf(v), pl?.payload?.range || "Kejadian"]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
                        {blockData.map((b) => <Cell key={b.key} fill={b.count >= blockPeak && blockPeak > 0 ? C.bad : C.c26} />)}
                        <LabelList dataKey="count" position="top" formatter={labelInt} style={{ fontSize: fz(10), fontWeight: 700, fill: C.ink }} />
                      </Bar>
                      {blockTop && blockTop.count > 0 && blockTopIdx >= 0 ? (
                        <Customized component={(p: unknown) => <BarCallout chart={p} seriesKey="count" index={blockTopIdx} orient="v" title={`Puncak · ${blockTop.range}`} sub={`${blockTop.label}: ${nf(blockTop.count)} kejadian`} offDx={calloutPos.jam?.dx || 0} offDy={calloutPos.jam?.dy || 0} onDragStart={startCalloutDrag("jam")} />} />
                      ) : null}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className={styles.miniEmpty}>Tidak ada data</div>}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.ch}>
                <h3 className={styles.cTitle}>Jumlah Korban</h3>
                <span className={styles.legend}>
                  <span><span className={styles.sw} style={{ background: C.c24 }} />LR</span>
                  <span><span className={styles.sw} style={{ background: C.c25 }} />LB</span>
                  <span><span className={styles.sw} style={{ background: C.c26 }} />MD</span>
                </span>
              </div>
              <div className={styles.plot}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={victimData} margin={{ top: 16, right: 4, bottom: 22, left: 2 }} barGap={1} barCategoryGap="26%">
                    <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={YearTick(false)} tickLine={false} axisLine={{ stroke: C.line }} height={34} interval={0} />
                    <YAxis tick={{ fontSize: fz(9), fill: C.faint }} width={24} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [nf(v), n]} />
                    {(["LR", "LB", "MD"] as const).map((key, si) => (
                      <Bar key={key} dataKey={key} name={key} radius={[3, 3, 0, 0]} maxBarSize={15}>
                        {victimData.map((d, i) => <Cell key={d.year} fill={seriesFill(si, i)} />)}
                        <LabelList dataKey={key} position="top" formatter={labelInt} style={{ fontSize: fz(8), fontWeight: 700, fill: C.muted }} />
                      </Bar>
                    ))}
                    {curMd != null && prevMd != null ? (
                      <Customized component={(p: unknown) => <BarCallout chart={p} seriesKey="MD" index={nY - 1} orient="v" title={`MD ${curMd < prevMd ? "turun" : "naik"} · ${nf(curMd)}`} sub={`dari ${nf(prevMd)} (${prevYear} penuh)`} offDx={calloutPos.korban?.dx || 0} offDy={calloutPos.korban?.dy || 0} onDragStart={startCalloutDrag("korban")} />} />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.ch}>
                <h3 className={styles.cTitle}>Tingkat Kecelakaan & Fatality</h3>
                <span className={styles.legend}>
                  <span><span className={styles.sw} style={{ background: C.tk }} />TK</span>
                  <span><span className={styles.sw} style={{ background: C.tf }} />TF</span>
                </span>
              </div>
              <div className={styles.plot}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rateData} margin={{ top: 22, right: 24, bottom: 22, left: 24 }}>
                    <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={YearTick(true)} tickLine={false} axisLine={{ stroke: C.line }} height={34} interval={0} />
                    <YAxis hide domain={[0, "auto"]} />
                    <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [rate4(v), n === "tk" ? "TK" : "TF"]} />
                    <Line type="monotone" dataKey="tk" name="TK" stroke={C.tk} strokeWidth={2.6} dot={rateDot(C.tk)} activeDot={{ r: 5 }} connectNulls>
                      <LabelList dataKey="tk" position="top" offset={8} formatter={(v: number) => rate2(v)} style={{ fontSize: fz(10.5), fontWeight: 700, fill: C.tk }} />
                    </Line>
                    <Line type="monotone" dataKey="tf" name="TF" stroke={C.tf} strokeWidth={2.6} dot={rateDot(C.tf)} activeDot={{ r: 5 }} connectNulls>
                      <LabelList dataKey="tf" position="bottom" offset={8} formatter={(v: number) => rate2(v)} style={{ fontSize: fz(10.5), fontWeight: 700, fill: C.tf }} />
                    </Line>
                    {curTk != null && prevTk != null ? (
                      <Customized component={(p: unknown) => <ChartCallout chart={p} orient="v" cat={String(partialYear)} val={curTk} title={`TK ${curTk > (prevTk ?? 0) ? "naik" : "turun"} · ${rate2(curTk)}`} sub={curTf != null ? `TF ${rate2(curTf)}${prevTf != null ? (curTf < prevTf ? " (membaik)" : " (memburuk)") : ""}` : ""} offDx={calloutPos.tktf?.dx || 0} offDy={calloutPos.tktf?.dy || 0} onDragStart={startCalloutDrag("tktf")} />} />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

/* Callout yang menempel PERSIS di ujung sebuah batang. Geometri batang diambil
   dari state chart Recharts (`formattedGraphicalItems`) → akurat untuk bar
   berkelompok sekalipun. orient "v": kolom (titik = tengah-atas batang); "h": bar
   horizontal (titik = ujung kanan, tengah). Gelembung diletakkan di ATAS batang bila
   ada ruang (agar tak menutupi batang lain), jika tidak ke samping. */
function BarCallout({ chart, seriesKey, index, orient, title, sub, offDx = 0, offDy = 0, onDragStart }: {
  chart: unknown; seriesKey: string; index: number; orient: "v" | "h"; title: string; sub: string;
  offDx?: number; offDy?: number; onDragStart?: (e: ReactPointerEvent<SVGElement>) => void;
}) {
  if (index == null || index < 0) return null;
  const ch = chart as {
    formattedGraphicalItems?: Array<{
      props?: { dataKey?: unknown; data?: Array<{ x: number; y: number; width: number; height: number }> };
      item?: { props?: { dataKey?: unknown } };
    }>;
    offset?: { top: number; left: number; width: number; height: number };
  };
  const items = Array.isArray(ch.formattedGraphicalItems) ? ch.formattedGraphicalItems : [];
  let geom: { x: number; y: number; width: number; height: number } | null = null;
  for (const gi of items) {
    const dk = gi?.item?.props?.dataKey ?? gi?.props?.dataKey;
    if (String(dk) !== String(seriesKey)) continue;
    const pts = gi?.props?.data;
    if (Array.isArray(pts) && pts[index]) { geom = pts[index]; break; }
  }
  if (!geom || !ch.offset) return null;
  const gx = Number(geom.x), gy = Number(geom.y), gw = Number(geom.width), gh = Number(geom.height);
  if (![gx, gy, gw, gh].every(Number.isFinite)) return null;
  const anchorX = orient === "h" ? gx + gw : gx + gw / 2;
  const anchorY = orient === "h" ? gy + gh / 2 : gy;

  const { top, left, width, height } = ch.offset;
  const right = left + width, bottom = top + height;
  const bw = Math.min(236, Math.max(126, Math.max(title.length, sub.length) * 6 + 24));
  const bh = sub ? 40 : 26;
  const ARM = 34; // panjang "tangan" penunjuk
  let bx: number, by: number;
  if (orient === "v") {
    bx = Math.min(right - bw - 2, Math.max(left + 2, anchorX - bw / 2));
    by = anchorY - ARM - bh;
    if (by < top + 2) { // tak cukup ruang di atas → ke samping
      const flip = anchorX + ARM + bw > right;
      bx = flip ? anchorX - ARM - bw : anchorX + ARM;
      by = Math.min(bottom - bh - 2, Math.max(top + 2, anchorY + 4));
    }
  } else {
    const flip = anchorX + ARM + bw > right;
    bx = flip ? anchorX - ARM - bw : anchorX + ARM;
    by = Math.min(bottom - bh - 2, Math.max(top + 2, anchorY - bh / 2));
  }
  bx += offDx;
  by += offDy;
  const lx = Math.max(bx, Math.min(anchorX, bx + bw));
  const ly = Math.max(by, Math.min(anchorY, by + bh));
  const accent = C.c24;
  return (
    <g>
      <circle cx={anchorX} cy={anchorY} r={8} fill={accent} opacity={0.14} pointerEvents="none" />
      <circle cx={anchorX} cy={anchorY} r={4.5} fill="#fff" stroke={accent} strokeWidth={2} pointerEvents="none" />
      <line x1={anchorX} y1={anchorY} x2={lx} y2={ly} stroke={accent} strokeWidth={1} strokeDasharray="2 2" pointerEvents="none" />
      <g onPointerDown={onDragStart} style={{ cursor: "move", touchAction: "none" }}>
        <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="rgba(255,255,255,0.9)" stroke={accent} strokeWidth={1.25} />
        <text x={bx + 11} y={by + (sub ? 16 : 17)} fontSize={11} fontWeight={800} fill={C.ink}>{title}</text>
        {sub ? <text x={bx + 11} y={by + 31} fontSize={11} fontWeight={600} fill={C.muted}>{sub}</text> : null}
      </g>
    </g>
  );
}

/* Callout menempel pada titik data (gaya slide Sentimen): marker + penunjuk putus
   + gelembung. Posisi dihitung dari skala Recharts. orient "v" = kategori di sumbu-X
   (bar kolom / garis), "h" = kategori di sumbu-Y (bar horizontal). */
function ChartCallout({ chart, orient, cat, val, title, sub, offDx = 0, offDy = 0, onDragStart }: {
  chart: unknown; orient: "v" | "h"; cat: string; val: number; title: string; sub: string;
  offDx?: number; offDy?: number; onDragStart?: (e: ReactPointerEvent<SVGElement>) => void;
}) {
  const ch = chart as {
    xAxisMap?: Record<string, { scale: (v: unknown) => number; bandwidth?: () => number }>;
    yAxisMap?: Record<string, { scale: (v: unknown) => number; bandwidth?: () => number }>;
    offset?: { top: number; left: number; width: number; height: number };
  };
  const xA = ch.xAxisMap && Object.values(ch.xAxisMap)[0];
  const yA = ch.yAxisMap && Object.values(ch.yAxisMap)[0];
  if (!xA || !yA || !ch.offset) return null;
  const bandX = typeof xA.bandwidth === "function" ? xA.bandwidth() : 0;
  const bandY = typeof yA.bandwidth === "function" ? yA.bandwidth() : 0;
  const px = orient === "h" ? Number(xA.scale(val)) : Number(xA.scale(cat)) + bandX / 2;
  const py = orient === "h" ? Number(yA.scale(cat)) + bandY / 2 : Number(yA.scale(val));
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  const { top, left, width, height } = ch.offset;
  const right = left + width, bottom = top + height;
  const bw = Math.min(234, Math.max(128, Math.max(title.length, sub.length) * 6 + 26));
  const bh = 40;
  const ARM = 34; // panjang "tangan" penunjuk
  const flip = px + ARM + bw > right;
  const bx = (flip ? px - ARM - bw : px + ARM) + offDx;
  const by = Math.min(bottom - bh - 2, Math.max(top + 2, py - bh / 2)) + offDy;
  const near = Math.max(bx, Math.min(px, bx + bw));
  const nearY = Math.max(by, Math.min(py, by + bh));
  const accent = C.c24;
  return (
    <g>
      <circle cx={px} cy={py} r={9} fill={accent} opacity={0.14} pointerEvents="none" />
      <circle cx={px} cy={py} r={5} fill="#fff" stroke={accent} strokeWidth={2} pointerEvents="none" />
      <line x1={px} y1={py} x2={near} y2={nearY} stroke={accent} strokeWidth={1} strokeDasharray="2 2" pointerEvents="none" />
      <g onPointerDown={onDragStart} style={{ cursor: "move", touchAction: "none" }}>
        <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="rgba(255,255,255,0.9)" stroke={accent} strokeWidth={1.25} />
        <text x={bx + 12} y={by + 16} fontSize={11} fontWeight={800} fill={C.ink}>{title}</text>
        <text x={bx + 12} y={by + 31} fontSize={11} fontWeight={600} fill={C.muted}>{sub}</text>
      </g>
    </g>
  );
}
