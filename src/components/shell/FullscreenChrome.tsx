import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useSse } from "@/context/SseContext";
import { useClock } from "@/lib/useClock";
import styles from "./FullscreenChrome.module.css";

interface EdgeTabProps {
  label: string;
  open: boolean;
  dim?: boolean;
  onClick: () => void;
}

/** Tab vertikal di tepi kiri (LAYER / KAMERA) mode layar penuh. */
export function EdgeTab({ label, open, dim, onClick }: EdgeTabProps) {
  return (
    <button className={styles.edgeTab} data-open={open || undefined} data-dim={dim || undefined} onClick={onClick}>
      {label}
    </button>
  );
}

interface FloatingToolbarProps {
  dim?: boolean;
  /** Elemen tambahan sebelum tombol keluar (mis. pemilih grid). */
  children?: ReactNode;
  onExit: () => void;
}

/** Panel mengambang kanan atas: status SSE, jam, slot ekstra, tombol keluar. */
export function FloatingToolbar({ dim, children, onExit }: FloatingToolbarProps) {
  const { status } = useSse();
  const clock = useClock();
  return (
    <div className={styles.floatingToolbar} data-dim={dim || undefined}>
      <span className={styles.item}>
        <span className={styles.dot} data-off={status !== "open" || undefined} />
        {status === "open" ? "Realtime" : "Terputus"}
      </span>
      <span className={styles.sep} />
      <span className={styles.item}>{clock}</span>
      {children && (
        <>
          <span className={styles.sep} />
          {children}
        </>
      )}
      <span className={styles.sep} />
      <button className={styles.exitBtn} onClick={onExit} title="Keluar layar penuh" aria-label="Keluar layar penuh">
        <Icon name="minimize" size={16} />
      </button>
    </div>
  );
}
