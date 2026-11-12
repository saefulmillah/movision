import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Select, StatusPill, useToast } from "@/components/ui";
import type { PillTone, SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { formatDateTime } from "@/lib/format";
import { fetchWimSites, fetchWimSummary, refreshWim } from "@/lib/wim";
import type { WimDeviceStatus, WimSiteStatus, WimSummary } from "@/types/wim";
import styles from "@/pages/modules.module.css";

const GRID = "1.6fr 1.2fr 0.9fr 0.8fr 1.1fr" as const;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "Semua status" },
  { value: "online", label: "Online" },
  { value: "warning", label: "Warning" },
  { value: "offline", label: "Offline" },
  { value: "unknown", label: "Tidak diketahui" }
];

const STATUS_LABEL: Record<WimDeviceStatus, string> = {
  online: "Online",
  warning: "Warning",
  offline: "Offline",
  unknown: "Tidak diketahui"
};

function statusTone(status: WimDeviceStatus): PillTone {
  switch (status) {
    case "online": return "green";
    case "warning": return "amber";
    case "offline": return "red";
    default: return "gray";
  }
}

const KPI_FIELDS: { key: keyof WimSummary; label: string; tone: string }[] = [
  { key: "total_sites", label: "Total Site", tone: "blue" },
  { key: "online_sites", label: "Online", tone: "green" },
  { key: "warning_sites", label: "Warning", tone: "amber" },
  { key: "offline_sites", label: "Offline", tone: "red" },
  { key: "unknown_sites", label: "Tak Diketahui", tone: "gray" },
  { key: "sites_with_data", label: "Ada Data", tone: "green" },
  { key: "sites_without_data", label: "Tanpa Data", tone: "gray" }
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

  // "all" = semua ruas (branch_id tak dikirim); selainnya = id ruas.
  const [branchFilter, setBranchFilter] = useState<string>(activeBranchId ? String(activeBranchId) : "all");
  const [summary, setSummary] = useState<WimSummary | null>(null);
  const [sites, setSites] = useState<WimSiteStatus[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const branchId = branchFilter === "all" ? null : Number(branchFilter);

  const load = useCallback(async () => {
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
      toast.success("Refresh WIM selesai");
      await load();
    } catch (e) {
      toast.error("Gagal refresh", e instanceof Error ? e.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  const branchOptions: SelectOption[] = [
    { value: "all", label: "Semua ruas" },
    ...branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }))
  ];
  const kpis = useMemo(
    () => KPI_FIELDS.filter((k) => summary && typeof summary[k.key] === "number"),
    [summary]
  );
  const gridStyle = { gridTemplateColumns: GRID } as CSSProperties;

  function lastData(s: WimSiteStatus): string {
    return formatDateTime(s.last_success_at || s.last_data_check_at || s.last_device_check_at) || "—";
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Monitoring WIM</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Kesehatan perangkat Weigh-in-Motion per ruas.</span>
        </div>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={branchFilter} onValueChange={setBranchFilter} options={branchOptions} icon="map-pin" ariaLabel="Ruas" />
        <Select className={styles.filter} value={status} onValueChange={setStatus} options={STATUS_OPTIONS} icon="filter" ariaLabel="Status" />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Input wrapClassName={styles.search} icon="search" placeholder="Cari site…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        {canRefresh && (
          <Button variant="secondary" icon="refresh-cw" onClick={doRefresh} disabled={refreshing}>{refreshing ? "Memuat…" : "Refresh"}</Button>
        )}
      </div>

      {/* KPI */}
      {kpis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--sp-4)", flex: "none" }}>
          {kpis.map((k) => (
            <div key={String(k.key)} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: "14px 16px" }}>
              <div className={styles.muted} style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: toneColor(k.tone), fontVariantNumeric: "tabular-nums" }}>
                {String(summary?.[k.key] ?? "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel site */}
      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                <span>Site</span>
                <span>Ruas</span>
                <span>Status</span>
                <span style={{ textAlign: "right" }}>Perangkat</span>
                <span>Data Terakhir</span>
              </div>
              {loading && sites.length === 0 ? (
                <EmptyState icon="scale" title="Memuat monitoring…" />
              ) : sites.length === 0 ? (
                <EmptyState icon="scale" title="Tidak ada site" description="Belum ada data monitoring WIM. Coba ganti ruas, atau jalankan Refresh bila Anda admin." />
              ) : (
                sites.map((s) => (
                  <div key={s.id} className={styles.trow} style={gridStyle}>
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.cellTitle}>{s.site_name || s.site_code}</span>
                      <span className={styles.cellSub}>{s.site_code}</span>
                    </span>
                    <span className={styles.cellText}>{s.branch_name || "—"}</span>
                    <span><StatusPill label={STATUS_LABEL[s.device_status] ?? s.device_status} tone={statusTone(s.device_status)} dot /></span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.device_online}/{s.device_total}</span>
                    <span className={styles.muted}>{lastData(s)}</span>
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
