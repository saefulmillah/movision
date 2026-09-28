import { Icon, StatusPill } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { TICKET_STATUS } from "@/types/sos";
import type { SosTicketDetail } from "@/types/sos";
import styles from "./sos.module.css";

interface WorklistPanelProps {
  tickets: SosTicketDetail[];
  selected: string | null;
  onSelect: (ticketNo: string) => void;
}

function progressText(t: SosTicketDetail): string {
  const rs = t.response_summary;
  if (!rs) return "Menunggu tracking";
  if (rs.arrival_confirmed_at) return "Kedatangan terkonfirmasi";
  if (rs.response_status?.includes("HEADING")) return "Unit menuju lokasi";
  if (rs.primary_vehicle_label) return `Kandidat: ${rs.primary_vehicle_label}`;
  return "Tracking berjalan";
}

export function WorklistPanel({ tickets, selected, onSelect }: WorklistPanelProps) {
  return (
    <aside className={styles.worklist}>
      <div className={styles.worklistHead}>
        <span className={styles.worklistTitle}>Worklist SOS</span>
        <span className={styles.countPill}>{tickets.length}</span>
      </div>
      <div className={styles.worklistBody}>
        {tickets.length === 0 ? (
          <EmptyState icon="shield-check" title="Tidak ada SOS aktif" description="Semua insiden telah tertangani." />
        ) : (
          tickets.map((t) => {
            const status = TICKET_STATUS[t.ticket_status] ?? { label: "SOS", tone: "amber" as const };
            return (
              <div
                key={t.ticket_no}
                className={styles.ticketCard}
                data-selected={selected === t.ticket_no || undefined}
                onClick={() => onSelect(t.ticket_no)}
              >
                <div className={styles.ticketTop}>
                  <span className={styles.ticketNo}>{t.ticket_no}</span>
                  <span style={{ marginLeft: "auto" }}>
                    <StatusPill label={status.label} tone={status.tone} />
                  </span>
                </div>
                <div className={styles.ticketType}>{t.incident_type}</div>
                <div className={styles.ticketMeta}>
                  {t.sos?.branch_name}
                  {t.sos?.location ? ` · ${t.sos.location}` : ""}
                </div>
                <div className={styles.ticketProgress}>
                  <Icon name="activity" size={13} />
                  {progressText(t)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
