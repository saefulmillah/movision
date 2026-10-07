import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon } from "@/components/ui";
import { getRole } from "@/lib/access";
import type { AccessLevel, AccessModule, Role, RoleDetail } from "@/types/access";
import type { UserRecord } from "@/types/users";
import { RANK, levelMeta } from "./constants";
import styles from "./Akses.module.css";

const TONE_BG: Record<string, string> = {
  gray: styles.bgGray,
  blue: styles.bgBlue,
  amber: styles.bgAmber,
  red: styles.bgRed
};

interface UsersAccessProps {
  users: UserRecord[];
  roles: Role[];
  modules: AccessModule[];
  goHub: () => void;
}

function initials(name: string | null | undefined, fallback: string): string {
  const base = (name || fallback || "?").trim();
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function UsersAccess({ users, roles, modules, goHub }: UsersAccessProps) {
  const navigate = useNavigate();
  const roleByCode = useMemo(() => new Map(roles.map((r) => [r.role_code, r])), [roles]);
  const modName = useMemo(() => new Map(modules.map((m) => [m.module_code, m.module_name])), [modules]);

  const [selectedId, setSelectedId] = useState<number | null>(users[0]?.id ?? null);
  const selected = users.find((u) => u.id === selectedId) ?? users[0] ?? null;

  // Cache detail role (untuk hitung sumber & override) per role_code.
  const detailCache = useRef<Map<string, RoleDetail>>(new Map());
  const [, forceTick] = useState(0);

  const loadRoleDetails = useCallback(
    async (codes: string[]) => {
      let changed = false;
      for (const code of codes) {
        if (code === "super_admin" || detailCache.current.has(code)) continue;
        const role = roleByCode.get(code);
        if (!role) continue;
        try {
          const d = await getRole(role.id);
          detailCache.current.set(code, d);
          changed = true;
        } catch {
          /* abaikan role yang gagal dimuat */
        }
      }
      if (changed) forceTick((t) => t + 1);
    },
    [roleByCode]
  );

  useEffect(() => {
    if (selected) void loadRoleDetails(selected.roles);
  }, [selected, loadRoleDetails]);

  const isSuper = !!selected?.roles.includes("super_admin");

  // Akses modul efektif = MAX level antar role (dari role_module_access yang
  // dikelola admin), lalu DITIMPA override per-user yang eksplisit (non-"none").
  // Catatan: capability /users/:id belum konsumsi role_module_access, jadi sumber
  // kebenaran role diambil dari detail role; hanya override non-"none" yang dipakai.
  const effModules = useMemo(() => {
    if (!selected) return [];
    if (isSuper) {
      return modules.map((m) => ({
        code: m.module_code,
        level: "delete" as AccessLevel,
        source: "dari role Super Admin",
        override: false
      }));
    }
    // Sumber per modul dari gabungan role (role_module_access).
    const roleSource: Record<string, string> = {};
    for (const code of selected.roles) {
      const d = detailCache.current.get(code);
      if (!d) continue;
      for (const m of d.module_access) {
        if (!roleSource[m.module_code]) roleSource[m.module_code] = d.role_name;
      }
    }
    // Level efektif yang berlaku = capability backend (non-"none"). OVERRIDE bila
    // modul tak diberikan oleh role mana pun (akses khusus per-user).
    return (selected.module_access ?? [])
      .filter((m) => (m.access_level as AccessLevel) !== "none")
      .map((m) => {
        const src = roleSource[m.module_code];
        return {
          code: m.module_code,
          level: m.access_level as AccessLevel,
          source: src ? `dari role ${src}` : "override khusus user ini",
          override: !src
        };
      });
  }, [selected, isSuper, modules, detailCache, roleByCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedModules = useMemo(
    () => [...effModules].sort((a, b) => RANK[b.level] - RANK[a.level]).slice(0, 12),
    [effModules]
  );

  if (!selected) {
    return (
      <div className={styles.usersWrap}>
        <Breadcrumb goHub={goHub} />
        <div className={styles.centerState}>
          <span className={styles.stateIcon}>
            <Icon name="users" size={26} />
          </span>
          <span className={styles.stateTitle}>Belum ada pengguna</span>
        </div>
      </div>
    );
  }

  const su = selected;
  const suName = su.display_name || su.full_name || su.username;
  const suBranches = su.branch_scopes ?? [];
  const suPerms = su.permissions ?? [];

  return (
    <div className={styles.usersWrap}>
      <Breadcrumb goHub={goHub} />
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Pengguna &amp; Akses Efektif</h1>
        <span className={styles.spacer} />
        <Button variant="primary" icon="plus" onClick={() => navigate("/admin/users")}>
          Kelola Pengguna
        </Button>
      </div>

      <div className={styles.usersBody}>
        {/* list */}
        <div className={styles.usersList}>
          <div className={styles.usersHead}>
            <span>Pengguna</span>
            <span>Role</span>
            <span>Ruas</span>
            <span>Status</span>
          </div>
          <div className={styles.usersScroll}>
            {users.map((u) => {
              const uname = u.display_name || u.full_name || u.username;
              return (
                <div
                  key={u.id}
                  className={`${styles.userRow} ${u.id === selectedId ? styles.userRowActive : ""}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <span className={styles.userCell}>
                    <span className={styles.avatar} style={{ width: 34, height: 34, fontSize: 12 }}>
                      {initials(u.full_name || u.display_name, u.username)}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span className={styles.userName}>{uname}</span>
                      <span className={styles.roleCode}>{u.username}</span>
                    </span>
                  </span>
                  <span className={styles.chipWrap}>
                    {u.roles.map((rc) => (
                      <span key={rc} className={styles.chip}>
                        {roleByCode.get(rc)?.role_name ?? rc}
                      </span>
                    ))}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {u.branch_scopes?.length ? `${u.branch_scopes.length} ruas` : "Semua / —"}
                  </span>
                  <span>
                    <span className={`${styles.pill} ${u.is_active ? styles.pillActive : styles.pillInactive}`}>
                      <span className={styles.pillDot} />
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* detail */}
        <aside className={styles.detailPanel} key={su.id}>
          <div className={styles.detailHead}>
            <span className={styles.avatar} style={{ width: 38, height: 38, fontSize: 13 }}>
              {initials(su.full_name || su.display_name, su.username)}
            </span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{suName}</span>
              <span className={styles.roleCode}>{su.username}</span>
            </span>
          </div>
          <div className={styles.detailBody}>
            <div className={styles.detailSection}>
              <span className={styles.sectionLabel}>Role</span>
              <div className={styles.chipWrap}>
                {su.roles.map((rc) => (
                  <span key={rc} className={styles.chip}>
                    {roleByCode.get(rc)?.role_name ?? rc}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.detailSection}>
              <span className={styles.sectionLabel}>Akses Modul Efektif</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Level tertinggi dari gabungan role, lalu ditimpa override user.
              </span>
              {isSuper && (
                <div className={styles.banner} style={{ padding: "8px 10px" }}>
                  <Icon name="shield-check" size={15} className={styles.bannerIconBlue} />
                  <span>Super admin — level Hapus pada semua modul otomatis.</span>
                </div>
              )}
              {sortedModules.map((m) => {
                const meta = levelMeta(m.level);
                return (
                  <div
                    key={m.code}
                    className={`${styles.effModRow} ${m.override ? styles.effModRowOverride : ""}`}
                  >
                    <span className={styles.effModName}>
                      <span style={{ fontSize: 12, color: "var(--text)" }}>{modName.get(m.code) || m.code}</span>
                      <span className={styles.effModSource}>{m.source}</span>
                    </span>
                    <span className={`${styles.levelBadge} ${TONE_BG[meta.tone]}`}>
                      <Icon name={meta.icon} size={12} />
                      {meta.label}
                    </span>
                    {m.override && <span className={styles.overrideBadge}>OVERRIDE</span>}
                  </div>
                );
              })}
            </div>

            <div className={styles.detailSection}>
              <span className={styles.sectionLabel}>Branch Scope</span>
              <div className={styles.chipWrap}>
                {suBranches.length ? (
                  suBranches.map((b) => (
                    <span key={b.id} className={`${styles.chip} ${styles.chipBranch}`}>
                      {b.branch_code || b.branch_name || `#${b.id}`}
                    </span>
                  ))
                ) : (
                  <span className={`${styles.chip} ${styles.chipBranch}`}>Semua ruas</span>
                )}
              </div>
            </div>

            <div className={styles.detailSection}>
              <span className={styles.sectionLabel}>
                Permission Efektif ({isSuper ? "semua" : suPerms.length})
              </span>
              <div className={styles.chipWrap}>
                {isSuper ? (
                  <span className={`${styles.chip} ${styles.chipMono}`}>(semua *)</span>
                ) : (
                  suPerms.map((p) => (
                    <span key={p} className={`${styles.chip} ${styles.chipMono}`}>
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderTop: "1px solid var(--line)" }}>
            <Button variant="secondary" icon="user" onClick={() => navigate("/admin/users")} style={{ flex: 1 }}>
              Ubah di Pengguna
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Breadcrumb({ goHub }: { goHub: () => void }) {
  return (
    <div className={styles.crumbs}>
      <button className={styles.crumbLink} onClick={goHub}>
        Manajemen Akses
      </button>
      <Icon name="chevron-right" size={14} />
      <span className={styles.crumbCur}>Pengguna</span>
    </div>
  );
}
