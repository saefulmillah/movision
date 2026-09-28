import { useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { BranchPicker } from "./BranchPicker";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useSse } from "@/context/SseContext";
import { useClock } from "@/lib/useClock";
import type { MenuNode } from "@/types/api";
import styles from "./TopBar.module.css";

interface TopBarProps {
  openTickets: number;
}

function findMenuName(nodes: MenuNode[], pathname: string): string | null {
  for (const node of nodes) {
    if (node.route_path && node.route_path === pathname) return node.menu_name;
    if (node.children?.length) {
      const inner = findMenuName(node.children, pathname);
      if (inner) return inner;
    }
  }
  return null;
}

export function TopBar({ openTickets }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { menus } = useAuth();
  const { status: sseStatus } = useSse();
  const location = useLocation();
  const clock = useClock();

  const title = findMenuName(menus, location.pathname) || "TollSentra";

  const sseConnected = sseStatus === "open";
  const sseLabel = sseStatus === "open" ? "Realtime" : sseStatus === "connecting" ? "Menyambung…" : "Terputus";

  return (
    <header className={styles.topbar}>
      <span className={styles.title}>{title}</span>

      <BranchPicker />

      <span className={styles.spacer} />

      <span className={styles.sse} data-status={sseConnected ? "online" : "offline"}>
        <span className={styles.sseDot} />
        {sseLabel}
      </span>

      <span className={styles.sep} />

      <span className={styles.clock}>{clock}</span>

      <button
        className={styles.iconBtn}
        onClick={toggleTheme}
        title={theme === "dark" ? "Tema terang" : "Tema gelap"}
        aria-label="Ganti tema"
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
      </button>

      <button className={styles.iconBtn} title="Notifikasi" aria-label="Notifikasi" type="button">
        <Icon name="bell" size={17} />
        {openTickets > 0 && <span className={styles.notifBadge}>{openTickets}</span>}
      </button>
    </header>
  );
}
