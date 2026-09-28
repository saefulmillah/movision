import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSseEvent } from "@/context/SseContext";
import { usePolling } from "@/lib/usePolling";
import { fetchGateAlerts } from "@/lib/monitoring";
import { formatTime } from "@/lib/format";
import type { GateAlert } from "@/types/monitoring";
import styles from "./dashboard.module.css";

const PROBLEM = new Set(["error", "warning", "offline"]);

function dotClass(status: string): string {
  if (status === "error") return styles.dotError;
  if (status === "warning") return styles.dotWarning;
  return styles.dotOffline;
}

function logCode(gate: GateAlert): string {
  // Kode log ringkas dari device_summary.
  const s = gate.device_summary;
  if (!s) return "";
  if (s.error) return `${s.error} ERROR`;
  if (s.offline) return `${s.offline} OFFLINE`;
  if (s.warning) return `${s.warning} WARNING`;
  return "";
}

export function GateAlertsCard() {
  const { data, loading, error } = usePolling(fetchGateAlerts, 30000);
  const [live, setLive] = useState<GateAlert[] | null>(null);

  // Segarkan dari snapshot SSE.
  useSseEvent("snapshot", (payload) => {
    const p = payload as { gate_alerts?: GateAlert[] };
    if (Array.isArray(p?.gate_alerts)) setLive(p.gate_alerts);
  });

  const gates = live ?? data ?? [];
  const problems = useMemo(
    () => gates.filter((g) => PROBLEM.has(String(g.status).toLowerCase())),
    [gates]
  );

  return (
    <Card title="Peringatan Gerbang Tol" count={problems.length} flush>
      {loading && !data ? (
        <div className={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.row} style={{ opacity: 0.5 }}>
              <span className={`${styles.statusDot} ${styles.dotOffline}`} />
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>Memuat…</span>
              </div>
            </div>
          ))}
        </div>
      ) : error && !data ? (
        <EmptyState icon="info" title="Gagal memuat" description={error} />
      ) : problems.length === 0 ? (
        <EmptyState icon="shield-check" title="Semua gerbang normal" description="Tidak ada gerbang bermasalah pada ruas terpantau." />
      ) : (
        <div className={styles.list}>
          {problems.map((g) => (
            <div key={g.gate_id} className={styles.row}>
              <span className={`${styles.statusDot} ${dotClass(String(g.status).toLowerCase())}`} />
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{g.gate_name}</span>
                <span className={styles.rowSub}>
                  <span>Ruas {g.branch_id}</span>
                  {logCode(g) && <span className={styles.mono}>{logCode(g)}</span>}
                </span>
              </div>
              <div className={styles.rowRight}>
                <StatusPill label={String(g.status).toUpperCase()} tone={toneForStatus(String(g.status))} />
                {g.last_event_at && <span className={styles.rowTime}>{formatTime(g.last_event_at)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
