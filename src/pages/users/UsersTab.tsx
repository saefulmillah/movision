import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Pagination, StatusPill, useToast } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui";
import { usePaged } from "@/lib/usePaged";
import { deleteUser } from "@/lib/users";
import { roleLabel } from "@/constants/rbac";
import type { Branch } from "@/types/monitoring";
import type { UserRecord } from "@/types/users";
import { UserFormModal } from "./UserFormModal";
import styles from "./users.module.css";

const COLS = "1.6fr 1.5fr 1fr 0.8fr 0.9fr";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

interface UsersTabProps {
  users: UserRecord[];
  branches: Branch[];
  loading: boolean;
  onRefresh: () => void;
  openCreate: boolean;
  onCreateHandled: () => void;
  /** Peta role_code → role_name dari katalog dinamis (/api/admin/roles). */
  roleLabels?: Record<string, string>;
}

export function UsersTab({ users, branches, loading, onRefresh, openCreate, onCreateHandled, roleLabels }: UsersTabProps) {
  // Nama role dari katalog dinamis; fallback ke katalog lama lalu ke kode mentah.
  const resolveRole = (code: string) => roleLabels?.[code] ?? roleLabel(code);
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId]);

  // Buka form tambah dari tombol di header (via prop).
  useEffect(() => {
    if (openCreate) {
      setFormMode("create");
      onCreateHandled();
    }
  }, [openCreate, onCreateHandled]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success("Pengguna dihapus");
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error("Gagal menghapus", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;
  const paged = usePaged(users, 9);

  return (
    <div className={styles.body}>
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
        <div className={styles.table}>
          <div className={styles.thead} style={gridStyle}>
            <span>Pengguna</span>
            <span>Role Efektif</span>
            <span>Ruas</span>
            <span>Sumber</span>
            <span>Status</span>
          </div>
          {loading && users.length === 0 ? (
            <EmptyState icon="users" title="Memuat pengguna…" />
          ) : users.length === 0 ? (
            <EmptyState icon="users" title="Tidak ada pengguna" description="Belum ada pengguna yang cocok." />
          ) : (
            paged.pageItems.map((u) => (
              <div
                key={u.id}
                className={styles.trow}
                style={gridStyle}
                data-selected={selectedId === u.id || undefined}
                onClick={() => setSelectedId(u.id)}
              >
                <span className={styles.userCell}>
                  <span className={styles.avatar}>{initials(u.full_name || u.username)}</span>
                  <span className={styles.userMeta}>
                    <span className={styles.userName}>{u.full_name || u.display_name || u.username}</span>
                    <span className={styles.userSub}>{u.username}</span>
                  </span>
                </span>
                <span className={styles.chips}>
                  {u.roles.length ? (
                    u.roles.map((r) => (
                      <span key={r} className={styles.chip}>
                        {resolveRole(r)}
                      </span>
                    ))
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </span>
                <span className={styles.muted}>
                  {u.branch_scopes.length ? `${u.branch_scopes.length} ruas` : "Semua / —"}
                </span>
                <span>
                  <span className={`${styles.chip} ${u.capability_source === "legacy" ? styles.chipAmber : styles.chipMono}`}>
                    {u.capability_source === "legacy" ? "Legacy" : "RBAC"}
                  </span>
                </span>
                <span>
                  <StatusPill label={Number(u.is_active) === 1 ? "Aktif" : "Nonaktif"} tone={Number(u.is_active) === 1 ? "green" : "gray"} />
                </span>
              </div>
            ))
          )}
        </div>
        </div>
        <Pagination page={paged.page} pageCount={paged.pageCount} from={paged.from} to={paged.to} total={paged.total} onPage={paged.setPage} unit="pengguna" />
      </div>

      {selected && (
        <aside className={styles.detailPanel} key={selected.id}>
          <div className={styles.detailHead}>
            <span className={styles.avatar}>{initials(selected.full_name || selected.username)}</span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{selected.full_name || selected.username}</span>
              <span className={styles.userSub}>{selected.username}</span>
            </span>
          </div>
          <div className={styles.detailBody}>
            <div className={styles.chips}>
              <StatusPill label={Number(selected.is_active) === 1 ? "Aktif" : "Nonaktif"} tone={Number(selected.is_active) === 1 ? "green" : "gray"} />
              <span className={`${styles.chip} ${styles.chipMono}`}>{selected.capability_source ?? "rbac"}</span>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Identitas</span>
              <div className={styles.kv}><span className={styles.kvKey}>Username</span><span className={styles.kvVal}>{selected.username}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>Nama</span><span className={styles.kvVal}>{selected.full_name || "—"}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>Email</span><span className={styles.kvVal}>{selected.email || "—"}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>Legacy role</span><span className={styles.kvVal}>{selected.legacy_role || "—"}</span></div>
              <div className={styles.kv}><span className={styles.kvKey}>Subject ID</span><span className={styles.kvVal}>{selected.external_subject_id || "—"}</span></div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Role Efektif</span>
              <div className={styles.chips}>
                {selected.roles.length ? selected.roles.map((r) => <span key={r} className={styles.chip}>{resolveRole(r)}</span>) : <span className={styles.muted}>—</span>}
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Permission Efektif</span>
              <div className={styles.chips}>
                {selected.roles.includes("super_admin") ? (
                  <span className={`${styles.chip} ${styles.chipMono}`}>Seluruh permission (*)</span>
                ) : selected.permissions.length ? (
                  selected.permissions.map((p) => <span key={p} className={`${styles.chip} ${styles.chipMono}`}>{p}</span>)
                ) : (
                  <span className={styles.muted}>—</span>
                )}
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Branch Scope</span>
              <div className={styles.chips}>
                {selected.branch_scopes.length ? (
                  selected.branch_scopes.map((b) => <span key={b.id} className={`${styles.chip} ${styles.chipGreen}`}>{b.branch_code || b.branch_name}</span>)
                ) : (
                  <span className={styles.muted}>Seluruh ruas / tidak dibatasi</span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.detailFooter}>
            <Button variant="secondary" icon="user" onClick={() => setFormMode("edit")}>
              Ubah
            </Button>
            <Button variant="danger" icon="x" onClick={() => setDeleteTarget(selected)}>
              Hapus
            </Button>
          </div>
        </aside>
      )}

      <UserFormModal
        open={formMode !== null}
        mode={formMode ?? "create"}
        user={formMode === "edit" ? selected : null}
        branches={branches}
        onClose={() => setFormMode(null)}
        onSaved={onRefresh}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Pengguna"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Menghapus…" : "Hapus"}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus <b>{deleteTarget?.username}</b> ({deleteTarget?.full_name})?
          <br />
          <span className={styles.warn}>Role dan branch assignment pengguna ini ikut terhapus permanen.</span>
        </p>
      </Modal>
    </div>
  );
}
