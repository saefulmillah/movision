import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import type { MenuNode } from "@/types/api";
import movisionMark from "@/assets/presentation/movision-mark.webp";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  openTickets: number;
}

const STORAGE_KEY = "tollsentra.sidebar.groups";

/** Grup = node yang punya anak. Node lain dirender sebagai item nav tunggal. */
function isGroup(node: MenuNode): boolean {
  return Boolean(node.children && node.children.length > 0);
}

/** Cocokkan pathname dgn route item (sama persis, atau prefix segmen). */
function routeIsActive(pathname: string, route: string | null): boolean {
  if (!route) return false;
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Jumlah badge yang disumbang anak-anak grup (saat ini hanya tiket SOS). */
function groupBadge(node: MenuNode, openTickets: number): number {
  if (openTickets <= 0) return 0;
  return node.children?.some((child) => child.route_path === "/sos") ? openTickets : 0;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

function readStoredGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* localStorage tak tersedia / rusak → mulai kosong */
  }
  return {};
}

export function Sidebar({ open, onToggle, openTickets }: SidebarProps) {
  const { menus, capability, logout } = useAuth();
  const location = useLocation();

  // State buka/tutup per grup (multi-buka), dipersist di localStorage.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(readStoredGroups);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* abaikan bila localStorage diblokir */
    }
  }, [openGroups]);

  // Auto-buka grup yang memuat halaman aktif (tanpa menutup grup lain).
  useEffect(() => {
    const active = menus.find(
      (node) => isGroup(node) && node.children!.some((child) => routeIsActive(location.pathname, child.route_path))
    );
    if (active) {
      setOpenGroups((prev) => (prev[active.menu_code] ? prev : { ...prev, [active.menu_code]: true }));
    }
  }, [location.pathname, menus]);

  const toggleGroup = (code: string) =>
    setOpenGroups((prev) => ({ ...prev, [code]: !prev[code] }));

  const displayName =
    capability?.user.display_name || capability?.user.username || "Pengguna";
  const roleLabel = capability?.roles?.[0] ?? "";

  const renderLeaf = (item: MenuNode, sub: boolean) => {
    const isSos = item.route_path === "/sos";
    const badge = isSos && openTickets > 0 ? openTickets : 0;
    return (
      <NavLink
        key={item.id}
        to={item.route_path as string}
        end={item.route_path === "/"}
        className={({ isActive }) =>
          `${sub ? styles.subItem : styles.navItem} ${isActive ? styles.active : ""}`
        }
        title={item.menu_name}
      >
        <Icon name={item.icon || "circle"} size={sub ? 16 : 19} />
        <span className={styles.navLabel}>{item.menu_name}</span>
        {badge > 0 && <span className={styles.navBadge}>{badge}</span>}
      </NavLink>
    );
  };

  const renderGroup = (node: MenuNode) => {
    const code = node.menu_code;
    const isOpen = Boolean(openGroups[code]);
    const hasActiveChild = node.children!.some((child) => routeIsActive(location.pathname, child.route_path));
    const badge = groupBadge(node, openTickets);

    return (
      <div key={node.id} className={styles.group} data-open={isOpen}>
        <button
          type="button"
          className={`${styles.groupHeader} ${hasActiveChild ? styles.groupActive : ""}`}
          onClick={() => toggleGroup(code)}
          aria-expanded={isOpen}
          title={node.menu_name}
        >
          <Icon name={node.icon || "folder"} size={19} />
          <span className={styles.navLabel}>{node.menu_name}</span>
          {badge > 0 && <span className={`${styles.navBadge} ${styles.groupBadge}`}>{badge}</span>}
          <Icon name="chevron-right" size={16} className={styles.chevron} />
        </button>

        {isOpen && (
          <div className={styles.submenu}>
            {node.children!.map((child) => renderLeaf(child, true))}
          </div>
        )}

        {/* Flyout saat sidebar terlipat: hover ikon grup → daftar submenu. */}
        <div className={styles.flyout} role="menu">
          <span className={styles.flyoutTitle}>{node.menu_name}</span>
          {node.children!.map((child) => renderLeaf(child, true))}
        </div>
      </div>
    );
  };

  return (
    <aside className={`${styles.sidebar} ${open ? "" : styles.collapsed}`} data-collapsed={!open}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} style={{ background: "#fff", overflow: "hidden" }}>
            <img
              src={movisionMark}
              alt="Movision"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Movision</span>
            <span className={styles.brandSub}>Control Center</span>
          </span>
        </div>
        <button className={styles.collapseBtn} onClick={onToggle} title="Lipat menu" aria-label="Lipat menu">
          <Icon name={open ? "panel-left-close" : "panel-left-open"} size={18} />
        </button>
      </div>

      <nav className={styles.nav}>
        {menus.map((node) => (isGroup(node) ? renderGroup(node) : renderLeaf(node, false)))}
      </nav>

      <div className={styles.footer}>
        <span className={styles.avatar}>{initials(displayName)}</span>
        <span className={styles.userInfo}>
          <span className={styles.userName}>{displayName}</span>
          {roleLabel && <span className={styles.userRole}>{roleLabel}</span>}
        </span>
        <button className={styles.logoutBtn} onClick={logout} title="Keluar" aria-label="Keluar">
          <Icon name="log-out" size={17} />
        </button>
      </div>
    </aside>
  );
}
