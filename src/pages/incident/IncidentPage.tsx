import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Modal, Pagination, Select, StatusPill, Tabs, useToast } from "@/components/ui";
import type { SelectOption, TabItem } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { formatDateTime } from "@/lib/format";
import {
  deleteIncident,
  fetchIncidents,
  fetchIncidentTypes,
  setIncidentStatus
} from "@/lib/incident";
import type { IncidentItem, IncidentType } from "@/types/modules";
import { IncidentFormModal, INCIDENT_STATUS, incidentStatusLabel } from "./IncidentFormModal";
import { IncidentTypesTab } from "./IncidentTypesTab";
import styles from "../modules.module.css";

const COLS = "1.4fr 2fr 0.9fr 1fr";
const PER_PAGE = 12;

const TABS: TabItem[] = [
  { value: "kejadian", label: "Kejadian", icon: "triangle-alert" },
  { value: "jenis", label: "Jenis Incident", icon: "list-tree" }
];

function statusTone(status: number | null): "green" | "amber" | "gray" {
  if (status === 2) return "green";
  if (status === 1) return "amber";
  return "gray";
}

export function IncidentPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { branches } = useBranch();
  const canManage = hasPermission("incident.manage");

  const [tab, setTab] = useState<"kejadian" | "jenis">("kejadian");
  const [createFor, setCreateFor] = useState<null | "kejadian" | "jenis">(null);

  const [types, setTypes] = useState<IncidentType[]>([]);
  const [items, setItems] = useState<IncidentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncidentItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchIncidentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIncidents({
        page,
        per_page: PER_PAGE,
        status: statusFilter === "all" ? undefined : statusFilter,
        incident_type: typeFilter === "all" ? undefined : typeFilter,
        branch_id: branchFilter === "all" ? undefined : branchFilter,
        search: query || undefined
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      toast.error("Gagal memuat incident", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, branchFilter, query, toast]);

  useEffect(() => {
    if (tab === "kejadian") load();
  }, [load, tab]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, branchFilter, query]);

  const selected = useMemo(() => items.find((n) => n.id === selectedId) ?? null, [items, selectedId]);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;

  const typeOptions: SelectOption[] = [
    { value: "all", label: "Semua jenis" },
    ...types.map((t) => ({ value: String(t.id), label: t.incident_name || `#${t.id}` }))
  ];
  const branchOptions: SelectOption[] = [
    { value: "all", label: "Semua ruas" },
    ...branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }))
  ];
  const statusOptions: SelectOption[] = [{ value: "all", label: "Semua status" }, ...INCIDENT_STATUS];

  async function changeStatus(item: IncidentItem, status: number) {
    setBusy(true);
    try {
      await setIncidentStatus(item.id, status);
      toast.success("Status incident diperbarui");
      await load();
    } catch (e) {
      toast.error("Gagal mengubah status", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteIncident(deleteTarget.id);
      toast.success("Incident dihapus");
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "kejadian" | "jenis")} items={TABS} />
        <span className={styles.headSpacer} />
        {tab === "kejadian" && (
          <>
            <Select className={styles.filter} value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} icon="filter" ariaLabel="Status" />
            <Select className={styles.filter} value={typeFilter} onValueChange={setTypeFilter} options={typeOptions} ariaLabel="Jenis" />
            <Select className={styles.filter} value={branchFilter} onValueChange={setBranchFilter} options={branchOptions} ariaLabel="Ruas" />
            <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
              <Input wrapClassName={styles.search} icon="search" placeholder="Cari detail…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </form>
          </>
        )}
        {canManage && (
          <Button variant="primary" icon="plus" onClick={() => (tab === "kejadian" ? setFormMode("create") : setCreateFor("jenis"))}>
            {tab === "kejadian" ? "Tambah Incident" : "Tambah Jenis"}
          </Button>
        )}
      </div>

      {tab === "jenis" ? (
        <IncidentTypesTab canManage={canManage} openCreate={createFor === "jenis"} onCreateHandled={() => setCreateFor(null)} />
      ) : (
        <div className={styles.body}>
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <div className={styles.table}>
                <div className={styles.thead} style={gridStyle}>
                  <span>Jenis / Ruas</span>
                  <span>Detail</span>
                  <span>Status</span>
                  <span>Waktu</span>
                </div>
                {loading && items.length === 0 ? (
                  <EmptyState icon="triangle-alert" title="Memuat incident…" />
                ) : items.length === 0 ? (
                  <EmptyState icon="triangle-alert" title="Tidak ada incident" description="Belum ada incident yang cocok." />
                ) : (
                  items.map((it) => (
                    <div key={it.id} className={styles.trow} style={gridStyle} data-selected={selectedId === it.id || undefined} onClick={() => setSelectedId(it.id)}>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.cellTitle}>{it.incident_type?.incident_name || "—"}</span>
                        <span className={styles.cellSub}>{it.branch?.branch_name || it.branch?.branch_code || "—"}</span>
                      </span>
                      <span className={styles.cellText}>{it.incident_detail || "—"}</span>
                      <span><StatusPill label={incidentStatusLabel(it.status)} tone={statusTone(it.status)} /></span>
                      <span className={styles.muted}>{formatDateTime(it.created_at) || "—"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <Pagination page={page} pageCount={totalPages} from={from} to={to} total={total} onPage={setPage} unit="incident" />
          </div>

          {selected && (
            <aside className={styles.detailPanel} key={selected.id}>
              <div className={styles.detailHead}>
                <span className={styles.detailTitle}>{selected.incident_type?.incident_name || "Incident"}</span>
              </div>
              <div className={styles.detailBody}>
                <div className={styles.chips}>
                  <StatusPill label={incidentStatusLabel(selected.status)} tone={statusTone(selected.status)} />
                  {selected.incident_type?.incident_code && <span className={`${styles.chip} ${styles.chipMono}`}>{selected.incident_type.incident_code}</span>}
                </div>
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Detail</span>
                  <p className={styles.bodyText}>{selected.incident_detail || "—"}</p>
                </div>
                {selected.incident_command && (
                  <div className={styles.section}>
                    <span className={styles.sectionLabel}>Perintah / Himbauan</span>
                    <p className={styles.bodyText}>{selected.incident_command}</p>
                  </div>
                )}
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Lokasi</span>
                  <div className={styles.kv}><span className={styles.kvKey}>Ruas</span><span className={styles.kvVal}>{selected.branch?.branch_name || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>KM</span><span className={styles.kvVal}>{selected.km || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>Lajur / Jalur</span><span className={styles.kvVal}>{[selected.lane, selected.jalur].filter(Boolean).join(" / ") || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>Koordinat</span><span className={styles.kvVal}>{selected.latitude && selected.longitude ? `${selected.latitude}, ${selected.longitude}` : "—"}</span></div>
                </div>
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Audit</span>
                  <div className={styles.kv}><span className={styles.kvKey}>Dibuat</span><span className={styles.kvVal}>{formatDateTime(selected.created_at) || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>Oleh</span><span className={styles.kvVal}>{selected.created_by || "—"}</span></div>
                  <div className={styles.kv}><span className={styles.kvKey}>Diperbarui</span><span className={styles.kvVal}>{formatDateTime(selected.updated_at) || "—"}</span></div>
                </div>
                {canManage && (
                  <div className={styles.section}>
                    <span className={styles.sectionLabel}>Ubah Status</span>
                    <Select
                      value={selected.status !== null ? String(selected.status) : ""}
                      onValueChange={(val) => changeStatus(selected, Number(val))}
                      options={INCIDENT_STATUS}
                      ariaLabel="Ubah status"
                    />
                  </div>
                )}
              </div>
              {canManage && (
                <div className={styles.detailFooter}>
                  <Button variant="secondary" icon="pencil" onClick={() => setFormMode("edit")}>Ubah</Button>
                  <Button variant="danger" icon="trash-2" onClick={() => setDeleteTarget(selected)}>Hapus</Button>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      <IncidentFormModal
        open={formMode !== null}
        mode={formMode ?? "create"}
        incident={formMode === "edit" ? selected : null}
        types={types}
        onClose={() => setFormMode(null)}
        onSaved={load}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Incident"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>Hapus incident ini? <span className={styles.warn}>(soft delete)</span></p>
      </Modal>
    </div>
  );
}
