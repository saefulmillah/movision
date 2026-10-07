import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import type { BreakdownItem, PeriodData } from "@/types/labaRugi";
import {
  buildColumns,
  cellVal,
  EXPANDABLE_PARENTS,
  fmtNum,
  fmtPct,
  LR_FOOTNOTES,
  LR_VIEW_TITLE,
  ROWS,
  type LrView
} from "@/lib/labaRugiView";
import styles from "./LrTableSlide.module.css";

interface LrTableSlideProps {
  view: LrView;
  data: PeriodData | null;
  periodLabel: string;
}

export function LrTableSlide({ view, data, periodLabel }: LrTableSlideProps) {
  const columns = useMemo(() => (data ? buildColumns(data, view) : []), [data, view]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const bd = view === "konsol" ? data?.breakdown?.konsol : data?.breakdown?.entity;
  const itemsOf = (code: string, id: string): BreakdownItem[] => bd?.[code]?.[id] || [];
  const canExpand = (id: string) =>
    EXPANDABLE_PARENTS.includes(id) && columns.some((c) => itemsOf(c.code, id).length > 0);
  const repItems = (id: string) =>
    columns.map((c) => itemsOf(c.code, id)).reduce((a, b) => (b.length > a.length ? b : a), [] as BreakdownItem[]);
  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const rowTypeClass = (type: string) =>
    type === "section" ? styles.rSection : type === "total" ? styles.rTotal : type === "hpp" ? styles.rHpp : styles.rSub;

  return (
    <div className={styles.slide}>
      <div className={styles.header}>
        <h1 className={styles.title}>{LR_VIEW_TITLE[view]}</h1>
        <span className={styles.sub}>
          Periode <b>{periodLabel}</b>
        </span>
        <span className={styles.spacer} />
        <span className={styles.note}>RKAP vs Realisasi <b>(dalam juta)</b></span>
      </div>

      {!data || columns.length === 0 ? (
        <div className={styles.emptyBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data"
            description={`Data Laba Rugi untuk periode ${periodLabel} belum tersedia.`}
          />
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.corner} rowSpan={2}>
                  Uraian
                </th>
                {columns.map((c, i) => (
                  <th key={`${c.label}-${i}`} className={styles.hEntity} colSpan={2} style={{ background: `var(--lr-${c.tint})` }}>
                    {c.label}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((c, i) => (
                  <Fragment key={`${c.label}-${i}`}>
                    <th className={`${styles.hSub} ${styles.grp}`}>RKAP</th>
                    <th className={styles.hSub}>{c.realLabel}</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const isPct = row.id === "hpp";
                const expandable = canExpand(row.id);
                const isOpen = expandable && !!expanded[row.id];
                // Selalu render item (collapse via CSS) agar slide buka & tutup teranimasi.
                const items = expandable ? repItems(row.id) : [];
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`${rowTypeClass(row.type)} ${expandable ? styles.rowClickable : ""}`}
                      onClick={expandable ? () => toggle(row.id) : undefined}
                      role={expandable ? "button" : undefined}
                      tabIndex={expandable ? 0 : undefined}
                      aria-expanded={expandable ? isOpen : undefined}
                      aria-label={expandable ? `${isOpen ? "Tutup" : "Buka"} rincian ${row.label}` : undefined}
                      onKeyDown={
                        expandable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggle(row.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <td className={styles.uraian}>
                        {expandable ? (
                          <span className={styles.expLabel}>
                            <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ""}`}>▸</span>
                            {row.label}
                          </span>
                        ) : (
                          row.label
                        )}
                      </td>
                      {columns.map((c, i) => {
                        const v = cellVal(c.data, row.id);
                        const a = isPct ? fmtPct(v[0]) : fmtNum(v[0]);
                        const b = isPct ? fmtPct(v[1]) : fmtNum(v[1]);
                        return (
                          <Fragment key={`${row.id}-${i}`}>
                            <td className={`${styles.num} ${styles.grp} ${a.neg ? styles.neg : ""}`}>{a.t}</td>
                            <td className={`${styles.num} ${b.neg ? styles.neg : ""}`}>{b.t}</td>
                          </Fragment>
                        );
                      })}
                    </tr>
                    {items.map((it, idx) => (
                      <tr
                        key={`${row.id}-item-${it.seq}`}
                        className={`${styles.rItem} ${isOpen ? styles.open : ""}`}
                        aria-hidden={!isOpen}
                      >
                        <td className={styles.itemLabel}>
                          <span className={styles.cellInner}>
                            <span>{it.label}</span>
                          </span>
                        </td>
                        {columns.map((c, i) => {
                          const cell = itemsOf(c.code, row.id)[idx];
                          const a = fmtNum(cell?.rkap ?? null);
                          const b = fmtNum(cell?.real ?? null);
                          return (
                            <Fragment key={`${row.id}-item-${it.seq}-${i}`}>
                              <td className={`${styles.num} ${styles.grp} ${a.neg ? styles.neg : ""}`}>
                                <span className={styles.cellInner}>
                                  <span>{a.t}</span>
                                </span>
                              </td>
                              <td className={`${styles.num} ${b.neg ? styles.neg : ""}`}>
                                <span className={styles.cellInner}>
                                  <span>{b.t}</span>
                                </span>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.foot}>{LR_FOOTNOTES[view]}</div>
    </div>
  );
}
