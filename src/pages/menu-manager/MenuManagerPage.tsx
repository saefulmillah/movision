import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Button, Icon, StatusPill, useToast } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import { fetchAdminMenus, deleteMenu, reorderMenus } from "@/lib/users";
import type { MenuReorderItem } from "@/lib/users";
import type { AdminMenu } from "@/types/users";
import { MenuFormModal } from "@/pages/users/MenuFormModal";
import mstyles from "@/pages/modules.module.css";
import styles from "./menu-manager.module.css";

/** Aplikasi yang menu-nya dikelola di halaman ini. */
const APP = "tollsentra";

type Category = AdminMenu & { children: AdminMenu[] };

/** Posisi sisip relatif terhadap sebuah baris. */
type Edge = "before" | "after";

/** Yang sedang diseret. */
type Drag =
  | { kind: "cat"; id: number }
  | { kind: "child"; id: number; parentId: number };

/** Indikator garis sisip saat hover. */
type Over =
  | { kind: "cat"; id: number; edge: Edge }
  | { kind: "child"; id: number; edge: Edge }
  | { kind: "body"; parentId: number };

const fetchMenus = () => fetchAdminMenus(APP);

/** Bangun pohon kategori → submenu, terurut display_order lalu id. */
function buildTree(menus: AdminMenu[]): Category[] {
  const byOrder = (a: AdminMenu, b: AdminMenu) => a.display_order - b.display_order || a.id - b.id;
  const parents = menus.filter((m) => m.parent_id === null).sort(byOrder);
  return parents.map((p) => ({
    ...p,
    children: menus.filter((m) => m.parent_id === p.id).sort(byOrder)
  }));
}

/** Submenu yatim (induk tak ada di daftar) — pengaman; biasanya kosong. */
function orphans(menus: AdminMenu[], cats: Category[]): AdminMenu[] {
  const parentIds = new Set(cats.map((c) => c.id));
  return menus.filter((m) => m.parent_id !== null && !parentIds.has(m.parent_id));
}

function gateChip(m: AdminMenu) {
  if (m.module_code) return { cls: styles.chipBlue, text: `${m.module_code} · ${m.required_access_level}` };
  if (m.permission_code) return { cls: styles.chipAmber, text: m.permission_code };
  return { cls: styles.chipGray, text: "Publik" };
}

/** Apakah dua pohon identik dari sisi urutan & penempatan. */
function sameOrder(a: Category[], b: Category[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    const ca = a[i].children;
    const cb = b[i].children;
    if (ca.length !== cb.length) return false;
    for (let j = 0; j < ca.length; j++) if (ca[j].id !== cb[j].id) return false;
  }
  return true;
}

