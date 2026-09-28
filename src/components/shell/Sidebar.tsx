import { NavLink } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import type { MenuNode } from "@/types/api";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  openTickets: number;
}

/** Menu → daftar item nav yang bisa diklik (punya route_path). Kategori tanpa
 *  route ikut menyumbang anak-anaknya. Tidak memfilter ulang (handoff). */
function flattenNav(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const node of nodes) {
    if (node.route_path) out.push(node);
    if (node.children?.length) out.push(...flattenNav(node.children));
  }
  return out;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

export function Sidebar({ open, onToggle, openTickets }: SidebarProps) {
  const { menus, capability, logout } = useAuth();
  const items = flattenNav(menus);

  const displayName =
    capability?.user.display_name || capability?.user.username || "Pengguna";
  const roleLabel = capability?.roles?.[0] ?? "";

  return (
    <aside className={`${styles.sidebar} ${open ? "" : styles.collapsed}`} data-collapsed={!open}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Icon name="radio-tower" size={18} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>TollSentra</span>
            <span className={styles.brandSub}>Control Center</span>
          </span>
        </div>
        <button className={styles.collapseBtn} onClick={onToggle} title="Lipat menu" aria-label="Lipat menu">
          <Icon name={open ? "panel-left-close" : "panel-left-open"} size={18} />
        </button>
      </div>

      <nav className={styles.nav}>
        {items.map((item) => {
          const isSos = item.route_path === "/sos";
          const badge = isSos && openTickets > 0 ? openTickets : 0;
          return (
            <NavLink
              key={item.id}
              to={item.route_path as string}
              end={item.route_path === "/"}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              title={item.menu_name}
            >
              <Icon name={item.icon || "circle"} size={19} />
              <span className={styles.navLabel}>{item.menu_name}</span>
              {badge > 0 && <span className={styles.navBadge}>{badge}</span>}
            </NavLink>
          );
        })}
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
