import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button, EmptyState, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { getBranches } from "@/lib/insights";
import type { Branch } from "@/types/insights";
import styles from "./insights.module.css";

// ============================================================================
// Util & komponen bersama halaman Operasional (modul Insights).
// ============================================================================

export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "–" : Number(n).toLocaleString("id-ID");
export const fmtPct = (n: number | null | undefined, d = 1): string =>
  n == null ? "–" : `${Number(n).toFixed(d).replace(".", ",")}%`;
export const fmtRate = (n: number | null | undefined): string =>
  n == null ? "–" : Number(n).toFixed(4).replace(".", ",");
export function compact(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")} M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(".", ",")} rb`;
  return fmtInt(v);
}

// ---- Periode (preset) ----
export interface PeriodValue {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
  granularity: string;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthsAgoStart(n: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  return iso(d);
}
export function periodPresets(): PeriodValue[] {
  const today = iso(new Date());
  const yearStart = `${new Date().getFullYear()}-01-01`;
  return [
    { key: "3m", label: "3 bulan terakhir", start_date: monthsAgoStart(3), end_date: today, granularity: "month" },
    { key: "6m", label: "6 bulan terakhir", start_date: monthsAgoStart(6), end_date: today, granularity: "month" },
    { key: "12m", label: "12 bulan terakhir", start_date: monthsAgoStart(12), end_date: today, granularity: "month" },
    { key: "ytd", label: "Tahun berjalan", start_date: yearStart, end_date: today, granularity: "month" }
  ];
}
export function usePeriod(defaultKey = "12m") {
  const presets = useMemo(() => periodPresets(), []);
  const [key, setKey] = useState(defaultKey);
  const value = presets.find((p) => p.key === key) || presets[2];
  return { presets, key, setKey, value };
}

// ---- Daftar ruas (branch) untuk filter ----
export function useBranchOptions() {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => {
    void getBranches()
      .then((res) => setBranches(res.data || []))
      .catch(() => setBranches([]));
  }, []);
  const options: SelectOption[] = useMemo(
    () => [{ value: "", label: "Semua ruas" }, ...branches.map((b) => ({ value: b.branch_code, label: b.name || b.branch_code }))],
    [branches]
  );
  return { branches, options };
}

// ---- Komponen UI ----
export function FilterBar(props: {
  period?: { presets: PeriodValue[]; key: string; setKey: (k: string) => void };
  branch?: { value: string; onChange: (v: string) => void; options: SelectOption[] };
  dataAsOf?: string | null;
  stale?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const { period, branch, dataAsOf, stale, loading, onRefresh } = props;
  return (
    <div className={styles.filterBar}>
      {period && (
        <Select
          value={period.key}
          onValueChange={period.setKey}
          options={period.presets.map((p) => ({ value: p.key, label: p.label }))}
          icon="calendar"
          ariaLabel="Periode"
        />
      )}
      {branch && (
        <Select value={branch.value} onValueChange={branch.onChange} options={branch.options} icon="map-pin" ariaLabel="Ruas" />
      )}
      <div className={styles.spacer} />
      {dataAsOf && (
        <span className={`${styles.asOf} ${stale ? styles.asOfStale : ""}`}>
          {stale ? "Data lama · " : "Data per "}
          {formatAsOf(dataAsOf)}
        </span>
      )}
      {onRefresh && (
        <Button size="sm" iconOnly icon={loading ? "loader" : "refresh-cw"} title="Muat ulang" disabled={loading} onClick={onRefresh} />
      )}
    </div>
  );
}

function formatAsOf(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}`;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warning" | "critical" | "accent" }) {
  return (
    <div className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ""}`}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {sub != null && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

export function Panel({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.panel} ${className || ""}`}>
      {(title || right) && (
        <div className={styles.panelHead}>
          {title && <div className={styles.panelTitle}>{title}</div>}
          <span className={styles.spacer} />
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StateBox({ loading, error, empty, emptyText }: { loading?: boolean; error?: string | null; empty?: boolean; emptyText?: string }) {
  if (loading) return <div className={styles.stateBox}><EmptyState icon="loader" title="Memuat data…" /></div>;
  if (error) return <div className={styles.stateBox}><EmptyState icon="triangle-alert" title="Gagal memuat" description={error} /></div>;
  if (empty) return <div className={styles.stateBox}><EmptyState icon="inbox" title="Belum ada data" description={emptyText || "Data tidak tersedia untuk filter ini."} /></div>;
  return null;
}

// Perubahan vs periode sebelumnya (comparison) → teks berwarna.
export function ChangeBadge({ comparison }: { comparison: { change_percent: number | null; direction: "up" | "down" | null; is_higher_worse: boolean } | null | undefined }) {
  if (!comparison || comparison.change_percent == null || !comparison.direction) return <span className={styles.chgFlat}>—</span>;
  const up = comparison.direction === "up";
  const bad = up === comparison.is_higher_worse;
  return (
    <span className={bad ? styles.chgBad : styles.chgGood}>
      {up ? "▲" : "▼"} {fmtPct(Math.abs(comparison.change_percent))} vs thn lalu
    </span>
  );
}

export const C = {
  blue: "#3c63b4", green: "#1f9d6b", amber: "#c08a1e", red: "#d1495b", neu: "#8496b0",
  ink: "#2e3d4f", muted: "#76859a", line: "#e4e9ef", faint: "#9aa8b9"
};
export const STATUS_COLOR: Record<string, string> = { good: C.green, warning: C.amber, critical: C.red };
export const tooltipStyle: CSSProperties = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.ink };
