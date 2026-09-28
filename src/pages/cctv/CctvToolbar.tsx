import { Button, Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import styles from "./cctv.module.css";

const GRID_TABS: TabItem[] = [
  { value: "2", label: "2×2" },
  { value: "3", label: "3×3" },
  { value: "4", label: "4×4" }
];

interface CctvToolbarProps {
  branchName: string;
  online: number;
  offline: number;
  cols: number;
  onCols: (cols: number) => void;
  onFull: () => void;
}

export function CctvToolbar({ branchName, online, offline, cols, onCols, onFull }: CctvToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.tbBranch}>{branchName}</span>
      <span className={styles.tbCount}>
        <span>
          <b>{online}</b> online
        </span>
        <span className={styles.off}>{offline} offline</span>
      </span>
      <span className={styles.tbSpacer} />
      <Tabs value={String(cols)} onValueChange={(v) => onCols(Number(v))} items={GRID_TABS} />
      <Button variant="secondary" size="sm" icon="maximize" iconOnly onClick={onFull} title="Layar penuh" />
    </div>
  );
}
