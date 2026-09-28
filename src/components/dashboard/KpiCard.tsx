import { Icon } from "@/components/ui/Icon";
import styles from "./KpiCard.module.css";

export type KpiTone = "blue" | "green" | "amber" | "red" | "cyan" | "purple";

interface KpiCardProps {
  label: string;
  icon: string;
  tone: KpiTone;
  value?: number | string;
  total?: number;
  hint?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function KpiCard({ label, icon, tone, value, total, hint, loading, disabled }: KpiCardProps) {
  return (
    <div className={`${styles.kpi} ${styles[tone]}`} data-disabled={disabled ? "true" : undefined}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.iconBox}>
          <Icon name={icon} size={16} />
        </span>
      </div>

      {loading ? (
        <div className={styles.skelValue} />
      ) : (
        <div className={styles.value}>
          {disabled ? "—" : value}
          {!disabled && total !== undefined && <span className={styles.sub}> / {total}</span>}
        </div>
      )}

      {loading ? <div className={styles.skelLine} style={{ width: "70%" }} /> : hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
