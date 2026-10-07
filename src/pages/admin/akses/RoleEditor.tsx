import { useEffect, useMemo, useState } from "react";
import { Button, Icon, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { replaceRoleModuleAccess, replaceRolePermissions, updateRole } from "@/lib/access";
import type { AccessLevel, AccessModule, Permission, RoleDetail } from "@/types/access";
import { LEVELS, groupBy, roleIcon } from "./constants";
import styles from "./Akses.module.css";

const TONE_CLASS: Record<string, string> = {
  gray: styles.toneGray,
  blue: styles.toneBlue,
  amber: styles.toneAmber,
  red: styles.toneRed
};

interface RoleEditorProps {
  detail: RoleDetail;
  userCount: number;
  permissions: Permission[];
  modules: AccessModule[];
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  goHub: () => void;
  goRoles: () => void;
}

export function RoleEditor({
  detail,
  userCount,
  permissions,
  modules,
  onDirtyChange,
  onSaved,
  goHub,
  goRoles
}: RoleEditorProps) {
  const toast = useToast();
  const isSystem = detail.is_system;

  const originalPerms = useMemo(() => new Set(detail.permissions.map((p) => p.permission_code)), [detail]);

  const [name, setName] = useState(detail.role_name);
  const [desc, setDesc] = useState(detail.description ?? "");
  const [isActive, setIsActive] = useState(detail.is_active);
  const [perms, setPerms] = useState<Set<string>>(() => new Set(detail.permissions.map((p) => p.permission_code)));
  const [moduleMap, setModuleMap] = useState<Record<string, AccessLevel>>(() =>
    Object.fromEntries(detail.module_access.map((m) => [m.module_code, m.access_level]))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  /* ---------- matrix ---------- */
  const moduleGroups = useMemo(
    () => groupBy(modules, (m) => m.module_group),
    [modules]
  );

  function setLevel(code: string, level: AccessLevel) {
    if (isSystem) return;
    setModuleMap((prev) => {
      const next = { ...prev };
      if (level === "none") delete next[code];
      else next[code] = level;
      return next;
    });
    markDirty();
  }

  /* ---------- permissions ---------- */
  const permGroups = useMemo(
    () => groupBy(permissions, (p) => p.permission_group),
    [permissions]
  );

  function togglePerm(code: string) {
    if (isSystem && perms.has(code)) return; // sistem: tak boleh dikurangi
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    markDirty();
  }

  function toggleGroup(groupPerms: Permission[]) {
    const codes = groupPerms.map((p) => p.permission_code);
    const allOn = codes.every((c) => perms.has(c));
    setPerms((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (allOn) {
          if (!(isSystem && originalPerms.has(c))) next.delete(c);
        } else {
          next.add(c);
        }
      }
      return next;
    });
    markDirty();
  }

  /* ---------- save ---------- */
  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nama wajib", "Nama role tidak boleh kosong.");
      return;
    }
    setSaving(true);
    try {
      await updateRole(detail.id, {
        role_name: name.trim(),
        description: desc.trim() || null,
        is_active: isActive ? 1 : 0
      });
      await replaceRolePermissions(detail.id, [...perms]);
      await replaceRoleModuleAccess(
        detail.id,
        Object.entries(moduleMap).map(([module_code, access_level]) => ({ module_code, access_level }))
      );
      setDirty(false);
      onDirtyChange(false);
      toast.success("Tersimpan", `Perubahan role ${name.trim()} disimpan.`);
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409
          ? "Role sistem: permission tak boleh dikurangi."
          : err instanceof Error
            ? err.message
            : "Terjadi kesalahan";
      toast.error("Gagal menyimpan", msg);
    } finally {
      setSaving(false);
    }
  }

  const permSelected = perms.size;

  return (
    <div className={styles.editWrap}>
      {/* Breadcrumb */}
      <div className={styles.crumbs}>
        <button className={styles.crumbLink} onClick={goHub}>
          Manajemen Akses
        </button>
        <Icon name="chevron-right" size={14} />
        <button className={styles.crumbLink} onClick={goRoles}>
          Role
        </button>
        <Icon name="chevron-right" size={14} />
        <span className={styles.crumbCur}>{detail.role_name}</span>
      </div>

      {/* Header */}
      <div className={styles.edHeader}>
        <span className={styles.edIcon}>
          <Icon name={roleIcon(detail.role_code)} size={23} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.edTitleRow}>
            <h1 className={styles.h1}>{detail.role_name}</h1>
            {isSystem && (
              <span className={`${styles.badge} ${styles.badgeSystem}`}>
                <Icon name="lock" size={12} />
                Role sistem
              </span>
            )}
          </div>
          <span className={styles.roleCode}>{detail.role_code}</span>
        </div>
        <span className={styles.edUsers}>
          <span className={styles.edUsersN}>{userCount}</span>
          <span className={styles.edUsersL}>pengguna memakai</span>
        </span>
      </div>

      {isSystem && (
        <div className={styles.banner}>
          <Icon name="lock" size={16} className={styles.bannerIconAmber} />
          <span>
            Role sistem tak bisa dinonaktifkan atau dihapus, dan permission-nya tak bisa dikurangi. Anda masih boleh{" "}
            <b style={{ color: "var(--text)" }}>menambah</b> akses.
          </span>
        </div>
      )}

      {/* Info */}
      <div className={`${styles.card} ${styles.cardPad}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className={styles.sectionLabel}>Informasi</span>
        <div className={styles.infoGrid}>
          <div>
            <label className={styles.fieldLabel}>Nama Role</label>
            <input
              className={styles.input}
              value={name}
              disabled={isSystem}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>
              Kode <Icon name="lock" size={12} />
              <span className={styles.perm}>permanen</span>
            </label>
            <input className={`${styles.input} ${styles.inputLocked}`} value={detail.role_code} disabled readOnly />
          </div>
        </div>
        <div>
          <label className={styles.fieldLabel}>Deskripsi</label>
          <textarea
            className={styles.textarea}
            value={desc}
            disabled={isSystem}
            onChange={(e) => {
              setDesc(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggle} ${isActive ? styles.toggleOn : ""}`}
            disabled={isSystem}
            onClick={() => {
              if (isSystem) return;
              setIsActive((v) => !v);
              markDirty();
            }}
          >
            <span className={`${styles.toggleThumb} ${isActive ? styles.toggleThumbOn : ""}`} />
          </button>
          Role aktif
          {isSystem && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>— terkunci untuk role sistem</span>}
        </div>
      </div>

      {/* Matrix */}
      <div className={styles.card}>
        <div className={styles.secHead}>
          <span className={styles.secTitle}>Akses Modul</span>
          <span className={styles.secHint}>Tetapkan level akses role ini per modul.</span>
          <span className={styles.spacer} />
          <div className={styles.legend}>
            {LEVELS.map((lv) => (
              <span key={lv.key} className={styles.legItem}>
                <span className={styles.legSw} style={{ background: swatch(lv.tone) }} />
                {lv.label}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.matHead}>
          <span>Modul</span>
          <span className={styles.matLevels}>
            {LEVELS.map((lv) => (
              <span key={lv.key}>{lv.label}</span>
            ))}
          </span>
        </div>
        <div className={styles.matScroll}>
          {moduleGroups.map((grp) => (
            <div key={grp.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupName}>{grp.group}</span>
                <span className={styles.groupCount}>{grp.items.length}</span>
              </div>
              {grp.items.map((mod) => {
                const cur = moduleMap[mod.module_code] || "none";
                return (
                  <div key={mod.module_code} className={styles.matRow}>
                    <span className={styles.matName}>
                      <span className={styles.matModName}>{mod.module_name}</span>
                      <span className={styles.matModCode}>{mod.module_code}</span>
                    </span>
                    <span className={styles.cells}>
                      {LEVELS.map((lv) => {
                        const active = cur === lv.key;
                        return (
                          <button
                            key={lv.key}
                            type="button"
                            className={`${styles.cell} ${TONE_CLASS[lv.tone]} ${active ? styles.cellActive : ""}`}
                            disabled={isSystem}
                            title={isSystem ? "Terkunci (role sistem)" : `Set ${mod.module_name} → ${lv.label}`}
                            onClick={() => setLevel(mod.module_code, lv.key)}
                          >
                            <Icon name={lv.icon} size={14} />
                            {lv.label}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className={styles.card}>
        <div className={styles.secHead}>
          <span className={styles.secTitle}>Permission</span>
          <span className={styles.secHint}>Izin aksi granular di luar level modul.</span>
          <span className={styles.spacer} />
          <span className={styles.mono} style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {permSelected} dipilih
          </span>
        </div>
        <div className={styles.permScroll}>
          {permGroups.map((grp) => {
            const codes = grp.items.map((p) => p.permission_code);
            const allOn = codes.every((c) => perms.has(c));
            return (
              <div key={grp.group} className={styles.permGroup}>
                <div className={styles.permGroupHead}>
                  <span className={styles.sectionLabel}>{grp.group}</span>
                  <span className={styles.permGroupLine} />
                  <button className={styles.permSelectAll} onClick={() => toggleGroup(grp.items)}>
                    {allOn ? "Hapus semua" : "Pilih semua"}
                  </button>
                </div>
                <div className={styles.permGrid}>
                  {grp.items.map((p) => {
                    const checked = perms.has(p.permission_code);
                    const locked = isSystem && originalPerms.has(p.permission_code);
                    return (
                      <button
                        key={p.permission_code}
                        type="button"
                        className={`${styles.permItem} ${checked ? styles.permItemOn : ""}`}
                        disabled={locked}
                        title={locked ? "Permission sistem tak bisa dikurangi" : p.description || p.permission_name}
                        onClick={() => togglePerm(p.permission_code)}
                      >
                        <span className={`${styles.permCheck} ${checked ? styles.permCheckOn : ""}`}>
                          {checked && <Icon name="check" size={12} />}
                        </span>
                        <span className={styles.permBody}>
                          <span className={styles.permName}>{p.permission_name}</span>
                          {p.description && <span className={styles.permDesc}>{p.description}</span>}
                          <span className={styles.permCode}>{p.permission_code}</span>
                        </span>
                        {locked && <Icon name="lock" size={13} className={styles.permLock} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unsaved bar */}
      {dirty && (
        <div className={styles.unsaved}>
          <span className={styles.unsavedDot}>
            <span />
            Perubahan belum disimpan
          </span>
          <span className={styles.spacer} />
          <Button variant="ghost" onClick={goRoles} disabled={saving}>
            Batalkan
          </Button>
          <Button variant="primary" icon={saving ? "loader" : "check"} disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </div>
      )}
    </div>
  );
}

function swatch(tone: string): string {
  if (tone === "blue") return "var(--st-blue)";
  if (tone === "amber") return "var(--st-amber)";
  if (tone === "red") return "var(--st-red)";
  return "var(--st-gray)";
}