export function MenuManagerPage() {
  const toast = useToast();
  const menusQ = usePolling(fetchMenus, 0);
  const menus = useMemo(() => menusQ.data ?? [], [menusQ.data]);

  const [cats, setCats] = useState<Category[]>([]);
  const [baseline, setBaseline] = useState<Category[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [saving, setSaving] = useState(false);

  // State ciutkan per-kategori (murni tampilan, disimpan per-browser).
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("menuManager.collapsed");
      return new Set(raw ? (JSON.parse(raw) as number[]) : []);
    } catch {
      return new Set();
    }
  });
  const persistCollapsed = (s: Set<number>) => {
    try {
      localStorage.setItem("menuManager.collapsed", JSON.stringify([...s]));
    } catch {
      /* abaikan: storage bisa diblokir */
    }
  };
  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistCollapsed(next);
      return next;
    });
  }, []);
  const expand = useCallback((id: number) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      persistCollapsed(next);
      return next;
    });
  }, []);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AdminMenu | null>(null);
  const [createParent, setCreateParent] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMenu | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Rebuild dari server hanya saat tak ada perubahan urutan tertunda, agar
  // reorder yang belum disimpan tidak hilang oleh polling/refresh.
  const dirtyRef = useRef(false);
  const dirty = !sameOrder(cats, baseline);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (dirtyRef.current) return;
    const tree = buildTree(menus);
    setCats(tree);
    setBaseline(tree);
  }, [menus]);

  const leftover = useMemo(() => orphans(menus, cats), [menus, cats]);

  const reset = useCallback(() => {
    setCats(baseline.map((c) => ({ ...c, children: [...c.children] })));
    setDrag(null);
    setOver(null);
  }, [baseline]);

  function edgeFromEvent(e: DragEvent, el: HTMLElement): Edge {
    const rect = el.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? "before" : "after";
  }

  function endDrag() {
    setDrag(null);
    setOver(null);
  }

  // --- Reorder kategori ---
  function dropOnCategory(targetId: number, edge: Edge) {
    if (!drag || drag.kind !== "cat" || drag.id === targetId) return endDrag();
    setCats((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((c) => c.id === drag.id);
      if (fromIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      let targetIdx = next.findIndex((c) => c.id === targetId);
      if (targetIdx < 0) return prev;
      if (edge === "after") targetIdx += 1;
      next.splice(targetIdx, 0, moved);
      return next;
    });
    endDrag();
  }

  // --- Pindah / reorder submenu ---
  function dropOnChild(toParentId: number, targetChildId: number, edge: Edge) {
    if (!drag || drag.kind !== "child" || drag.id === targetChildId) return endDrag();
    setCats((prev) => moveChild(prev, drag.id, toParentId, targetChildId, edge));
    endDrag();
  }

  function dropOnBody(toParentId: number) {
    if (!drag || drag.kind !== "child") return endDrag();
    setCats((prev) => moveChild(prev, drag.id, toParentId, null, "after"));
    endDrag();
  }

  function moveChild(
    prev: Category[],
    childId: number,
    toParentId: number,
    targetChildId: number | null,
    edge: Edge
  ): Category[] {
    let moved: AdminMenu | undefined;
    const stripped = prev.map((c) => {
      const idx = c.children.findIndex((ch) => ch.id === childId);
      if (idx < 0) return c;
      moved = c.children[idx];
      return { ...c, children: c.children.filter((ch) => ch.id !== childId) };
    });
    if (!moved) return prev;
    const child: AdminMenu = { ...moved, parent_id: toParentId };
    return stripped.map((c) => {
      if (c.id !== toParentId) return c;
      const children = [...c.children];
      if (targetChildId === null) {
        children.push(child);
      } else {
        let idx = children.findIndex((ch) => ch.id === targetChildId);
        if (idx < 0) children.push(child);
        else {
          if (edge === "after") idx += 1;
          children.splice(idx, 0, child);
        }
      }
      return { ...c, children };
    });
  }

  async function save() {
    const items: MenuReorderItem[] = [];
    cats.forEach((c, ci) => {
      items.push({ id: c.id, parent_id: null, display_order: (ci + 1) * 10 });
      c.children.forEach((ch, chi) => {
        items.push({ id: ch.id, parent_id: c.id, display_order: (chi + 1) * 10 });
      });
    });
    setSaving(true);
    try {
      await reorderMenus(items);
      toast.success("Urutan menu disimpan");
      setBaseline(cats.map((c) => ({ ...c, children: [...c.children] })));
      menusQ.refresh();
    } catch (err) {
      toast.error("Gagal menyimpan urutan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  function openCreateCategory() {
    setEditing(null);
    setCreateParent(null);
    setFormMode("create");
  }
  function openCreateChild(parentId: number) {
    setEditing(null);
    setCreateParent(parentId);
    setFormMode("create");
  }
  function openEdit(m: AdminMenu) {
    setEditing(m);
    setCreateParent(null);
    setFormMode("edit");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMenu(deleteTarget.id);
      toast.success("Menu dihapus");
      setDeleteTarget(null);
      menusQ.refresh();
    } catch (err) {
      toast.error("Gagal menghapus menu", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  const totalChildren = cats.reduce((n, c) => n + c.children.length, 0);
  const allCollapsed = cats.length > 0 && cats.every((c) => collapsed.has(c.id));
  function toggleAll() {
    const next = allCollapsed ? new Set<number>() : new Set(cats.map((c) => c.id));
    persistCollapsed(next);
    setCollapsed(next);
  }

  return (
    <div className={mstyles.page}>
      <div className={mstyles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Manajemen Menu</strong>
          <span className={mstyles.muted} style={{ fontSize: "var(--fs-xs)" }}>
            Seret untuk mengatur urutan & penempatan navigasi. {cats.length} kategori · {totalChildren} submenu.
          </span>
        </div>
        <span className={mstyles.headSpacer} />
        {dirty && (
          <span className={styles.dirtyTag}>
            <Icon name="circle-dot" size={14} /> Perubahan belum disimpan
          </span>
        )}
        {cats.length > 0 && (
          <Button variant="ghost" icon={allCollapsed ? "chevrons-up-down" : "chevrons-down-up"} onClick={toggleAll}>
            {allCollapsed ? "Perluas semua" : "Ciutkan semua"}
          </Button>
        )}
        <Button variant="ghost" icon="rotate-ccw" onClick={reset} disabled={!dirty || saving}>Batalkan</Button>
        <Button variant="secondary" icon="plus" onClick={openCreateCategory}>Kategori</Button>
        <Button variant="primary" icon="save" onClick={save} disabled={!dirty || saving}>
          {saving ? "Menyimpan…" : "Simpan Urutan"}
        </Button>
      </div>

      <div className={mstyles.body} style={{ flexDirection: "column", overflow: "auto" }}>
        {menusQ.loading && cats.length === 0 ? (
          <EmptyState icon="list-tree" title="Memuat menu…" />
        ) : cats.length === 0 ? (
          <EmptyState icon="list-tree" title="Belum ada menu" description="Tambahkan kategori untuk memulai." />
        ) : (
          <div className={styles.tree}>
            {cats.map((cat) => {
              const cg = gateChip(cat);
              const isDragging = drag?.kind === "cat" && drag.id === cat.id;
              const isCollapsed = collapsed.has(cat.id);
              const overCat = over?.kind === "cat" && over.id === cat.id ? over.edge : null;
              const overBody = over?.kind === "body" && over.parentId === cat.id;
              return (
                <section
                  key={cat.id}
                  className={`${styles.cat} ${isDragging ? styles.ghost : ""}`}
                  data-over-before={overCat === "before" || undefined}
                  data-over-after={overCat === "after" || undefined}
                  data-collapsed={isCollapsed || undefined}
                >
                  <header
                    className={styles.catHead}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(cat.id)); setDrag({ kind: "cat", id: cat.id }); }}
                    onDragEnd={endDrag}
                    onDragOver={(e) => {
                      if (drag?.kind === "cat") {
                        e.preventDefault();
                        setOver({ kind: "cat", id: cat.id, edge: edgeFromEvent(e, e.currentTarget) });
                      } else if (drag?.kind === "child" && isCollapsed) {
                        // Auto-perluas saat submenu diseret ke header yang terciut,
                        // agar bisa dilepas ke dalamnya.
                        expand(cat.id);
                      }
                    }}
                    onDrop={(e) => {
                      if (drag?.kind !== "cat") return;
                      e.preventDefault();
                      dropOnCategory(cat.id, edgeFromEvent(e, e.currentTarget));
                    }}
                  >
                    <button
                      type="button"
                      className={styles.collapseBtn}
                      onClick={() => toggleCollapse(cat.id)}
                      title={isCollapsed ? "Perluas" : "Ciutkan"}
                      aria-label={isCollapsed ? "Perluas kategori" : "Ciutkan kategori"}
                      aria-expanded={!isCollapsed}
                    >
                      <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={16} />
                    </button>
                    <span className={styles.grip} title="Seret untuk memindah"><Icon name="grip-vertical" size={16} /></span>
                    <Icon name={cat.icon || "folder"} size={17} />
                    <span className={styles.catMeta}>
                      <span className={styles.catName}>{cat.menu_name}</span>
                      <span className={styles.code}>{cat.menu_code}{cat.route_path ? ` · ${cat.route_path}` : ""}</span>
                    </span>
                    {isCollapsed && cat.children.length > 0 && (
                      <span className={styles.countChip}>{cat.children.length} submenu</span>
                    )}
                    <span className={`${styles.chip} ${cg.cls}`}>{cg.text}</span>
                    <StatusPill label={Number(cat.is_active) === 1 ? "Aktif" : "Nonaktif"} tone={Number(cat.is_active) === 1 ? "green" : "gray"} />
                    <span className={styles.actions}>
                      <Button variant="ghost" size="sm" icon="plus" iconOnly title="Tambah submenu" onClick={() => openCreateChild(cat.id)} />
                      <Button variant="ghost" size="sm" icon="pencil" iconOnly title="Ubah" onClick={() => openEdit(cat)} />
                      <Button variant="ghost" size="sm" icon="trash-2" iconOnly title="Hapus" onClick={() => setDeleteTarget(cat)} />
                    </span>
                  </header>

                  {!isCollapsed && (
                  <div
                    className={`${styles.children} ${overBody ? styles.bodyOver : ""}`}
                    onDragOver={(e) => {
                      if (drag?.kind !== "child") return;
                      e.preventDefault();
                      if (cat.children.length === 0) setOver({ kind: "body", parentId: cat.id });
                    }}
                    onDrop={(e) => {
                      if (drag?.kind !== "child") return;
                      e.preventDefault();
                      if (cat.children.length === 0) dropOnBody(cat.id);
                    }}
                  >
                    {cat.children.length === 0 ? (
                      <div className={styles.empty}>Lepas submenu di sini</div>
                    ) : (
                      cat.children.map((ch) => {
                        const g = gateChip(ch);
                        const chDragging = drag?.kind === "child" && drag.id === ch.id;
                        const overEdge = over?.kind === "child" && over.id === ch.id ? over.edge : null;
                        return (
                          <div
                            key={ch.id}
                            className={`${styles.child} ${chDragging ? styles.ghost : ""}`}
                            data-over-before={overEdge === "before" || undefined}
                            data-over-after={overEdge === "after" || undefined}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(ch.id)); setDrag({ kind: "child", id: ch.id, parentId: cat.id }); }}
                            onDragEnd={endDrag}
                            onDragOver={(e) => {
                              if (drag?.kind !== "child") return;
                              e.preventDefault();
                              setOver({ kind: "child", id: ch.id, edge: edgeFromEvent(e, e.currentTarget) });
                            }}
                            onDrop={(e) => {
                              if (drag?.kind !== "child") return;
                              e.preventDefault();
                              dropOnChild(cat.id, ch.id, edgeFromEvent(e, e.currentTarget));
                            }}
                          >
                            <span className={styles.grip} title="Seret untuk memindah"><Icon name="grip-vertical" size={15} /></span>
                            <Icon name={ch.icon || "file"} size={15} />
                            <span className={styles.childMeta}>
                              <span className={styles.childName}>{ch.menu_name}</span>
                              <span className={styles.code}>{ch.route_path || ch.menu_code}</span>
                            </span>
                            <span className={`${styles.chip} ${g.cls}`}>{g.text}</span>
                            {Number(ch.is_active) !== 1 && <StatusPill label="Nonaktif" tone="gray" />}
                            <span className={styles.actions}>
                              <Button variant="ghost" size="sm" icon="pencil" iconOnly title="Ubah" onClick={() => openEdit(ch)} />
                              <Button variant="ghost" size="sm" icon="trash-2" iconOnly title="Hapus" onClick={() => setDeleteTarget(ch)} />
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}
                </section>
              );
            })}

            {leftover.length > 0 && (
              <section className={styles.cat}>
                <header className={styles.catHead} style={{ cursor: "default" }}>
                  <Icon name="alert-triangle" size={16} />
                  <span className={styles.catMeta}>
                    <span className={styles.catName}>Tanpa kategori</span>
                    <span className={styles.code}>Submenu dengan induk tak dikenal — ubah untuk menautkan ulang.</span>
                  </span>
                </header>
                <div className={styles.children}>
                  {leftover.map((ch) => (
                    <div key={ch.id} className={styles.child}>
                      <Icon name={ch.icon || "file"} size={15} />
                      <span className={styles.childMeta}>
                        <span className={styles.childName}>{ch.menu_name}</span>
                        <span className={styles.code}>{ch.route_path || ch.menu_code}</span>
                      </span>
                      <span className={styles.actions}>
                        <Button variant="ghost" size="sm" icon="pencil" iconOnly title="Ubah" onClick={() => openEdit(ch)} />
                        <Button variant="ghost" size="sm" icon="trash-2" iconOnly title="Hapus" onClick={() => setDeleteTarget(ch)} />
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <MenuFormModal
        open={formMode !== null}
        mode={formMode ?? "create"}
        menu={formMode === "edit" ? editing : null}
        menus={menus}
        appCode={APP}
        defaultParentId={createParent}
        onClose={() => setFormMode(null)}
        onSaved={menusQ.refresh}
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
          Hapus menu <b>{deleteTarget?.menu_name}</b> (<span className={styles.code}>{deleteTarget?.menu_code}</span>)?
          <br />
          <span className={styles.warn}>Kategori yang masih memiliki submenu tidak dapat dihapus.</span>
        </p>
      </Modal>
    </div>
  );
}
