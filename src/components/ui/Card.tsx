import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Card.module.css";

interface CardProps {
  title?: string;
  count?: number | string;
  action?: { label: string; onClick?: () => void; disabled?: boolean };
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({ title, count, action, flush, className, bodyClassName, children }: CardProps) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card}>
      {(title || action) && (
        <div className={styles.header}>
          {title && <span className={styles.title}>{title}</span>}
          {count !== undefined && <span className={styles.count}>{count}</span>}
          {action && (
            <button
              className={styles.headerAction}
              data-disabled={action.disabled ? "true" : undefined}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
              <Icon name="arrow-left" size={14} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
        </div>
      )}
      <div className={bodyClassName ? `${styles.body} ${bodyClassName}` : styles.body} data-flush={flush ? "true" : undefined}>
        {children}
      </div>
    </div>
  );
}
