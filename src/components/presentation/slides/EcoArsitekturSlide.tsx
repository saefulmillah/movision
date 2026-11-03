import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./EcoArsitekturSlide.module.css";

/* ============================================================================
   Slide Ekosistem Movision (scope divisi) — TEMA TERANG. Dua varian tata letak
   SUMBER DATA yang bisa dibandingkan lewat tombol (sementara, untuk memilih):
   - "Kolom": satu kolom rapi, tiap sumber punya garis alir sendiri ke hub.
   - "Panel": 3 kolom berkelompok dalam panel + beberapa stream ke hub.
   Alur → hub MOVISION → MONITORING & EVALUASI. 11 sumber: 9 otomatis (hijau) +
   2 input manual (amber: Input Manual & Data Kecelakaan).
   ============================================================================ */

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcGate = (<svg {...svgProps}><path d="M3 21V7l9-3 9 3v14" /><path d="M3 21h18" /><path d="M9 21v-6h6v6" /><path d="M7 11h.01M17 11h.01" /></svg>);
const IcScale = (<svg {...svgProps}><path d="M12 3v18" /><path d="M5 7h14" /><path d="M7 7l-3 6a3 3 0 0 0 6 0L7 7Z" /><path d="M17 7l-3 6a3 3 0 0 0 6 0l-3-6Z" /><path d="M8 21h8" /></svg>);
const IcChat = (<svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>);
const IcSignal = (<svg {...svgProps}><path d="M3 12h3l2 6 4-14 2 10 2-4h3" /></svg>);
const IcWrench = (<svg {...svgProps}><path d="M14.7 6.3a4 4 0 0 0-5.2 5.2l-6 6a1.5 1.5 0 0 0 2 2l6-6a4 4 0 0 0 5.2-5.2l-2.2 2.2-2-2 2.2-2.2Z" /></svg>);
const IcPin = (<svg {...svgProps}><path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>);
const IcClipboard = (<svg {...svgProps}><path d="M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1Z" /><path d="m9 13 2 2 4-4" /></svg>);
const IcCam = (<svg {...svgProps}><rect x="2.5" y="7" width="13" height="10" rx="2" /><path d="m15.5 10 6-3v10l-6-3" /></svg>);
const IcRadar = (<svg {...svgProps}><path d="M12 12V5" /><circle cx="12" cy="13" r="2" /><path d="M8 9.5a5 5 0 0 1 8 0M5.5 7A8.5 8.5 0 0 1 18.5 7" /></svg>);
const IcPencil = (<svg {...svgProps}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const IcAlert = (<svg {...svgProps}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>);
const IcMonitor = (<svg {...svgProps}><rect x="2.5" y="4" width="19" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>);
const IcPhone = (<svg {...svgProps}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>);
const IcPresent = (<svg {...svgProps}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8M7 11l3-3 2 2 3-4" /></svg>);
const IcSap = (<svg {...svgProps}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>);

interface SourceDef { id: string; icon: ReactNode; name: string; desc: string; mode: "auto" | "manual"; col: number; row: number; }
interface ChannelDef { id: string; icon: ReactNode; name: string; desc: string; tag: string; yc: number; hot?: boolean; }

const GROUPS = ["LALU LINTAS & PENDAPATAN", "OPERASIONAL & ASET", "ANALITIK & MANUAL"];
const SOURCES: SourceDef[] = [
  { id: "gto", icon: IcGate, name: "GTO", desc: "LHR & pendapatan tol", mode: "auto", col: 0, row: 0 },
  { id: "wim", icon: IcScale, name: "WIM", desc: "Berat kendaraan & ODOL", mode: "auto", col: 0, row: 1 },
  { id: "rtms", icon: IcRadar, name: "RTMS", desc: "Volume & kecepatan lalin", mode: "auto", col: 0, row: 2 },
  { id: "cctv", icon: IcCam, name: "CCTV Counting (TIP)", desc: "Hitung lalu lintas kamera", mode: "auto", col: 0, row: 3 },
  { id: "elek", icon: IcSignal, name: "Sarana Elektronik", desc: "Uptime CCTV, VMS, radio", mode: "auto", col: 1, row: 0 },
  { id: "tol", icon: IcWrench, name: "Peralatan Tol", desc: "Kondisi & inventaris alat", mode: "auto", col: 1, row: 1 },
  { id: "gps", icon: IcPin, name: "GPS", desc: "Posisi & gerak armada", mode: "auto", col: 1, row: 2 },
  { id: "insp", icon: IcClipboard, name: "Inspeksi Pemeliharaan", desc: "Temuan pemeliharaan jalan", mode: "auto", col: 1, row: 3 },
  { id: "sent", icon: IcChat, name: "Sentiment Analysis", desc: "Persepsi publik media", mode: "auto", col: 2, row: 0 },
  { id: "man", icon: IcPencil, name: "Input Manual", desc: "Laba rugi, kinerja & risiko", mode: "manual", col: 2, row: 1 },
  { id: "acc", icon: IcAlert, name: "Data Kecelakaan", desc: "Kejadian & korban kecelakaan", mode: "manual", col: 2, row: 2 }
];
const CHANNELS: ChannelDef[] = [
  { id: "dash", icon: IcMonitor, name: "Movision Dashboard", desc: "Monitoring & evaluasi manajemen · Web", tag: "Web", yc: 170 },
  { id: "mob", icon: IcPhone, name: "Movision Mobile Apps", desc: "Akses data real-time di lapangan", tag: "iOS · Android", yc: 385 },
  { id: "pres", icon: IcPresent, name: "Movision - Presentation", desc: "Paparan eksekutif untuk Rapat Direktorat", tag: "Fokus Hari Ini", yc: 600, hot: true }
];

// Geometri bersama.
const CH = { x: 1052, w: 224, h: 116 };
const HUB = { cx: 908, cy: 385, r: 74 };
const FAN = [-30, 0, 30];

// --- Varian PANEL (3 kolom) ---
const PANEL = { x: 26, y: 46, w: 730, h: 562 };
const COLX = [157, 391, 625];
const ROWY = [150, 276, 402, 528];
const PCARD = { w: 214, h: 110 };
const STREAM_Y = [200, 385, 540];

// --- Varian KOLOM (satu kolom) ---
const KCOL_X = 170;
const KCARD = { w: 272, h: 52 };
const KROWY = SOURCES.map((_, i) => 96 + i * 57.6);

function streamPath(sy: number, i: number): string {
  const ex = HUB.cx - HUB.r - 3, ey = HUB.cy + FAN[i], sx = PANEL.x + PANEL.w;
  return `M ${sx} ${sy} C ${sx + 64} ${sy}, ${ex - 64} ${ey}, ${ex} ${ey}`;
}
function kolomPath(cy: number, i: number): string {
  const sx = KCOL_X + KCARD.w / 2;
  const ex = HUB.cx - HUB.r - 3;
  const ey = HUB.cy + (i - (SOURCES.length - 1) / 2) * 11;
  return `M ${sx} ${cy} C ${sx + 150} ${cy}, ${ex - 150} ${ey}, ${ex} ${ey}`;
}
function rightPath(yc: number, i: number): string {
  const sy = HUB.cy + FAN[i], sx = HUB.cx + HUB.r + 4;
  return `M ${sx} ${sy} C ${sx + 42} ${sy}, ${CH.x - 46} ${yc}, ${CH.x} ${yc}`;
}

function SourceCard({ node, x, y, w, h, kolom, idx, fdl }: { node: SourceDef; x: number; y: number; w: number; h: number; kolom?: boolean; idx: number; fdl: number }) {
  const manual = node.mode === "manual";
  const cls = [styles.card, styles.cardSrc, kolom ? styles.cardKolom : "", manual ? styles.cardManual : styles.cardAuto].join(" ");
  return (
    <foreignObject x={x} y={y} width={w} height={h} className={styles.fo} style={{ ["--d" as string]: `${idx * 50}ms`, ["--fdl" as string]: `${fdl}s` } as CSSProperties}>
      <div className={cls}>
        <span className={styles.ic}>{node.icon}</span>
        <div className={styles.names}>
          <span className={styles.name}>{node.name}</span>
          <span className={styles.desc}>{node.desc}</span>
        </div>
      </div>
    </foreignObject>
  );
}

function ChannelCard({ node }: { node: ChannelDef }) {
  return (
    <foreignObject x={CH.x} y={node.yc - CH.h / 2} width={CH.w} height={CH.h} className={styles.fo} style={{ ["--d" as string]: `${node.yc}ms` } as CSSProperties}>
      <div className={`${styles.card} ${styles.cardCh} ${node.hot ? styles.cardHot : ""}`}>
        <span className={styles.ic}>{node.icon}</span>
        <div className={styles.names}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{node.name}</span>
            {node.hot ? <span className={styles.liveDot} aria-hidden /> : null}
          </div>
          <span className={styles.desc}>{node.desc}</span>
          <span className={`${styles.tag} ${node.hot ? styles.tagHot : ""}`}>{node.tag}</span>
        </div>
      </div>
    </foreignObject>
  );
}

type Layout = "kolom" | "panel";
const LS_KEY = "eco.layout";

export function EcoArsitekturSlide() {
  const [layout, setLayout] = useState<Layout>(() => {
    try { return (localStorage.getItem(LS_KEY) as Layout) || "kolom"; } catch { return "kolom"; }
  });
  const choose = (l: Layout) => { setLayout(l); try { localStorage.setItem(LS_KEY, l); } catch { /* abaikan */ } };
  const panel = layout === "panel";

  return (
    <div className={styles.slide}>
      <div className={styles.aurora} aria-hidden>
        <span className={`${styles.blob} ${styles.blob1}`} />
        <span className={`${styles.blob} ${styles.blob2}`} />
        <span className={`${styles.blob} ${styles.blob3}`} />
      </div>

      {/* Tombol banding tata letak (sementara) */}
      <div className={styles.toggle}>
        <span className={styles.toggleLabel}>Tata letak</span>
        <button className={`${styles.toggleBtn} ${!panel ? styles.toggleBtnOn : ""}`} onClick={() => choose("kolom")}>Kolom</button>
        <button className={`${styles.toggleBtn} ${panel ? styles.toggleBtnOn : ""}`} onClick={() => choose("panel")}>Panel</button>
      </div>

      <header className={styles.head}>
        <span className={styles.kicker}>Ekosistem Mozy · Divisi OPT</span>
        <h1 className={styles.title}>Dari Sumber Data ke Monitoring &amp; Evaluasi</h1>
        <div className={styles.legend}>
          <span className={styles.lg}><i className={`${styles.lgDot} ${styles.lgAuto}`} />Otomatis</span>
          <span className={styles.lg}><i className={`${styles.lgDot} ${styles.lgManual}`} />Input manual · rencana otomasi</span>
        </div>
      </header>

      <div className={styles.diagram}>
        <svg className={styles.svg} viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagram ekosistem Movision">
          <defs>
            <radialGradient id="hubCore" cx="50%" cy="36%" r="72%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="55%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#0b225e" />
            </radialGradient>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>

          <text x={panel ? PANEL.x + 24 : KCOL_X - KCARD.w / 2} y={PANEL.y - 14} className={styles.panelLabel}>SUMBER DATA</text>
          <text x={HUB.cx} y={PANEL.y - 14} className={styles.panelLabel} textAnchor="middle">PLATFORM</text>
          <text x={CH.x + CH.w / 2} y={PANEL.y - 14} className={styles.panelLabel} textAnchor="middle">MONITORING &amp; EVALUASI</text>

          {panel ? (
            <>
              <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="24" className={styles.panel} />
              {GROUPS.map((g, i) => (
                <text key={g} x={COLX[i]} y={PANEL.y + 32} className={styles.groupLabel} textAnchor="middle">{g}</text>
              ))}
              {STREAM_Y.map((sy, i) => {
                const d = streamPath(sy, i);
                return (
                  <g key={`s-${i}`}>
                    <path d={d} className={styles.base} />
                    <path d={d} className={`${styles.flow} ${styles.flowData}`} />
                    <circle r="5" className={`${styles.dot} ${styles.pulseData}`}><animateMotion dur="2.5s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} /></circle>
                  </g>
                );
              })}
            </>
          ) : (
            SOURCES.map((s, i) => {
              const d = kolomPath(KROWY[i], i);
              const manual = s.mode === "manual";
              return (
                <g key={`k-${s.id}`}>
                  <path d={d} className={styles.base} />
                  <path d={d} className={manual ? `${styles.flow} ${styles.flowManual}` : `${styles.flow} ${styles.flowAuto}`} />
                  <circle r={manual ? 4 : 4.4} className={manual ? `${styles.dot} ${styles.pulseM}` : `${styles.dot} ${styles.pulseA}`}><animateMotion dur={manual ? "3.2s" : "2.6s"} begin={`${i * 0.22}s`} repeatCount="indefinite" path={d} /></circle>
                </g>
              );
            })
          )}

          {/* Konektor hub → kanal */}
          {CHANNELS.map((c, i) => {
            const d = rightPath(c.yc, i);
            return (
              <g key={`r-${c.id}`}>
                <path d={d} className={styles.base} />
                <path d={d} className={`${styles.flow} ${c.hot ? styles.flowHot : styles.flowData}`} />
                <circle r={c.hot ? 6 : 5} className={`${styles.dot} ${c.hot ? styles.pulseH : styles.pulseData}`}><animateMotion dur="2.3s" begin={`${0.3 + i * 0.5}s`} repeatCount="indefinite" path={d} /></circle>
              </g>
            );
          })}

          {/* HUB Movision */}
          <g className={styles.hub} style={{ transformOrigin: `${HUB.cx}px ${HUB.cy}px` }}>
            <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r + 26} className={styles.hubPulse} />
            <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r + 26} className={`${styles.hubPulse} ${styles.hubPulse2}`} />
            <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r + 10} fill="none" stroke="url(#ringGrad)" strokeWidth="2.5" strokeDasharray="10 8" className={styles.hubRing} style={{ transformOrigin: `${HUB.cx}px ${HUB.cy}px` }} />
            <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r} fill="url(#hubCore)" stroke="#93c5fd" strokeWidth="1.5" />
            <text x={HUB.cx} y={HUB.cy - 12} textAnchor="middle" className={styles.hubBrand}>MOVISION</text>
            <text x={HUB.cx} y={HUB.cy + 10} textAnchor="middle" className={styles.hubSub}>Data &amp; Analytics</text>
            <text x={HUB.cx} y={HUB.cy + 28} textAnchor="middle" className={styles.hubSub}>Engine</text>
          </g>

          {panel
            ? SOURCES.map((s, i) => <SourceCard key={s.id} node={s} idx={i} fdl={s.col * 0.5} x={COLX[s.col] - PCARD.w / 2} y={ROWY[s.row] - PCARD.h / 2} w={PCARD.w} h={PCARD.h} />)
            : SOURCES.map((s, i) => <SourceCard key={s.id} node={s} idx={i} kolom fdl={0} x={KCOL_X - KCARD.w / 2} y={KROWY[i] - KCARD.h / 2} w={KCARD.w} h={KCARD.h} />)}
          {CHANNELS.map((c) => <ChannelCard key={c.id} node={c} />)}
        </svg>
      </div>

      <footer className={styles.foot}>
        <span className={styles.sapNote}><span className={styles.sapIc}>{IcSap}</span>Rencana otomasi input manual: Laba Rugi &amp; Kinerja via <b>SAP</b>, Manajemen Risiko via <b>RMS</b> (Risk Management System) Divisi QHSSE.</span>
      </footer>
    </div>
  );
}
