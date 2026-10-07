import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Modal, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  deleteModule,
  deletePermission,
  deleteRole,
  getRole,
  listModules,
  listPermissions,
  listRoles,
  updateModule
} from "@/lib/access";
import { fetchUsers } from "@/lib/users";
import type { AccessModule, Permission, ReferencedConflict, Role, RoleDetail } from "@/types/access";
import type { UserRecord } from "@/types/users";
import { groupBy, roleIcon } from "./constants";
import { RoleEditor } from "./RoleEditor";
import { UsersAccess } from "./UsersAccess";
import { CreateRoleModal, ModuleFormModal, PermissionFormModal } from "./modals";
import styles from "./Akses.module.css";

type Screen = "hub" | "roles" | "editor" | "perms" | "modules" | "users";
type ListState = "normal" | "loading" | "empty" | "error";

type ModalState =
  | null
  | { type: "create" }
  | { type: "deleteRole"; role: Role }
  | { type: "reassign"; role: Role }
  | { type: "blocked"; title: string; refs: { icon: string; label: string; count: number }[] }
  | { type: "cancel"; to: Screen }
  | { type: "permForm"; editing: Permission | null }
  | { type: "moduleForm"; editing: AccessModule | null };

export function AksesPage() {
  const toast = useToast();
  const { capability } = useAuth();

  const [screen, setScreen] = useState<Screen>("hub");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<AccessModule[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [search, setSearch] = useState("");
  const [listState, setListState] = useState<ListState>("normal");
  const [editorDirty, setEditorDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = editorDirty;
  const [modal, setModal] = useState<ModalState>(null);

  /* ---------- load ---------- */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p, m, u] = await Promise.all([
        listRoles(),
        listPermissions(),
        listModules(),
        fetchUsers().catch(() => [] as UserRecord[])
      ]);
      setRoles(r);
      setPermissions(p);
      setModules(m);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data akses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshRoles = useCallback(async () => {
    try {
      setRoles(await listRoles());
    } catch {
      /* diamkan */
    }
  }, []);

  /* ---------- navigation (dirty-guarded) ---------- */
  const navGuarded = useCallback((to: Screen) => {
    if (dirtyRef.current) {
      setModal({ type: "cancel", to });
      return;
    }
    setDetail(null);
    setEditorDirty(false);
    setScreen(to);
  }, []);
  const goHub = useCallback(() => navGuarded("hub"), [navGuarded]);
  const goRoles = useCallback(() => navGuarded("roles"), [navGuarded]);
  const nav = useCallback((s: Screen) => setScreen(s), []);

  async function openRole(id: number) {
    try {
      const d = await getRole(id);
      setDetail(d);
      setEditorDirty(false);
      setScreen("editor");
    } catch (err) {
      toast.error("Gagal membuka role", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  /* ---------- role delete ---------- */
  function requestDeleteRole(role: Role) {
    if (role.is_system) return;
    if (role.user_count > 0) {
      setModal({ type: "reassign", role });
    } else {
      setModal({ type: "deleteRole", role });
    }
  }

  async function confirmDeleteRole(role: Role) {
    try {
      await deleteRole(role.id);
      toast.success("Role dihapus", role.role_name);
      setModal(null);
      if (detail?.id === role.id) {
        setDetail(null);
        setScreen("roles");
      }
      await refreshRoles();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModal({ type: "reassign", role });
      } else {
        toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    }
  }

  /* ---------- permission / module delete ---------- */
  function conflictRefs(payload: unknown, kind: "perm" | "module"): { icon: string; label: string; count: number }[] {
    const d = Array.isArray(payload) ? (payload[0] as ReferencedConflict) : (payload as ReferencedConflict);
    const refs: { icon: string; label: string; count: number }[] = [];
    if (d?.referenced_by_roles) refs.push({ icon: "shield", label: "Dipakai role", count: d.referenced_by_roles });
    if (kind === "module" && d?.referenced_by_users)
      refs.push({ icon: "users", label: "Override user", count: d.referenced_by_users });
    if (d?.referenced_by_menus) refs.push({ icon: "list", label: "Terikat menu", count: d.referenced_by_menus });
    return refs;
  }

  async function handleDeletePermission(p: Permission) {
    try {
      await deletePermission(p.id);
      toast.success("Permission dihapus", p.permission_code);
      setPermissions(await listPermissions());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModal({ type: "blocked", title: p.permission_code, refs: conflictRefs(err.payload, "perm") });
      } else {
        toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    }
  }

  async function handleDeleteModule(m: AccessModule) {
    try {
      await deleteModule(m.id);
      toast.success("Modul dihapus", m.module_name);
      setModules(await listModules());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModal({ type: "blocked", title: m.module_name, refs: conflictRefs(err.payload, "module") });
      } else {
        toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    }
  }

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.card}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.sklRow}>
                <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span className={styles.skl} style={{ width: 36, height: 36, borderRadius: 9 }} />
                  <span className={styles.skl} style={{ width: 120, height: 14 }} />
                </span>
                <span className={styles.skl} style={{ width: 80, height: 20, borderRadius: 5 }} />
                <span className={styles.skl} style={{ width: 24, height: 12 }} />
                <span className={styles.skl} style={{ width: 24, height: 12 }} />
                <span className={styles.skl} style={{ width: 24, height: 12 }} />
                <span />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <div className={styles.centerState}>
              <span className={`${styles.stateIcon} ${styles.stateIconErr}`}>
                <Icon name="triangle-alert" size={26} />
              </span>
              <span className={styles.stateTitle}>Gagal memuat</span>
              <span className={styles.stateDesc}>{error}</span>
              <Button icon="refresh-cw" onClick={() => void loadAll()}>
                Coba lagi
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {screen === "hub" && (
        <Hub roles={roles} permissions={permissions} modules={modules} users={users} capability={capability} onNav={nav} />
      )}

      {screen === "roles" && (
        <RoleList
          roles={roles}
          search={search}
          setSearch={setSearch}
          listState={listState}
          setListState={setListState}
          goHub={goHub}
          onOpen={(id) => void openRole(id)}
          onDelete={requestDeleteRole}
          onCreate={() => setModal({ type: "create" })}
        />
      )}

      {screen === "editor" && detail && (
        <RoleEditor
          detail={detail}
          userCount={roles.find((r) => r.id === detail.id)?.user_count ?? 0}
          permissions={permissions}
          modules={modules}
          onDirtyChange={setEditorDirty}
          onSaved={() => void refreshRoles().then(() => void openRole(detail.id))}
          goHub={goHub}
          goRoles={goRoles}
        />
      )}

      {screen === "perms" && (
        <PermissionCatalog
          permissions={permissions}
          goHub={goHub}
          onAdd={() => setModal({ type: "permForm", editing: null })}
          onEdit={(p) => setModal({ type: "permForm", editing: p })}
          onDelete={(p) => void handleDeletePermission(p)}
        />
      )}

      {screen === "modules" && (
        <ModuleCatalog
          modules={modules}
          goHub={goHub}
          onAdd={() => setModal({ type: "moduleForm", editing: null })}
          onEdit={(m) => setModal({ type: "moduleForm", editing: m })}
          onDelete={(m) => void handleDeleteModule(m)}
          onRefresh={async () => setModules(await listModules())}
        />
      )}

      {screen === "users" && <UsersAccess users={users} roles={roles} modules={modules} goHub={goHub} />}

      {/* ---------- modals ---------- */}
      <CreateRoleModal
        open={modal?.type === "create"}
        onOpenChange={(o) => !o && setModal(null)}
        onCreated={(role) => {
          void refreshRoles();
          void openRole(role.id);
        }}
      />
      <PermissionFormModal
        open={modal?.type === "permForm"}
        editing={modal?.type === "permForm" ? modal.editing : null}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={async () => setPermissions(await listPermissions())}
      />
      <ModuleFormModal
        open={modal?.type === "moduleForm"}
        editing={modal?.type === "moduleForm" ? modal.editing : null}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={async () => setModules(await listModules())}
      />

      {/* Reassign (role masih dipakai) */}
      <Modal
        open={modal?.type === "reassign"}
        onOpenChange={(o) => !o && setModal(null)}
        title="Role masih dipakai"
        width={500}
        footer={<Button variant="secondary" onClick={() => setModal(null)}>Mengerti</Button>}
      >
        {modal?.type === "reassign" && (
          <div className={styles.formCol}>
            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              Role <b style={{ color: "var(--text)" }}>{modal.role.role_name}</b> dipakai oleh{" "}
              <b style={{ color: "var(--text)" }}>{modal.role.user_count} pengguna</b>. Pindahkan dulu mereka ke role lain
              (lewat menu Pengguna &amp; Akses) sebelum menghapus.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={styles.sectionLabel}>Pengguna terdampak</span>
              {users
                .filter((u) => u.roles.includes(modal.role.role_code))
                .slice(0, 5)
                .map((u) => (
                  <div key={u.id} className={styles.reassignUser}>
                    <span className={styles.avatar} style={{ width: 28, height: 28, fontSize: 11 }}>
                      {(u.full_name || u.username).slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text)" }}>{u.full_name || u.display_name || u.username}</span>
                    <span className={styles.uname}>{u.username}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Blocked (permission/modul direferensi) */}
      <Modal
        open={modal?.type === "blocked"}
        onOpenChange={(o) => !o && setModal(null)}
        title="Tidak dapat dihapus"
        width={460}
        footer={<Button variant="secondary" onClick={() => setModal(null)}>Mengerti</Button>}
      >
        {modal?.type === "blocked" && (
          <div className={styles.formCol}>
            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--text)" }}>{modal.title}</b> masih direferensikan dan tak bisa dihapus sampai semua
              tautannya dilepas.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {modal.refs.map((r) => (
                <div key={r.label} className={styles.refRow}>
                  <Icon name={r.icon} size={15} />
                  {r.label}
                  <span className={styles.refCount}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete role confirm */}
      <Modal
        open={modal?.type === "deleteRole"}
        onOpenChange={(o) => !o && setModal(null)}
        title="Hapus Role"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => modal?.type === "deleteRole" && void confirmDeleteRole(modal.role)}>
              Hapus
            </Button>
          </>
        }
      >
        {modal?.type === "deleteRole" && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Hapus role <b style={{ color: "var(--text)" }}>{modal.role.role_name}</b> (
            <span className={styles.mono}>{modal.role.role_code}</span>)?
            <br />
            <span className={styles.danger}>Tindakan ini permanen dan tidak dapat dibatalkan.</span>
          </p>
        )}
      </Modal>

      {/* Cancel (buang perubahan) */}
      <Modal
        open={modal?.type === "cancel"}
        onOpenChange={(o) => !o && setModal(null)}
        title="Buang perubahan?"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Tetap di sini
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const to = modal?.type === "cancel" ? modal.to : "roles";
                setEditorDirty(false);
                dirtyRef.current = false;
                setDetail(null);
                setScreen(to);
                setModal(null);
              }}
            >
              Buang perubahan
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Ada perubahan yang belum disimpan pada role ini. Jika keluar sekarang, perubahan tersebut akan hilang.
        </p>
      </Modal>
    </div>
  );
}

/* ================= Hub ================= */
function Hub({
  roles,
  permissions,
  modules,
  users,
  capability,
  onNav
}: {
  roles: Role[];
  permissions: Permission[];
  modules: AccessModule[];
  users: UserRecord[];
  capability: ReturnType<typeof useAuth>["capability"];
  onNav: (s: Screen) => void;
}) {
  const sysRoles = roles.filter((r) => r.is_system).length;
  const permGroups = new Set(permissions.map((p) => p.permission_group || "lainnya")).size;
  const modGroups = new Set(modules.map((m) => m.module_group || "lainnya")).size;
  const isSuper = !!capability?.roles?.includes("super_admin");
  const capName = capability?.user.display_name || capability?.user.username || "Saya";

  const stats = [
    { label: "Role", value: roles.length, icon: "shield" },
    { label: "Pengguna", value: users.length, icon: "users" },
    { label: "Permission", value: permissions.length, icon: "key-round" },
    { label: "Modul", value: modules.length, icon: "box" }
  ];
  const shortcuts = [
    { title: "Role", desc: "Buat dan atur kapabilitas tiap role.", meta: `${roles.length} role · ${sysRoles} sistem`, icon: "shield", to: "roles" as Screen },
    { title: "Pengguna", desc: "Lihat akses efektif tiap pengguna.", meta: `${users.length} pengguna`, icon: "users", to: "users" as Screen },
    { title: "Permission", desc: "Katalog izin aksi granular.", meta: `${permissions.length} permission · ${permGroups} grup`, icon: "key-round", to: "perms" as Screen },
    { title: "Modul", desc: "Area fitur dan level aksesnya.", meta: `${modules.length} modul · ${modGroups} grup`, icon: "box", to: "modules" as Screen }
  ];

  return (
    <div className={styles.wrap}>
      <div>
        <h1 className={styles.h1} style={{ marginBottom: 5 }}>
          Manajemen Akses
        </h1>
        <p className={styles.sub}>
          Kelola siapa boleh melihat dan mengubah apa. Atur role, permission, modul, dan akses tiap pengguna dari satu
          tempat — tanpa perlu deploy ulang.
        </p>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statIcon}>
                <Icon name={s.icon} size={16} />
              </span>
            </div>
            <span className={styles.statValue}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.shortcutGrid}>
        {shortcuts.map((c) => (
          <button key={c.title} className={styles.shortcut} onClick={() => onNav(c.to)}>
            <span className={styles.shortcutIcon}>
              <Icon name={c.icon} size={21} />
            </span>
            <span className={styles.shortcutBody}>
              <span className={styles.shortcutTitle}>{c.title}</span>
              <span className={styles.shortcutDesc}>{c.desc}</span>
              <span className={styles.shortcutMeta}>{c.meta}</span>
            </span>
            <Icon name="chevron-right" size={18} style={{ color: "var(--text-faint)" }} />
          </button>
        ))}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.effRow}>
          <span className={styles.avatar} style={{ width: 34, height: 34, fontSize: 12 }}>
            {capName.slice(0, 2).toUpperCase()}
          </span>
          <span className={styles.effName}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Akses efektif saya</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {capName} · {capability?.roles?.[0] ?? "—"}
            </span>
          </span>
          {isSuper && (
            <span className={`${styles.badge} ${styles.effBypass}`} style={{ background: "color-mix(in srgb, var(--sem-green) 16%, transparent)", color: "var(--st-green)" }}>
              <Icon name="shield-check" size={13} />
              Bypass penuh
            </span>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
          {isSuper ? (
            <>
              Sebagai super admin, Anda memiliki level <b style={{ color: "var(--text)" }}>Hapus</b> pada seluruh{" "}
              {modules.length} modul dan seluruh permission secara otomatis. Branch scope tidak membatasi akun ini.
            </>
          ) : (
            <>
              Anda memiliki <b style={{ color: "var(--text)" }}>{capability?.permissions?.length ?? 0}</b> permission dan
              akses ke <b style={{ color: "var(--text)" }}>{capability?.module_access?.length ?? 0}</b> modul melalui role
              yang ditetapkan.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ================= Role list ================= */
function RoleList({
  roles,
  search,
  setSearch,
  listState,
  setListState,
  goHub,
  onOpen,
  onDelete,
  onCreate
}: {
  roles: Role[];
  search: string;
  setSearch: (v: string) => void;
  listState: ListState;
  setListState: (s: ListState) => void;
  goHub: () => void;
  onOpen: (id: number) => void;
  onDelete: (r: Role) => void;
  onCreate: () => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.role_name.toLowerCase().includes(q) || r.role_code.includes(q));
  }, [roles, search]);

  const display: ListState = listState === "normal" && filtered.length === 0 ? "empty" : listState;

  return (
    <div className={styles.wrap}>
      <div className={styles.crumbs}>
        <button className={styles.crumbLink} onClick={goHub}>
          Manajemen Akses
        </button>
        <Icon name="chevron-right" size={14} />
        <span className={styles.crumbCur}>Role</span>
      </div>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Role</h1>
        <span className={styles.spacer} />
        <div className={styles.stateSwitch}>
          {(["normal", "loading", "empty", "error"] as ListState[]).map((s) => (
            <button
              key={s}
              className={`${styles.stateBtn} ${listState === s ? styles.stateBtnActive : ""}`}
              onClick={() => setListState(s)}
            >
              {s === "normal" ? "Normal" : s === "loading" ? "Memuat" : s === "empty" ? "Kosong" : "Galat"}
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <Icon name="search" size={16} style={{ color: "var(--text-faint)" }} />
          <input placeholder="Cari role…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="primary" icon="plus" onClick={onCreate}>
          Buat Role
        </Button>
      </div>

      <div className={styles.card}>
        <div className={styles.roleHead}>
          <span>Role</span>
          <span>Status</span>
          <span>Pengguna</span>
          <span>Permission</span>
          <span>Modul</span>
          <span />
        </div>

        {display === "loading" &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.sklRow}>
              <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span className={styles.skl} style={{ width: 36, height: 36, borderRadius: 9 }} />
                <span className={styles.skl} style={{ width: 120, height: 14 }} />
              </span>
              <span className={styles.skl} style={{ width: 80, height: 20, borderRadius: 5 }} />
              <span className={styles.skl} style={{ width: 24, height: 12 }} />
              <span className={styles.skl} style={{ width: 24, height: 12 }} />
              <span className={styles.skl} style={{ width: 24, height: 12 }} />
              <span />
            </div>
          ))}

        {display === "empty" && (
          <div className={styles.centerState}>
            <span className={styles.stateIcon}>
              <Icon name="shield" size={26} />
            </span>
            <span className={styles.stateTitle}>Belum ada role</span>
            <span className={styles.stateDesc}>
              Role sistem seperti <b style={{ color: "var(--text-dim)" }}>super_admin</b> selalu ada. Buat role baru untuk
              mengelompokkan izin sesuai kebutuhan tim.
            </span>
            <Button variant="primary" icon="plus" onClick={onCreate}>
              Buat Role
            </Button>
          </div>
        )}

        {display === "error" && (
          <div className={styles.centerState}>
            <span className={`${styles.stateIcon} ${styles.stateIconErr}`}>
              <Icon name="triangle-alert" size={26} />
            </span>
            <span className={styles.stateTitle}>Gagal memuat role</span>
            <span className={styles.stateDesc}>Sambungan ke server terputus. Periksa koneksi lalu coba lagi.</span>
            <Button icon="refresh-cw" onClick={() => setListState("normal")}>
              Coba lagi
            </Button>
          </div>
        )}

        {display === "normal" &&
          filtered.map((r) => (
            <div key={r.id} className={styles.roleRow} onClick={() => onOpen(r.id)}>
              <span className={styles.roleCell}>
                <span className={styles.roleIcon}>
                  <Icon name={roleIcon(r.role_code)} size={18} />
                </span>
                <span className={styles.roleNameBox}>
                  <span className={styles.roleName}>
                    {r.role_name}
                    {r.is_system && <Icon name="lock" size={12} style={{ color: "var(--text-faint)" }} />}
                  </span>
                  <span className={styles.roleCode}>{r.role_code}</span>
                </span>
              </span>
              <span className={styles.statusWrap}>
                <span className={`${styles.badge} ${r.is_system ? styles.badgeSystem : styles.badgeCustom}`}>
                  {r.is_system ? "Sistem" : "Buatan"}
                </span>
                <span className={`${styles.pill} ${r.is_active ? styles.pillActive : styles.pillInactive}`}>
                  <span className={styles.pillDot} />
                  {r.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </span>
              <span className={styles.mono} style={{ color: "var(--text-dim)" }}>
                {r.user_count}
              </span>
              <span className={styles.mono} style={{ color: "var(--text-dim)" }}>
                {r.permission_count}
              </span>
              <span className={styles.mono} style={{ color: "var(--text-dim)" }}>
                {r.module_count}
              </span>
              <span className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
                <button className={styles.iconBtn} title="Ubah" onClick={() => onOpen(r.id)}>
                  <Icon name="pencil" size={16} />
                </button>
                <button
                  className={styles.iconBtn}
                  disabled={r.is_system}
                  title={r.is_system ? "Role sistem tak bisa dihapus" : "Hapus role"}
                  onClick={() => onDelete(r)}
                >
                  <Icon name="trash-2" size={16} />
                </button>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ================= Permission catalog ================= */
function PermissionCatalog({
  permissions,
  goHub,
  onAdd,
  onEdit,
  onDelete
}: {
  permissions: Permission[];
  goHub: () => void;
  onAdd: () => void;
  onEdit: (p: Permission) => void;
  onDelete: (p: Permission) => void;
}) {
  const groups = useMemo(() => groupBy(permissions, (p) => p.permission_group), [permissions]);
  return (
    <div className={styles.wrap}>
      <div className={styles.crumbs}>
        <button className={styles.crumbLink} onClick={goHub}>
          Manajemen Akses
        </button>
        <Icon name="chevron-right" size={14} />
        <span className={styles.crumbCur}>Permission</span>
      </div>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Katalog Permission</h1>
        <span className={styles.spacer} />
        <Button variant="primary" icon="plus" onClick={onAdd}>
          Tambah Permission
        </Button>
      </div>
      {groups.map((g) => (
        <div key={g.group} className={styles.card}>
          <div className={styles.catGroupHead}>
            <span className={styles.catGroupName}>{g.group}</span>
            <span className={styles.catGroupCount}>{g.items.length} permission</span>
          </div>
          {g.items.map((p) => (
            <div key={p.id} className={styles.permCatRow}>
              <span className={styles.codeMono}>{p.permission_code}</span>
              <span style={{ color: "var(--text)" }}>{p.permission_name}</span>
              <span>
                <span className={`${styles.countBadge} ${p.role_count > 0 ? styles.countOn : styles.countOff}`}>
                  {p.role_count} role
                </span>
              </span>
              <span className={styles.cellActions}>
                <button className={styles.iconBtn} title="Ubah" onClick={() => onEdit(p)}>
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  className={styles.iconBtn}
                  title={p.role_count > 0 ? `Dipakai ${p.role_count} role` : "Hapus permission"}
                  onClick={() => onDelete(p)}
                >
                  <Icon name="trash-2" size={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================= Module catalog ================= */
function ModuleCatalog({
  modules,
  goHub,
  onAdd,
  onEdit,
  onDelete,
  onRefresh
}: {
  modules: AccessModule[];
  goHub: () => void;
  onAdd: () => void;
  onEdit: (m: AccessModule) => void;
  onDelete: (m: AccessModule) => void;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const groups = useMemo(() => groupBy(modules, (m) => m.module_group), [modules]);

  async function toggleActive(m: AccessModule) {
    try {
      await updateModule(m.id, { module_name: m.module_name, is_active: m.is_active ? 0 : 1 });
      await onRefresh();
    } catch (err) {
      toast.error("Gagal mengubah status", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.crumbs}>
        <button className={styles.crumbLink} onClick={goHub}>
          Manajemen Akses
        </button>
        <Icon name="chevron-right" size={14} />
        <span className={styles.crumbCur}>Modul</span>
      </div>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Katalog Modul</h1>
        <span className={styles.spacer} />
        <Button variant="primary" icon="plus" onClick={onAdd}>
          Tambah Modul
        </Button>
      </div>
      <div className={styles.banner}>
        <Icon name="info" size={16} className={styles.bannerIconBlue} />
        <span>Modul baru hanya terdaftar di katalog. Agar aktif, hubungkan ke menu dan beri level akses pada role terkait.</span>
      </div>
      {groups.map((g) => (
        <div key={g.group} className={styles.card}>
          <div className={styles.catGroupHead}>
            <span className={styles.catGroupName}>{g.group}</span>
            <span className={styles.catGroupCount}>{g.items.length} modul</span>
          </div>
          {g.items.map((m) => (
            <div key={m.id} className={styles.modCatRow}>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{m.module_name}</span>
                <span className={styles.roleCode}>{m.module_code}</span>
              </span>
              <span>
                <span className={`${styles.countBadge} ${m.role_count > 0 ? styles.countOn : styles.countOff}`}>
                  {m.role_count} role
                </span>
              </span>
              <span className={styles.mono} style={{ color: "var(--text-muted)" }}>
                #{m.display_order}
              </span>
              <span className={styles.toggleInline}>
                <button
                  type="button"
                  className={`${styles.toggle} ${m.is_active ? styles.toggleOn : ""}`}
                  onClick={() => void toggleActive(m)}
                >
                  <span className={`${styles.toggleThumb} ${m.is_active ? styles.toggleThumbOn : ""}`} />
                </button>
                <span className={styles.toggleInlineLabel}>{m.is_active ? "Aktif" : "Nonaktif"}</span>
              </span>
              <span className={styles.cellActions}>
                <button className={styles.iconBtn} title="Ubah" onClick={() => onEdit(m)}>
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  className={styles.iconBtn}
                  title={m.role_count > 0 ? `Dipakai ${m.role_count} role` : "Hapus modul"}
                  onClick={() => onDelete(m)}
                >
                  <Icon name="trash-2" size={15} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
