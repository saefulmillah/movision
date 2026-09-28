import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTickets } from "@/context/TicketsContext";
import type { SosTicket } from "@/types/monitoring";
import styles from "./dashboard.module.css";

function ticketLabel(t: SosTicket): string {
  return t.status_label || t.incident_type || "SOS";
}

export function SosActiveCard() {
  const navigate = useNavigate();
  const { tickets, openCount, loading } = useTickets();

  return (
    <Card
      title="SOS Aktif"
      count={openCount}
      action={{ label: "Semua", onClick: () => navigate("/sos") }}
      flush
    >
      {loading && tickets.length === 0 ? (
        <div className={styles.list}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.row} style={{ opacity: 0.5 }}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>Memuat…</span>
              </div>
            </div>
          ))}
        </div>
      ) : openCount === 0 ? (
        <EmptyState icon="shield-check" title="Tidak ada SOS aktif" description="Semua insiden telah tertangani." />
      ) : (
        <div className={styles.list}>
          {tickets.map((t, idx) => (
            <div
              key={t.ticket_no ?? idx}
              className={`${styles.row} ${styles.rowClickable}`}
              onClick={() => t.ticket_no && navigate(`/sos?ticket=${encodeURIComponent(t.ticket_no)}`)}
            >
              <div className={styles.rowMain}>
                <span className={styles.ticketNo}>{t.ticket_no}</span>
                <span className={styles.rowTitle}>{ticketLabel(t)}</span>
                <span className={styles.rowSub}>
                  {t.sos?.branch_name && <span>{t.sos.branch_name}</span>}
                  {t.sos?.location && <span>{t.sos.location}</span>}
                </span>
              </div>
              <div className={styles.rowRight}>
                <StatusPill label="SOS" tone="red" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
