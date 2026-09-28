import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTickets } from "@/context/TicketsContext";
import type { SosTicketDetail } from "@/types/sos";
import { WorklistPanel } from "./WorklistPanel";
import { TicketDetail } from "./TicketDetail";
import styles from "./sos.module.css";

export function SosPage() {
  const { tickets: rawTickets, refresh } = useTickets();
  const tickets = rawTickets as unknown as SosTicketDetail[];
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => params.get("ticket"));

  // Default pilih tiket pertama; jaga agar pilihan selalu valid.
  useEffect(() => {
    if (tickets.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((cur) => (cur && tickets.some((t) => t.ticket_no === cur) ? cur : tickets[0].ticket_no));
  }, [tickets]);

  const select = (ticketNo: string) => {
    setSelected(ticketNo);
    setParams((p) => {
      p.set("ticket", ticketNo);
      return p;
    });
  };

  const selectedTicket = useMemo(() => tickets.find((t) => t.ticket_no === selected) ?? null, [tickets, selected]);

  return (
    <div className={styles.page}>
      <WorklistPanel tickets={tickets} selected={selected} onSelect={select} />
      {selectedTicket ? (
        <TicketDetail ticketNo={selectedTicket.ticket_no} onChanged={refresh} />
      ) : (
        <div className={styles.detail}>
          <EmptyState
            icon="siren"
            title="Tidak ada tiket dipilih"
            description="Pilih tiket dari worklist di kiri untuk melihat detail dan Smart Response."
          />
        </div>
      )}
    </div>
  );
}
