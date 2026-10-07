import { Fragment, useId } from "react";
import type { RuasBar } from "@/types/pendapatan";
import styles from "./AchievementBarChart.module.css";

type Variant = "page" | "fit";

interface AchievementBarChartProps {
  /** Deret per ruas (sudah terurut & difilter yang berrealisasi). */
  data: RuasBar[];
  /** Untuk aksesibilitas / judul internal SVG. */
  ariaLabel?: string;
  /**
   * "page" (default) — grafik penuh untuk halaman (tinggi natural, %ACH teks).
   * "fit" — varian ringkas untuk slide presentasi: menskala ke ruang tersedia
   * (viewBox pendek), gridline, dan badge %ACH berpil.
   */
  variant?: Variant;
}

// Konfigurasi geometri per varian (identik dengan fungsi drawBars/barsEl di
// pendapatan-reference.html & Presentasi.dc.html).
const CFG = {
  page: {
    H: 340,
    padL: 20,
    padR: 10,
    padT: 44,
    padB: 64,
    barMax: 20,
    barFactor: 0.3,
    gap: 4,
    headroom: 1.12,
    gridlines: 0,
    baseW: 1,
    valFont: 8.5,
    ruasFont: 9,
    ruasDy: 16,
    regionDy: 40,
    sepTop: 6,
    sepBottom: 30,
    pill: false,
    cap: false
  },
  fit: {
    H: 156,
    padL: 24,
    padR: 14,
    padT: 26,
    padB: 30,
    barMax: 26,
    barFactor: 0.34,
    gap: 5,
    headroom: 1.14,
    gridlines: 3,
    baseW: 1.4,
    valFont: 7.5,
    ruasFont: 9,
    ruasDy: 13,
    regionDy: 28,
    sepTop: 4,
    sepBottom: 26,
    pill: true,
    cap: true
  }
} as const;

const W = 1000;

function regionLabel(reg: string | null): string {
  if (!reg) return "";
  return reg === "JKT" ? "JKT" : `REG ${reg}`;
}

// Warna badge %ACH (pil) — token semantik agar mengikuti tema.
function achFill(ach: number): string {
  if (ach >= 100) return "var(--sem-green)";
  if (ach >= 90) return "var(--sem-amber)";
  return "var(--sem-red)";
}
function achInk(ach: number): string {
  return ach >= 90 && ach < 100 ? "#2a2118" : "#fff";
}

const idFmt = new Intl.NumberFormat("id-ID");

/**
 * Grafik batang pencapaian per ruas (RKAP vs Realisasi), dengan pemisah &
 * label per regional, nilai di atas bar, dan %ACH. Port SVG dari
 * pendapatan-reference.html / Presentasi.dc.html ke React — skala linear
 * tunggal sehingga ruas dominan (mis. JORR S) sengaja mendominasi.
 */
export function AchievementBarChart({ data, ariaLabel, variant = "page" }: AchievementBarChartProps) {
  const titleId = useId();
  const c = CFG[variant];
  const plotW = W - c.padL - c.padR;
  const plotH = c.H - c.padT - c.padB;
  const baseY = c.padT + plotH;

  const n = data.length;
  const groupW = n > 0 ? plotW / n : plotW;
  const barW = Math.min(c.barMax, groupW * c.barFactor);
  const gap = c.gap;

  const max = Math.max(1, ...data.map((d) => Math.max(d.rkap, d.real))) * c.headroom;
  const y = (v: number) => c.padT + plotH - (v / max) * plotH;

  const regionBands: { reg: string; startIdx: number; endIdx: number }[] = [];
  data.forEach((d, i) => {
    const reg = d.regional ?? "";
    const last = regionBands[regionBands.length - 1];
    if (last && last.reg === reg) last.endIdx = i;
    else regionBands.push({ reg, startIdx: i, endIdx: i });
  });

  const gridLines: number[] = [];
  for (let g = 1; g <= c.gridlines; g += 1) {
    gridLines.push(c.padT + plotH - (plotH * g) / c.gridlines);
  }

  return (
    <div className={variant === "fit" ? styles.fitWrap : styles.scroll}>
      <svg
        className={variant === "fit" ? styles.svgFit : styles.svg}
        viewBox={`0 0 ${W} ${c.H}`}
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{ariaLabel ?? "Grafik pencapaian per ruas"}</title>

        {gridLines.map((gy, i) => (
          <line key={`g${i}`} x1={c.padL} y1={gy} x2={W - c.padR} y2={gy} className={styles.grid} />
        ))}

        {/* Baseline */}
        <line
          x1={c.padL}
          y1={baseY}
          x2={W - c.padR}
          y2={baseY}
          className={styles.baseline}
          strokeWidth={c.baseW}
        />

        {data.map((d, i) => {
          const cx = c.padL + groupW * i + groupW / 2;
          const xr = cx - barW - gap / 2;
          const xv = cx + gap / 2;
          const yr = y(d.rkap);
          const yv = y(d.real);
          const showSep = i > 0 && d.regional !== data[i - 1].regional;
          const sepX = c.padL + groupW * i;

          // %ACH: pil (fit) atau teks (page).
          let pctEl;
          if (c.pill) {
            const pw = String(`${d.ach}%`).length * 6.6 + 12;
            const py = Math.max(Math.min(yr, yv) - 17, c.padT - 7);
            pctEl = (
              <>
                <rect x={cx - pw / 2} y={py - 12} width={pw} height={16} rx={8} fill={achFill(d.ach)} />
                <text
                  x={cx}
                  y={py}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill={achInk(d.ach)}
                >
                  {d.ach}%
                </text>
              </>
            );
          } else {
            const pctY = Math.max(Math.min(yr, yv) - 16, c.padT - 8);
            pctEl = (
              <text x={cx} y={pctY} textAnchor="middle" className={styles.pct}>
                {d.ach}%
              </text>
            );
          }

          return (
            <Fragment key={`${d.ruas}-${i}`}>
              {showSep && (
                <line
                  x1={sepX}
                  y1={c.padT - c.sepTop}
                  x2={sepX}
                  y2={baseY + c.sepBottom}
                  className={styles.sep}
                />
              )}
              <rect x={xr} y={yr} width={barW} height={baseY - yr} rx={c.cap ? 3 : 2} className={styles.barRkap} />
              <rect x={xv} y={yv} width={barW} height={baseY - yv} rx={c.cap ? 3 : 2} className={styles.barReal} />
              {c.cap && (
                <rect x={xv} y={yv} width={barW} height={Math.min(3, baseY - yv)} rx={2} className={styles.cap} />
              )}
              <text x={xr + barW / 2} y={yr - 4} textAnchor="middle" fontSize={c.valFont} className={styles.valRkap}>
                {idFmt.format(d.rkap)}
              </text>
              <text x={xv + barW / 2} y={yv - 4} textAnchor="middle" fontSize={c.valFont} className={styles.valReal}>
                {idFmt.format(d.real)}
              </text>
              {pctEl}
              <text x={cx} y={baseY + c.ruasDy} textAnchor="middle" fontSize={c.ruasFont} className={styles.ruas}>
                {d.ruas}
              </text>
            </Fragment>
          );
        })}

        {regionBands.map((band, i) => {
          const cx = c.padL + groupW * ((band.startIdx + band.endIdx) / 2) + groupW / 2;
          return (
            <text key={`${band.reg}-${i}`} x={cx} y={baseY + c.regionDy} textAnchor="middle" className={styles.region}>
              {regionLabel(band.reg)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
