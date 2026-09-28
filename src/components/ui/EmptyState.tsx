import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  badge?: string;
  children?: ReactNode;
}

export function EmptyState({ icon = "boxes", title, description, badge, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.iconWrap}>
        <Icon name={icon} size={26} />
      </span>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.desc}>{description}</div>}
      {badge && <span className={styles.badge}>{badge}</span>}
      {children}
    </div>
  );
}
