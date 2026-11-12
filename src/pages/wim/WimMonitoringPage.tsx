import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Select, StatusPill, toneForStatus, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { formatDateTime } from "@/lib/format";
import { fetchWimSites, fetchWimSummary, refreshWim } from "@/lib/wim";
import type { WimSiteStatus, WimSummary } from "@/types/wim";
import styles from "@/pages/modules.module.css";

const GRID = "1.6fr 1.2fr 0.9fr 1.1fr" as const;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "Semua status" },
  { value: "healthy", label: "Sehat" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "offline", label: "Offline" },
  { value: "no_data", label: "Tanpa Data" }
];

const KPI_FIELDS: { key: keyof WimSummary; label: string; tone: string }[] = [
  { key: "total", label: "Total Site", tone: "blue" },
  { key: "healthy", label: "Sehat", tone: "green" },
  { key: "online", label: "Online", tone: "green" },
  { key: "warning", label: "Warning", tone: "amber" },
  { key: "error", label: "Error", tone: "red" },
  { key: "offline", label: "Offline", tone: "gray" },
  { key: "no_data", label: "Tanpa Data", tone: "gray" }
];

function toneColor(tone: string): string {
  switch (tone) {
    case "green": return "var(--sem-green, #22c55e)";
    case "amber": return "var(--sem-amber, #f59e0b)";
    case "red": return "var(--sem-red, #ef4444)";
    case "blue": return "var(--st-blue, #3b82f6)";
    default: return "var(--text-muted)";
  }
}

export function WimMonitoringPage() {
  const toast = useToast();
  const { branches, activeBranchId } = useBranch();
  const { hasRole } = useAuth();
  const canRefresh = hasRole("super_admin") || hasRole("admin") || hasRole("superuser");

  const [branchId, setBranchId] = useState<number | null>(activeBranchId);
  const [summary, setSummary] = useState<WimSummary | null>(null);
  const [sites, setSites] = useState<WimSiteStatus[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pilih ruas default (aktif global, atau pertama) — monitoring wajib branch_id.
  useEffect(() => {
    if (branchId === null && branches.length > 0) setBranchId(activeBranchId ?? branches[0].id);
  }, [branches, activeBranchId, branchId]);

  const load = useCallback(async () => {
    if (branchId === null) return;
    setLoading(true);
    try {
      const [sum, siteList] = await Promise.all([
        fetchWimSummary(branchId),
        fetchWimSites({
          branch_id: branchId,
          status: status === "all" ? undefined : status,
          search: query || undefined
        })
      ]);
      setSummary(sum ?? null);
      setSites(Array.isArray(siteList) ? siteList : []);
    } catch (e) {
      toast.error("Gagal memuat monitoring WIM", e instanceof Error ? e.message : undefined);
      setSummary(null);
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, status, query, toast]);

  useEffect(() => { void load(); }, [load]);

  async function doRefresh() {
    setRefreshing(true);
    try {
      await refreshWim();
      toast.success("Refresh WIM dimulai");
      await load();
    } catch (e) {
      toast.error("Gagal refresh", e instanceof Error ? e.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  const branchOptions: SelectOption[] = branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }));
  const kpis = useMemo(
    () => KPI_FIELDS.filter((k) => summary && typeof summary[k.key] === "number"),
    [summary]
  );
  const gridStyle = { gridTemplateColumns: GRID } as CSSProperties;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Monitoring WIM</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Kesehatan perangkat Weigh-in-Motion per ruas.</span>
        </div>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={branchId === null ? "" : String(branchId)} onValueChange={(v) => setBranchId(Number(v))} options={branchOptions} icon="map-pin" ariaLabel="Ruas" placeholder="Pilih ruas" />
        <Select className={styles.filter} value={status} onValueChange={setStatus} options={STATUS_OPTIONS} icon="filter" ariaLabel="Status" />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Input wrapClassName={styles.search} icon="search" placeholder="Cari site…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        {canRefresh && (
          <Button variant="secondary" icon="refresh-cw" onClick={doRefresh} disabled={refreshing}>{refreshing ? "Memuat…" : "Refresh"}</Button>
        )}
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--sp-4)", flex: "none" }}>
        {kpis.map((k) => (
          <div key={String(k.key)} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: "14px 16px" }}>
            <div className={styles.muted} style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</div>
            <div style={{ fontSize: "var(--fs-2xl, 28px)", fontWeight: 700, color: toneColor(k.tone), fontVariantNumeric: "tabular-nums" }}>
              {String(summary?.[k.key] ?? "—")}
            </div>
          </div>
        ))}
      </div>

      {/* Tabel site */}
      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                <span>Site</span>
                <span>Ruas</span>
                <span>Status</span>
                <span>Data Terakhir</span>
              </div>
              {loading && sites.length === 0 ? (
                <EmptyState icon="scale" title="Memuat monitoring…" />
              ) : sites.length === 0 ? (
                <EmptyState icon="scale" title="Tidak ada site" description="Belum ada site WIM pada ruas ini." />
              ) : (
                sites.map((s) => (
                  <div key={s.site_code} className={styles.trow} style={gridStyle}>
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.cellTitle}>{s.site_name || s.site_code}</span>
                      <span className={styles.cellSub}>{s.site_code}</span>
                    </span>
                    <span className={styles.cellText}>{s.branch_name || "—"}</span>
                    <span>{s.status ? <StatusPill label={s.status} tone={toneForStatus(s.status)} dot /> : "—"}</span>
                    <span className={styles.muted}>{formatDateTime(s.last_data_at) || "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
