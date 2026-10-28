import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Customized
} from "recharts";
import { SlideFrame } from "@/components/presentation/SlideFrame";
import type { SentimentDashboard, SentimentNode, SentimentStatus } from "@/types/sentiment";
import styles from "./SentimentDashboardSlide.module.css";

/* ============================================================================
   Dashboard Sentimen Media — 1 slide drill-down (redesign handoff, varian 1a).
   Tema terang (IBM Plex), palet final handoff. Banner status + KPI strip +
   komposisi (donut) + tren harian (anotasi puncak negatif) + Kesimpulan
   (hero takeaway + 4 insight) + Peta Wilayah (daftar baris, drill).
   ============================================================================ */

const C = {
  neg: "#D1495B", pos: "#1F9D6B", neu: "#8496B0", primary: "#3C63B4", atensi: "#C08A1E",
  ink: "#2E3D4F", ink2: "#586878", muted: "#76859A", faint: "#9AA8B9", divider: "#EEF1F5", line: "#E4E9EF"
};
const STATUS_COL: Record<SentimentStatus, string> = { aman: "#1F9D6B", atensi: "#C08A1E", kritis: "#D1495B" };
const STATUS_WORD: Record<SentimentStatus, string> = { aman: "Aman", atensi: "Perlu Atensi", kritis: "Kritis" };
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmt(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("id-ID");
}
function compact(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")} M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(".", ",")} rb`;
  return fmt(v);
}
function pct(n: number): string {
  return `${Number(n || 0).toFixed(1).replace(".", ",")}%`;
}
function dayShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])}/${m[2]}` : iso;
}
function dayLong(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/* ---- ikon inline (stroke mengikuti currentColor) ---- */
const sIcon = (d: ReactNode, fill = false) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const IcFlame = sIcon(<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />);
const IcShield = sIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>);
const IcAlert = sIcon(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>);
const IcChart = sIcon(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>);
const IcTrend = sIcon(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>);
const IcPin = sIcon(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
const IcVol = sIcon(<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>);
const IcHome = sIcon(<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
const IcArrowR = sIcon(<path d="M5 12h14M12 5l7 7-7 7" />);
const IcArrowLeft = sIcon(<path d="M19 12H5M12 19l-7-7 7-7" />);
const STATUS_ICON: Record<SentimentStatus, ReactNode> = { aman: IcShield, atensi: IcAlert, kritis: IcFlame };

interface Props {
  data: SentimentDashboard | null;
  periodLabel: string;
  scopeLabel?: string | null;
}

export function SentimentDashboardSlide({ data, periodLabel }: Props) {
  const rootId = data?.root_id ?? "";
  const [curId, setCurId] = useState(rootId);
  useEffect(() => setCurId(rootId), [rootId]);

  const node: SentimentNode | null = data ? data.nodes[curId] ?? data.nodes[rootId] ?? null : null;
  const children = useMemo(
    () => (node ? node.childrenIds.map((id) => data!.nodes[id]).filter(Boolean) : []),
    [node, data]
  );
  const hasChildren = children.length > 0;
  const [tab, setTab] = useState<"wilayah" | "isu">("wilayah");
  useEffect(() => setTab(hasChildren ? "wilayah" : "isu"), [hasChildren, curId]);

  if (!data || !node || node.mentions === 0) {
    return (
      <SlideFrame title="Dashboard Sentimen Media" subtitle={periodLabel} rightMeta={<Legend />} flush>
        <div className={styles.slide}>
          <div className={styles.emptyBox}>
            <div className={styles.emptyIcon}>{IcChart}</div>
            <div className={styles.emptyTitle}>Belum ada data sentimen</div>
            <div className={styles.emptySub}>Data sentimen untuk periode {periodLabel} belum tersedia.</div>
          </div>
        </div>
      </SlideFrame>
    );
  }

  const comp = node.composition;
  const total = node.mentions || 1;
  const posPct = (comp.positive / total) * 100;

  const pieData = [
    { name: "Positif", value: comp.positive, c: C.pos },
    { name: "Netral", value: comp.neutral, c: C.neu },
    { name: "Negatif", value: comp.negative, c: C.neg }
  ].filter((d) => d.value > 0);

  const trend = node.daily.map((d) => ({ label: dayShort(d.date), total: d.total, negative: d.negative }));
  const peak = [...node.daily].sort((a, b) => b.negative - a.negative)[0] || null;
  const maxTot = Math.max(1, ...node.daily.map((d) => d.total));
  const yMax = Math.max(50, Math.ceil(maxTot / 150) * 150);
  const yTicks = [0, yMax / 3, (yMax / 3) * 2, yMax].map((v) => Math.round(v));

  const sortedChildren = [...children].sort((a, b) => {
    const o: Record<string, number> = { kritis: 0, atensi: 1, aman: 2 };
    return o[a.status] - o[b.status] || b.negpct - a.negpct;
  });
  const issues = node.issues.slice(0, 5);
  const recoByKey = new Map(node.recommendations.map((r) => [r.issue_key, r]));

  // Insight rows (Kesimpulan).
  const insights: { icon: ReactNode; bg: string; fg: string; label: string; body: ReactNode }[] = [];
  if (node.issues[0]) {
    insights.push({ icon: IcChart, bg: "#FBEAEC", fg: "#C4525F", label: "Isu paling disorot", body: <>&ldquo;{node.issues[0].title}&rdquo; — jangkauan <b>{compact(node.issues[0].reach)}</b>.</> });
  }
  if (peak && peak.negative > 0) {
    insights.push({ icon: IcTrend, bg: "#FDF2E3", fg: "#B8891C", label: "Puncak negatif", body: <>Lonjakan tertinggi pada <b>{dayLong(peak.date)}</b> dengan {fmt(peak.negative)} percakapan negatif.</> });
  }
  if (sortedChildren.length) {
    const worst = sortedChildren[0];
    const best = sortedChildren[sortedChildren.length - 1];
    insights.push({ icon: IcPin, bg: "#EDF1FA", fg: C.primary, label: "Prioritas wilayah", body: <>Paling perlu perhatian: <b style={{ color: "#C4525F" }}>{worst.label} ({pct(worst.negpct)})</b>{worst.id !== best.id ? <> · paling terkendali: {best.label} ({pct(best.negpct)}).</> : <>.</>}</> });
  } else if (node.channels[0]) {
    insights.push({ icon: IcPin, bg: "#EDF1FA", fg: C.primary, label: "Kanal dominan", body: <>Kanal percakapan terbanyak: <b>{node.channels[0].name}</b> ({fmt(node.channels[0].count)} percakapan).</> });
  }
  if (node.positives[0]) {
    insights.push({ icon: IcVol, bg: "#E8F5EF", fg: C.pos, label: "Apresiasi publik", body: <>&ldquo;{node.positives[0].title}&rdquo; — {fmt(node.positives[0].positive)} sentimen positif.</> });
  }

  const levelText = node.level === "divisi" ? "Tingkat Divisi" : node.level === "regional" ? "Tingkat Regional" : "Tingkat Cabang";
  const parent = node.parentId ? data.nodes[node.parentId] ?? null : null;
  // Judul panel kanan menyesuaikan jenis anak: Divisi → Regional, Regional → Ruas Tol.
  const childLabel = node.level === "divisi" ? "Regional" : "Ruas Tol";

  return (
    <SlideFrame title="Dashboard Sentimen Media" subtitle={periodLabel} rightMeta={<Legend />} flush stagger={false}>
    <div className={styles.slide}>
      <div key={`${data.period_key}-${node.id}`} className={`${styles.body} pfx-stagger`}>
      {/* Top: banner + scope + KPI strip */}
      <div className={styles.topRow}>
        <div className={`${styles.banner} ${styles[node.status]}`}>
          <span className={styles.bannerIcon} style={{ background: STATUS_COL[node.status] }}>{STATUS_ICON[node.status]}</span>
          <div className={styles.bannerBody}>
            <div className={styles.bannerStatus} style={{ color: STATUS_COL[node.status] }}>{STATUS_WORD[node.status]}</div>
            <div className={styles.bannerLine}>
              <b>{pct(comp.negPct)}</b> percakapan negatif dari <b>{fmt(node.mentions)}</b> total percakapan.
            </div>
          </div>
        </div>
        <div className={styles.scopeCard}>
          <div className={styles.scopeHead}>
            <span className={styles.scopeKicker}>{IcHome}Lingkup</span>
          </div>
          <div className={styles.scopeName} title={node.label}>{node.label}</div>
          <div className={styles.scopeMeta}>
            {levelText}
            {hasChildren ? <> · <span className={styles.scopeHint}>klik wilayah untuk menelusuri</span></> : <> · rincian akhir</>}
          </div>
        </div>
        <div className={styles.kpiStrip}>
          <Kpi label="Percakapan" val={fmt(node.mentions)} desc="Jumlah unggahan & berita yang menyebut perusahaan." />
          <Kpi label="Jangkauan" val={compact(node.reach)} desc="Perkiraan akun yang berpotensi melihat percakapan." divided />
          <Kpi label="Engagement" val={compact(node.engagement)} desc="Total interaksi: suka, komentar, dan bagikan." divided />
        </div>
      </div>

      {/* Mid: komposisi + tren */}
      <div className={styles.midRow}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Komposisi Sentimen</div>
          <div className={styles.donutWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="94%" startAngle={90} endAngle={-270} paddingAngle={1.2} stroke="none">
                  {pieData.map((d) => <Cell key={d.name} fill={d.c} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${fmt(v)} (${pct((v / total) * 100)})`, n]} contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCenter}>
              <div className={styles.donutNeg}>{pct(comp.negPct)}</div>
              <div className={styles.donutCap}>NEGATIF</div>
            </div>
          </div>
          <div className={styles.compLegend}>
            <span><b style={{ color: C.pos }}>{fmt(comp.positive)}</b> positif</span>
            <span><b style={{ color: C.ink }}>{fmt(comp.neutral)}</b> netral</span>
            <span><b style={{ color: C.neg }}>{fmt(comp.negative)}</b> negatif</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Tren Harian Percakapan</div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 12, bottom: 2, left: 2 }}>
                <defs>
                  <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#E8ECF2" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: C.faint }} interval={1} tickLine={false} axisLine={{ stroke: C.line }} minTickGap={6} />
                <YAxis domain={[0, yMax]} ticks={yTicks} tick={{ fontSize: 10, fill: C.faint }} width={30} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v: number, n: string) => [fmt(v), n === "total" ? "Total" : "Negatif"]} labelFormatter={(l) => `Tanggal ${l}`} />
                <Area type="monotone" dataKey="total" name="total" stroke="none" fill="url(#gArea)" isAnimationActive animationDuration={800} />
                <Line type="monotone" dataKey="total" name="total" stroke={C.primary} strokeWidth={2.4} dot={false} isAnimationActive animationDuration={900} />
                <Line type="monotone" dataKey="negative" name="negative" stroke={C.neg} strokeWidth={2.4} dot={false} isAnimationActive animationDuration={1050} />
                {peak && peak.negative > 0 && <Customized component={(props: unknown) => <PeakAnnotation chart={props} peakLabel={dayShort(peak.date)} peakVal={peak.negative} peakDate={peak.date} />} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.trendLegend}>
            <span><span className={styles.sw} style={{ background: C.primary }} />Total percakapan</span>
            <span><span className={styles.sw} style={{ background: C.neg }} />Negatif</span>
          </div>
        </div>
      </div>

      {/* Bottom: kesimpulan + peta wilayah */}
      <div className={styles.botRow}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Kesimpulan — {node.label}</div>
          <div className={styles.hero}>
            <span className={styles.heroIcon}>{IcAlert}</span>
            <div className={styles.heroText}>
              <b>Status {STATUS_WORD[node.status]}.</b> {pct(comp.negPct)} dari {fmt(node.mentions)} percakapan bernada negatif (positif {pct(posPct)}), dengan total jangkauan mencapai {compact(node.reach)}.
            </div>
          </div>
          <div className={styles.insights}>
            {insights.map((it, i) => (
              <div key={i} className={styles.insightRow}>
                <span className={styles.insightIcon} style={{ background: it.bg, color: it.fg }}>{it.icon}</span>
                <div className={styles.insightBody}>
                  <div className={styles.insightLabel}>{it.label}</div>
                  <div className={styles.insightText}>{it.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitleWrap}>
              {parent && (
                <button className={styles.panelBack} onClick={() => setCurId(parent.id)} title={`Kembali ke ${parent.label}`}>
                  <span className={styles.panelBackIc}>{IcArrowLeft}</span>Kembali
                </button>
              )}
              <div className={styles.cardTitle} style={{ margin: 0 }}>{hasChildren && tab === "wilayah" ? childLabel : "Isu Negatif Teratas"}</div>
            </div>
            {hasChildren && (
              <div className={styles.toggle}>
                <button className={tab === "wilayah" ? styles.tgOn : ""} onClick={() => setTab("wilayah")}>{childLabel}</button>
                <button className={tab === "isu" ? styles.tgOn : ""} onClick={() => setTab("isu")}>Top Isu</button>
              </div>
            )}
          </div>

          {tab === "wilayah" && hasChildren ? (
            <div className={styles.regionList}>
              {sortedChildren.map((k, i) => {
                const kt = k.mentions || 1;
                const kc = k.composition;
                const issue = k.issues[0]?.title || (kc.positive > kc.negative ? "Percakapan didominasi topik positif." : "Tidak ada isu negatif menonjol.");
                return (
                  <button key={k.id} className={styles.regionRow} onClick={() => setCurId(k.id)} title={`Telusuri ${k.label}`}>
                    <span className={styles.regionRank}>{i + 1}</span>
                    <div className={styles.regionMain}>
                      <div className={styles.regionTop}>
                        <span className={styles.regionDot} style={{ background: STATUS_COL[k.status] }} />
                        <span className={styles.regionName}>{k.label}</span>
                        <span className={styles.regionBadge} style={{ background: STATUS_COL[k.status] }}>{pct(k.negpct)}</span>
                      </div>
                      <div className={styles.regionIssue}>{issue}</div>
                      <div className={styles.regionBar}>
                        <span style={{ width: `${(kc.positive / kt) * 100}%`, background: C.pos }} />
                        <span style={{ width: `${(kc.neutral / kt) * 100}%`, background: C.neu }} />
                        <span style={{ width: `${(kc.negative / kt) * 100}%`, background: C.neg }} />
                      </div>
                    </div>
                    <div className={styles.regionRight}>
                      <span className={styles.regionTotal}>{fmt(k.mentions)} percakapan</span>
                      <span className={styles.regionDrill}>Telusuri <span className={styles.regionDrillIc}>{IcArrowR}</span></span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.issueList}>
              {issues.length === 0 ? (
                <div className={styles.noIssue}>Tidak ada isu bernada negatif menonjol pada lingkup ini.</div>
              ) : (
                issues.map((it, i) => {
                  const reco = recoByKey.get(it.key);
                  return (
                    <div key={it.key} className={styles.issueRow}>
                      <span className={styles.regionRank}>{i + 1}</span>
                      <div className={styles.issueBody}>
                        <div className={styles.issueTitle}>{it.title}</div>
                        <div className={styles.issueMeta}>Jangkauan {compact(it.reach)} · {fmt(it.negative)} negatif</div>
                        {reco && (reco.action || reco.pic) && (
                          <div className={styles.issueReco}>
                            <span className={styles.recoArrow}>{IcArrowR}</span>
                            <span>{reco.action}{reco.pic ? ` — ${reco.pic}` : ""}</span>
                            <span className={`${styles.recoTag} ${styles[reco.status]}`}>{reco.status === "done" ? "Selesai" : reco.status === "in_progress" ? "Proses" : "Belum"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
    </SlideFrame>
  );
}

function Legend() {
  return (
    <span className={styles.legend}>
      <span><span className={styles.sw} style={{ background: C.pos }} />Positif</span>
      <span><span className={styles.sw} style={{ background: C.neu }} />Netral</span>
      <span><span className={styles.sw} style={{ background: C.neg }} />Negatif</span>
    </span>
  );
}

function Kpi({ label, val, desc, divided }: { label: string; val: string; desc: string; divided?: boolean }) {
  return (
    <div className={`${styles.kpi} ${divided ? styles.kpiDivided : ""}`}>
      <div className={styles.kpiKey}>
        <span className={styles.kpiDot} style={{ background: C.primary }} />{label}
      </div>
      <div className={styles.kpiVal}>{val}</div>
      <div className={styles.kpiDesc}>{desc}</div>
    </div>
  );
}

const tipStyle: CSSProperties = {
  background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.ink,
  boxShadow: "0 6px 22px rgba(40,60,90,.14)"
};

/* Anotasi puncak negatif pada chart tren — posisi dihitung dari skala Recharts. */
function PeakAnnotation({ chart, peakLabel, peakVal, peakDate }: { chart: unknown; peakLabel: string; peakVal: number; peakDate: string }) {
  const ch = chart as {
    xAxisMap?: Record<string, { scale: (v: unknown) => number; bandwidth?: () => number }>;
    yAxisMap?: Record<string, { scale: (v: number) => number }>;
    offset?: { left: number; width: number };
  };
  const xA = ch.xAxisMap && Object.values(ch.xAxisMap)[0];
  const yA = ch.yAxisMap && Object.values(ch.yAxisMap)[0];
  if (!xA || !yA) return null;
  const band = typeof xA.bandwidth === "function" ? xA.bandwidth() : 0;
  const px = xA.scale(peakLabel) + band / 2;
  const py = yA.scale(peakVal);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  // Jaga kotak tetap di dalam area (geser ke kiri bila dekat tepi kanan).
  const bw = 150, bh = 40;
  const plotRight = ch.offset ? ch.offset.left + ch.offset.width : px + bw + 40;
  const flip = px + 14 + bw > plotRight;
  const bx = flip ? px - 14 - bw : px + 14;
  const by = Math.max(2, py - 6);
  return (
    <g>
      <circle cx={px} cy={py} r={9} fill={C.neg} opacity={0.18} />
      <circle cx={px} cy={py} r={5} fill={C.neg} stroke="#fff" strokeWidth={2} />
      <line x1={px} y1={py} x2={flip ? bx + bw - 10 : bx + 10} y2={by + bh / 2} stroke={C.neg} strokeWidth={1} strokeDasharray="2 2" />
      <rect x={bx} y={by} width={bw} height={bh} rx={8} fill={C.neg} />
      <text x={bx + 12} y={by + 16} fontSize={11} fontWeight={800} fill="#fff">Puncak negatif · {dayLong(peakDate).replace(/ \d{4}$/, "")}</text>
      <text x={bx + 12} y={by + 31} fontSize={11} fontWeight={600} fill="#FBE3E6">{fmt(peakVal)} percakapan negatif</text>
    </g>
  );
}
