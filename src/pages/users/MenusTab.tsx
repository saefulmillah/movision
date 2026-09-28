import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Icon, Pagination, StatusPill, useToast } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui";
import { usePaged } from "@/lib/usePaged";
import { deleteMenu } from "@/lib/users";
import type { AdminMenu } from "@/types/users";
import { MenuFormModal } from "./MenuFormModal";
import styles from "./users.module.css";

const COLS = "2fr 1.4fr 0.9fr 1.5fr 0.7fr 0.8fr 70px";

/** Susun kategori → submenu berurutan display_order. */
function ordered(menus: AdminMenu[]): AdminMenu[] {
  const parents = menus.filter((m) => m.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const out: AdminMenu[] = [];
  for (const p of parents) {
    out.push(p);
    menus
      .filter((m) => m.parent_id === p.id)
      .sort((a, b) => a.display_order - b.display_order)
      .forEach((c) => out.push(c));
  }
  // Sertakan submenu yatim (parent tak ada) di akhir.
  for (const m of menus) if (m.parent_id !== null && !parents.some((p) => p.id === m.parent_id) && !out.includes(m)) out.push(m);
  return out;
}

function gateChip(m: AdminMenu) {
  if (m.module_code) return { cls: styles.chipBlue, text: `module: ${m.module_code} · ${m.required_access_level}` };
  if (m.permission_code) return { cls: styles.chipAmber, text: `perm: ${m.permission_code}` };
  return { cls: styles.chipGray, text: "Tanpa batasan" };
}

interface MenusTabProps {
  menus: AdminMenu[];
  loading: boolean;
  onRefresh: () => void;
  openCreate: boolean;
  onCreateHandled: () => void;
}

export function MenusTab({ menus, loading, onRefresh, openCreate, onCreateHandled }: MenusTabProps) {
  const toast = useToast();
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMenu | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => ordered(menus), [menus]);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;
  const paged = usePaged(rows, 11);

  useEffect(() => {
    if (openCreate) {
      setEditing(null);
      setFormMode("create");
      onCreateHandled();
    }
  }, [openCreate, onCreateHandled]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMenu(deleteTarget.id);
      toast.success("Menu dihapus");
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      toast.error("Gagal menghapus menu", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.body} style={{ flexDirection: "column" }}>
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
        <div className={styles.table}>
          <div className={styles.thead} style={gridStyle}>
            <span>Menu</span>
            <span>Route</span>
            <span>Tipe</span>
            <span>Hak Akses</span>
            <span>Urutan</span>
            <span>Status</span>
            <span />
          </div>
          {loading && menus.length === 0 ? (
            <EmptyState icon="list-tree" title="Memuat menu…" />
          ) : rows.length === 0 ? (
            <EmptyState icon="list-tree" title="Belum ada menu" />
          ) : (
            paged.pageItems.map((m) => {
              const isChild = m.parent_id !== null;
              const gate = gateChip(m);
              return (
                <div key={m.id} className={styles.trow} style={gridStyle} onClick={() => { setEditing(m); setFormMode("edit"); }}>
                  <span className={`${styles.userCell} ${isChild ? styles.indent : ""}`}>
                    <Icon name={isChild ? (m.icon || "file") : (m.icon || "folder")} size={16} />
                    <span className={styles.userMeta}>
                      <span className={styles.userName}>{m.menu_name}</span>
                      <span className={styles.userSub}>{m.menu_code}</span>
                    </span>
                  </span>
                  <span className={styles.muted} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>{m.route_path || "—"}</span>
                  <span className={styles.muted}>{isChild ? "Submenu" : "Kategori"}</span>
                  <span><span className={`${styles.chip} ${gate.cls}`}>{gate.text}</span></span>
                  <span className={styles.muted} style={{ fontFamily: "var(--font-mono)" }}>{m.display_order}</span>
                  <span><StatusPill label={Number(m.is_active) === 1 ? "Aktif" : "Nonaktif"} tone={Number(m.is_active) === 1 ? "green" : "gray"} /></span>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" icon="x" iconOnly title="Hapus" onClick={() => setDeleteTarget(m)} />
                  </span>
                </div>
              );
            })
          )}
        </div>
        </div>
        <Pagination page={paged.page} pageCount={paged.pageCount} from={paged.from} to={paged.to} total={paged.total} onPage={paged.setPage} unit="menu" />
      </div>

      <MenuFormModal
        open={formMode !== null}
        mode={formMode ?? "create"}
        menu={formMode === "edit" ? editing : null}
        menus={menus}
        onClose={() => setFormMode(null)}
        onSaved={onRefresh}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Menu"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus menu <b>{deleteTarget?.menu_name}</b> (<span style={{ fontFamily: "var(--font-mono)" }}>{deleteTarget?.menu_code}</span>)?
          <br />
          <span className={styles.warn}>Kategori yang masih memiliki submenu tidak dapat dihapus.</span>
        </p>
      </Modal>
    </div>
  );
}
