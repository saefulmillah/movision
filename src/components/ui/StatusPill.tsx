import styles from "./StatusPill.module.css";

export type PillTone = "green" | "amber" | "red" | "blue" | "gray";

const STATUS_TONE: Record<string, PillTone> = {
  online: "green",
  normal: "green",
  bergerak: "green",
  moving: "green",
  selesai: "green",
  warning: "amber",
  berhenti: "amber",
  stopped: "amber",
  error: "red",
  sos: "red",
  dispatched: "blue",
  offline: "gray",
  nonaktif: "gray",
  unknown: "gray"
};

export function toneForStatus(status: string): PillTone {
  return STATUS_TONE[String(status).toLowerCase()] ?? "gray";
}

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  dot?: boolean;
}

export function StatusPill({ label, tone, dot }: StatusPillProps) {
  const resolved = tone ?? toneForStatus(label);
  return (
    <span className={`${styles.pill} ${styles[resolved]}`}>
      {dot && <span className={styles.dot} />}
      {label}
    </span>
  );
}
