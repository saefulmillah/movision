import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import type { BreakdownItem, EntityData, PeriodData } from "@/types/labaRugi";
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

type Period = "konsol" | "month" | "sd";

interface Col {
  key: string;
  label: string;
  tint: string;
  data: EntityData;
  realLabel: string;
  period: Period;
  code: string; // kunci lookup breakdown (entity code / konsol key)
  entityCode: string; // kelompok entitas
  groupFirst: boolean; // kolom pertama dalam grup entitas (pembatas tegas)
  isMonth: boolean; // kolom "periode ini"
}

interface Group {
  code: string;
  label: string;
  tint: string;
  open: boolean;
  canOpen: boolean;
  span: number; // 2 (collapsed) atau 4 (expanded)
}

export function LrTableSlide({ view, data, periodLabel }: LrTableSlideProps) {
  const isGrouped = view !== "konsol";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // breakdown vertikal per akun
  const [monthOpen, setMonthOpen] = useState<Record<string, boolean>>({}); // periode-ini per entitas

  const monthLabelShort = (data?.period_month_label || "").replace(/\s*20\d\d$/, "");
  const sdLabelShort = monthLabelShort ? `s.d ${monthLabelShort}` : "s.d";

  const { cols, groups } = useMemo(() => {
    if (!data) return { cols: [] as Col[], groups: [] as Group[] };
    const base = buildColumns(data, view);
    if (!isGrouped) {
      const konsolCols: Col[] = base.map((c) => ({
        key: c.code,
        label: c.label,
        tint: c.tint,
        data: c.data,
        realLabel: c.realLabel,
        period: "konsol",
        code: c.code,
        entityCode: c.code,
        groupFirst: true,
        isMonth: false
      }));
      return { cols: konsolCols, groups: [] as Group[] };
    }
    const outCols: Col[] = [];
    const outGroups: Group[] = [];
    for (const e of base) {
      const canOpen = !!data.entities_month?.[e.code];
      const open = canOpen && !!monthOpen[e.code];
      if (open) {
        outCols.push({
          key: `${e.code}-m`, label: monthLabelShort || "Bulan", tint: e.tint,
          data: data.entities_month![e.code], realLabel: "REAL", period: "month",
          code: e.code, entityCode: e.code, groupFirst: true, isMonth: true
        });
        outCols.push({
          key: `${e.code}-sd`, label: sdLabelShort, tint: e.tint,
          data: e.data, realLabel: e.realLabel, period: "sd",
          code: e.code, entityCode: e.code, groupFirst: false, isMonth: false
        });
      } else {
        outCols.push({
          key: `${e.code}-sd`, label: e.label, tint: e.tint,
          data: e.data, realLabel: e.realLabel, period: "sd",
          code: e.code, entityCode: e.code, groupFirst: true, isMonth: false
        });
      }
      outGroups.push({ code: e.code, label: e.label, tint: e.tint, open, canOpen, span: open ? 4 : 2 });
    }
    return { cols: outCols, groups: outGroups };
  }, [data, view, isGrouped, monthOpen, monthLabelShort, sdLabelShort]);

  const itemsOf = (col: Col, id: string): BreakdownItem[] => {
    const map =
      col.period === "konsol"
        ? data?.breakdown?.konsol
        : col.isMonth
          ? data?.breakdown?.entity_month
          : data?.breakdown?.entity;
    return map?.[col.code]?.[id] || [];
  };
  const canExpand = (id: string) => EXPANDABLE_PARENTS.includes(id) && cols.some((c) => itemsOf(c, id).length > 0);
  const repItems = (id: string) =>
    cols.map((c) => itemsOf(c, id)).reduce((a, b) => (b.length > a.length ? b : a), [] as BreakdownItem[]);
  const toggleRow = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const toggleMonth = (code: string) => setMonthOpen((m) => ({ ...m, [code]: !m[code] }));

  const rowTypeClass = (type: string) =>
    type === "section" ? styles.rSection : type === "total" ? styles.rTotal : type === "hpp" ? styles.rHpp : styles.rSub;

  const headerRows = isGrouped ? 3 : 2;
  const grpCls = (c: Col) => (c.groupFirst ? styles.grp : styles.grpSub);

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

      {!data || cols.length === 0 ? (
        <div className={styles.emptyBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data"
            description={`Data Laba Rugi untuk periode ${periodLabel} belum tersedia.`}
          />
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={`${styles.table} ${isGrouped ? styles.grouped : ""}`}>
            <thead>
              <tr>
                <th className={styles.corner} rowSpan={headerRows}>
                  Uraian
                </th>
                {isGrouped
                  ? groups.map((g) => (
                      <th
                        key={g.code}
                        className={`${styles.hEntity} ${g.canOpen ? styles.hEntityClickable : ""}`}
                        colSpan={g.span}
                        style={{ background: `var(--lr-${g.tint})` }}
                        onClick={g.canOpen ? () => toggleMonth(g.code) : undefined}
                        title={g.canOpen ? (g.open ? "Sembunyikan periode ini" : "Tampilkan periode ini") : undefined}
                      >
                        <span className={styles.entityHead}>
                          {g.label}
                          {g.canOpen && <span className={`${styles.chev} ${g.open ? styles.chevOpen : ""}`}>▸</span>}
                        </span>
                      </th>
                    ))
                  : cols.map((c) => (
                      <th key={c.key} className={styles.hEntity} colSpan={2} style={{ background: `var(--lr-${c.tint})` }}>
                        {c.label}
                      </th>
                    ))}
              </tr>

              {isGrouped && (
                <tr>
                  {groups.map((g) =>
                    g.open ? (
                      <Fragment key={g.code}>
                        <th className={`${styles.hPeriod} ${styles.grp} ${styles.monthCell}`} colSpan={2}>
                          {monthLabelShort || "Bulan"}
                        </th>
                        <th className={`${styles.hPeriod} ${styles.grpSub}`} colSpan={2}>
                          {sdLabelShort}
                        </th>
                      </Fragment>
                    ) : (
                      <th key={g.code} className={`${styles.hPeriod} ${styles.grp}`} colSpan={2}>
                        {sdLabelShort}
                      </th>
                    )
                  )}
                </tr>
              )}

              <tr>
                {cols.map((c) => (
                  <Fragment key={c.key}>
                    <th className={`${styles.hSub} ${grpCls(c)} ${c.isMonth ? styles.monthCell : ""}`}>RKAP</th>
                    <th className={`${styles.hSub} ${c.isMonth ? styles.monthCell : ""}`}>{c.realLabel}</th>
                  </Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {ROWS.map((row) => {
                const isPct = row.id === "hpp";
                const expandable = canExpand(row.id);
                const isOpen = expandable && !!expanded[row.id];
                const items = expandable ? repItems(row.id) : [];
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`${rowTypeClass(row.type)} ${expandable ? styles.rowClickable : ""}`}
                      onClick={expandable ? () => toggleRow(row.id) : undefined}
                      role={expandable ? "button" : undefined}
                      tabIndex={expandable ? 0 : undefined}
                      aria-expanded={expandable ? isOpen : undefined}
                      onKeyDown={
                        expandable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleRow(row.id);
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
                      {cols.map((c) => {
                        const v = cellVal(c.data, row.id);
                        const a = isPct ? fmtPct(v[0]) : fmtNum(v[0]);
                        const b = isPct ? fmtPct(v[1]) : fmtNum(v[1]);
                        const mc = c.isMonth ? styles.monthCell : "";
                        return (
                          <Fragment key={`${row.id}-${c.key}`}>
                            <td className={`${styles.num} ${grpCls(c)} ${mc} ${a.neg ? styles.neg : ""}`}>{a.t}</td>
                            <td className={`${styles.num} ${mc} ${b.neg ? styles.neg : ""}`}>{b.t}</td>
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
                        {cols.map((c) => {
                          const cell = itemsOf(c, row.id)[idx];
                          const a = fmtNum(cell?.rkap ?? null);
                          const b = fmtNum(cell?.real ?? null);
                          const mc = c.isMonth ? styles.monthCell : "";
                          return (
                            <Fragment key={`${row.id}-item-${it.seq}-${c.key}`}>
                              <td className={`${styles.num} ${grpCls(c)} ${mc} ${a.neg ? styles.neg : ""}`}>
                                <span className={styles.cellInner}>
                                  <span>{a.t}</span>
                                </span>
                              </td>
                              <td className={`${styles.num} ${mc} ${b.neg ? styles.neg : ""}`}>
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

      <div className={styles.foot}>
        {LR_FOOTNOTES[view]}
        {isGrouped && groups.some((g) => g.canOpen) ? " · Klik header ruas/regional untuk menampilkan periode berjalan." : ""}
      </div>
    </div>
  );
}
