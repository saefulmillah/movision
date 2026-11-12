import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Modal, Pagination, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { createCrud, fetchCameras } from "@/lib/masterData";
import type { MasterRow } from "@/types/masterData";
import { GenericFormModal } from "./GenericFormModal";
import type { EntityConfig } from "./types";
import styles from "@/pages/modules.module.css";

const PER_PAGE = 12;

function cellValue(row: MasterRow, key: string): string {
  const val = row[key];
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

export function DataTablePage({ config }: { config: EntityConfig }) {
  const toast = useToast();
  const { branches } = useBranch();
  const access = useModuleAccess(config.moduleCode, { superAdminWrite: config.superAdminWrite });
  const idKey = config.idKey ?? "id";
  const crud = useMemo(() => createCrud(config.endpoint), [config.endpoint]);

  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverPages, setServerPages] = useState(1);
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterRow | null>(null);
  const [busy, setBusy] = useState(false);

  const isCamera = config.shape === "camera";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isCamera) {
        const res = await fetchCameras({
          page,
          limit: PER_PAGE,
          branch_id: branchFilter === "all" ? undefined : branchFilter,
          q: query || undefined
        });
        setRows(res.items as MasterRow[]);
        setServerTotal(res.total);
        setServerPages(res.totalPages);
      } else {
        const params: Record<string, unknown> = {};
        if (config.branchFilter && branchFilter !== "all") params.branch_id = branchFilter;
        const data = await crud.list(params);
        setRows(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      toast.error(`Gagal memuat ${config.title}`, e instanceof Error ? e.message : undefined);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isCamera, page, branchFilter, query, crud, config.branchFilter, config.title, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [branchFilter, query]);

  // Filter & paginasi klien untuk shape "array".
  const filtered = useMemo(() => {
    if (isCamera) return rows;
    let out = rows;
    if (config.branchFilter && branchFilter !== "all") {
      out = out.filter((r) => String(r.branch_id ?? "") === branchFilter);
    }
    if (config.searchable && query) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        config.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)) ||
        String(r[config.titleKey] ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, isCamera, config.branchFilter, config.searchable, config.columns, config.titleKey, branchFilter, query]);

  const total = isCamera ? serverTotal : filtered.length;
  const totalPages = isCamera ? serverPages : Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = isCamera ? filtered : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = isCamera ? Math.min(from + pageRows.length - 1, total) : Math.min(page * PER_PAGE, total);

  const selected = useMemo(
    () => rows.find((r) => r[idKey] === selectedId) ?? null,
    [rows, selectedId, idKey]
  );

  const branchOptions: SelectOption[] = [
    { value: "all", label: "Semua ruas" },
    ...branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }))
  ];

  const gridStyle = { gridTemplateColumns: config.gridCols } as CSSProperties;

  const saveFn = useCallback(
    (body: Record<string, unknown>, id: number | string | null) =>
      id === null ? crud.create(body) : crud.update(id, body),
    [crud]
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await crud.remove(deleteTarget[idKey] as number);
      toast.success(`${config.title} dihapus`);
      if (selectedId === deleteTarget[idKey]) setSelectedId(null);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>{config.title}</strong>
          {config.subtitle && <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>{config.subtitle}</span>}
        </div>
        <span className={styles.headSpacer} />
        {(config.branchFilter || isCamera) && (
          <Select className={styles.filter} value={branchFilter} onValueChange={setBranchFilter} options={branchOptions} icon="filter" ariaLabel="Ruas" />
        )}
        {config.searchable && (
          <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
            <Input wrapClassName={styles.search} icon="search" placeholder={`Cari ${config.title.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
        )}
        {access.canWrite && (
          <Button variant="primary" icon="plus" onClick={() => { setSelectedId(null); setFormMode("create"); }}>
            Tambah
          </Button>
        )}
      </div>

      {config.note && (
        <div className={styles.confirmText} style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>⚠️ {config.note}</div>
      )}

      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                {config.columns.map((c) => (
                  <span key={c.key} style={c.align === "end" ? { textAlign: "right" } : undefined}>{c.label}</span>
                ))}
              </div>
              {loading && rows.length === 0 ? (
                <EmptyState icon={config.icon ?? "database"} title={`Memuat ${config.title}…`} />
              ) : pageRows.length === 0 ? (
                <EmptyState icon={config.icon ?? "database"} title={`Tidak ada ${config.title.toLowerCase()}`} description="Belum ada data yang cocok. Jika Anda tak punya ruas yang ditugaskan, daftar bisa tampil kosong." />
              ) : (
                pageRows.map((row) => (
                  <div
                    key={String(row[idKey])}
                    className={styles.trow}
                    style={gridStyle}
                    data-selected={selectedId === row[idKey] || undefined}
                    onClick={() => setSelectedId(row[idKey] as number)}
                  >
                    {config.columns.map((c) => (
                      <span key={c.key} style={{ minWidth: 0, ...(c.align === "end" ? { textAlign: "right" } : {}) }}>
                        {c.render ? (
                          c.render(row)
                        ) : c.sub ? (
                          <>
                            <span className={styles.cellTitle}>{cellValue(row, c.key)}</span>
                            <span className={styles.cellSub}>{c.sub(row)}</span>
                          </>
                        ) : (
                          <span className={c.mono ? styles.mono : styles.cellText}>{cellValue(row, c.key)}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
          <Pagination page={page} pageCount={totalPages} from={from} to={to} total={total} onPage={setPage} unit={config.title.toLowerCase()} />
        </div>

        {selected && (
          <aside className={styles.detailPanel} key={String(selected[idKey])}>
            <div className={styles.detailHead}>
              <span className={styles.detailTitle}>{cellValue(selected, config.titleKey)}</span>
            </div>
            <div className={styles.detailBody}>
              <div className={styles.section}>
                {config.columns.map((c) => (
                  <div className={styles.kv} key={c.key}>
                    <span className={styles.kvKey}>{c.label}</span>
                    <span className={styles.kvVal}>{c.render ? c.render(selected) : cellValue(selected, c.key)}</span>
                  </div>
                ))}
              </div>
            </div>
            {(access.canWrite || access.canDelete) && (
              <div className={styles.detailFooter}>
                {access.canWrite && <Button variant="secondary" icon="pencil" onClick={() => setFormMode("edit")}>Ubah</Button>}
                {access.canDelete && <Button variant="danger" icon="trash-2" onClick={() => setDeleteTarget(selected)}>Hapus</Button>}
              </div>
            )}
          </aside>
        )}
      </div>

      <GenericFormModal
        config={config}
        open={formMode !== null}
        mode={formMode ?? "create"}
        row={formMode === "edit" ? selected : null}
        onClose={() => setFormMode(null)}
        onSaved={load}
        save={saveFn}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus ${config.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus <b>{deleteTarget ? cellValue(deleteTarget, config.titleKey) : ""}</b>?
        </p>
      </Modal>
    </div>
  );
}
