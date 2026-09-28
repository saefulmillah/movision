import { useMemo } from "react";
import type { RiskItem, RiskMatrix, Stage } from "@/types/risk";
import styles from "./RiskHeatmap.module.css";

/* ------------------------------------------------------------------ *
 * Heat map risiko 5×5 — porting logika dari risk-reference.html.
 * Sumbu Dampak (kolom 1→5, kiri→kanan) × Kemungkinan (baris 5 atas→1 bawah).
 * Posisi bubble: cell.no → {impact,likelihood} dari matriks → koordinat grid.
 * ------------------------------------------------------------------ */

const M = 48; // margin kiri/atas
const CELLW = 92;
const CELLH = 92;
const R = 11; // radius bubble
const GAP = 3;

const STAGE_ORDER: Record<Stage, number> = { inherent: 0, expected: 1, residual: 2 };
const STAGE_FILL: Record<Stage, string> = { inherent: "#111", expected: "#8a8a8a", residual: "#fff" };

function cellXY(impact: number, likelihood: number) {
  return { x: M + (impact - 1) * CELLW, y: M + (5 - likelihood) * CELLH };
}

interface Marker {
  rank: number;
  stage: Stage;
}

interface RiskHeatmapProps {
  matrix: RiskMatrix;
  risks: RiskItem[];
  /** Klik bubble → buka/sunting risiko (opsional). */
  onSelectRank?: (rank: number) => void;
}

export function RiskHeatmap({ matrix, risks, onSelectRank }: RiskHeatmapProps) {
  // no → {impact, likelihood, level}
  const cellByNo = useMemo(() => {
    const map = new Map<number, { impact: number; likelihood: number; level: string }>();
    for (const c of matrix.cells) map.set(c.no, { impact: c.impact, likelihood: c.likelihood, level: c.level });
    return map;
  }, [matrix]);

  // Kelompokkan marker per nomor sel.
  const byCell = useMemo(() => {
    const map = new Map<number, Marker[]>();
    const push = (no: number | undefined, rank: number, stage: Stage) => {
      if (no == null) return;
      if (!map.has(no)) map.set(no, []);
      map.get(no)!.push({ rank, stage });
    };
    for (const r of risks) {
      push(r.inherent?.cell, r.rank, "inherent");
      push(r.expected?.cell, r.rank, "expected");
      push(r.residual?.cell, r.rank, "residual");
    }
    for (const list of map.values()) {
      list.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.rank - b.rank);
    }
    return map;
  }, [risks]);

  const gridBottom = M + 5 * CELLH;

  return (
    <svg className={styles.svg} viewBox="0 0 560 560" role="img" aria-label="Heat map risiko 5x5">
      {/* Sel matriks */}
      {matrix.cells.map((c) => {
        const { x, y } = cellXY(c.impact, c.likelihood);
        const color = matrix.levels[c.level]?.color || "#ccc";
        return (
          <g key={c.no}>
            <rect x={x} y={y} width={CELLW - 2} height={CELLH - 2} rx={5} fill={color} />
            <text x={x + 7} y={y + CELLH - 10} className={styles.cellNo}>
              {c.no}
            </text>
          </g>
        );
      })}

      {/* Angka sumbu Dampak (bawah) */}
      {[1, 2, 3, 4, 5].map((i) => {
        const { x } = cellXY(i, 1);
        return (
          <text key={`ix-${i}`} x={x + CELLW / 2 - 1} y={gridBottom + 18} className={styles.axisNum} textAnchor="middle">
            {i}
          </text>
        );
      })}
      {/* Angka sumbu Kemungkinan (kiri) */}
      {[1, 2, 3, 4, 5].map((l) => {
        const { y } = cellXY(1, l);
        return (
          <text key={`ly-${l}`} x={M - 10} y={y + CELLH / 2 + 4} className={styles.axisNum} textAnchor="end">
            {l}
          </text>
        );
      })}

      {/* Judul sumbu */}
      <text x={M + 2.5 * CELLW} y={gridBottom + 40} className={styles.axisTitle} textAnchor="middle">
        Tingkat Dampak →
      </text>
      <text
        x={14}
        y={M + 2.5 * CELLH}
        className={styles.axisTitle}
        textAnchor="middle"
        transform={`rotate(-90 14 ${M + 2.5 * CELLH})`}
      >
        Tingkat Kemungkinan →
      </text>

      {/* Bubble per (risiko, stage) */}
      {Array.from(byCell.entries()).map(([no, markers]) => {
        const pos = cellByNo.get(no);
        if (!pos) return null;
        const { x, y } = cellXY(pos.impact, pos.likelihood);
        const perRow = Math.max(1, Math.min(markers.length, Math.floor((CELLW - 10) / (2 * R + GAP)) || 1));
        const rows = Math.ceil(markers.length / perRow);
        return markers.map((m, idx) => {
          const row = Math.floor(idx / perRow);
          const col = idx % perRow;
          const cntRow = Math.min(perRow, markers.length - row * perRow);
          const totalW = cntRow * (2 * R) + (cntRow - 1) * GAP;
          const cx = x + CELLW / 2 - totalW / 2 + R + col * (2 * R + GAP);
          const cy = y + CELLH / 2 - ((rows - 1) * (R + 2)) / 2 + row * (2 * R + 2);
          const isRes = m.stage === "residual";
          return (
            <g
              key={`${no}-${m.stage}-${m.rank}`}
              className={onSelectRank ? styles.bubbleHit : undefined}
              onClick={onSelectRank ? () => onSelectRank(m.rank) : undefined}
            >
              <circle
                cx={cx}
                cy={cy}
                r={R}
                fill={STAGE_FILL[m.stage]}
                stroke={isRes ? "#111" : "none"}
                strokeWidth={isRes ? 1.5 : 0}
              />
              <text x={cx} y={cy + 3.5} textAnchor="middle" className={styles.bubbleLabel} fill={isRes ? "#111" : "#fff"}>
                {m.rank}
              </text>
            </g>
          );
        });
      })}
    </svg>
  );
}
