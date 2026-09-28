import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSse } from "@/context/SseContext";
import { fetchOpenSosTickets } from "@/lib/monitoring";
import type { SosTicket } from "@/types/monitoring";

interface TicketsContextValue {
  tickets: SosTicket[];
  openCount: number;
  loading: boolean;
  refresh: () => void;
}

const TicketsContext = createContext<TicketsContextValue | null>(null);

/**
 * Sumber tunggal tiket SOS terbuka (handoff §State global): dibaca oleh badge
 * sidebar, badge notifikasi TopBar, SosStrip, KPI & kartu SOS Dashboard, dan
 * badge layer SOS pada peta. Semua penghitung wajib identik.
 */
export function TicketsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const { subscribe } = useSse();
  const [tickets, setTickets] = useState<SosTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchOpenSosTickets();
      if (mounted.current) setTickets(Array.isArray(rows) ? rows : []);
    } catch {
      /* pertahankan data lama saat gagal */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (authStatus !== "authenticated") {
      setTickets([]);
      setLoading(false);
      return () => {
        mounted.current = false;
      };
    }

    void refresh();
    // Polling fallback bila SSE terputus.
    const id = window.setInterval(refresh, 30000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [authStatus, refresh]);

  // Realtime: snapshot boleh membawa daftar tiket; event sos-* memicu refetch.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    return subscribe((msg) => {
      if (msg.event === "snapshot") {
        const p = msg.data as { sos_tickets?: SosTicket[]; sos?: SosTicket[] };
        const next = p?.sos_tickets ?? p?.sos;
        if (Array.isArray(next)) setTickets(next);
      } else if (msg.event.startsWith("sos") || msg.event.startsWith("alert")) {
        void refresh();
      }
    });
  }, [authStatus, subscribe, refresh]);

  // Hitung hanya tiket yang benar-benar terbuka (status belum selesai).
  const openTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const st = String(t.status ?? "").toLowerCase();
        return st !== "selesai" && st !== "closed" && st !== "done" && t.status !== 2;
      }),
    [tickets]
  );

  const value = useMemo<TicketsContextValue>(
    () => ({ tickets: openTickets, openCount: openTickets.length, loading, refresh }),
    [openTickets, loading, refresh]
  );

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets(): TicketsContextValue {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets harus dipakai di dalam TicketsProvider");
  return ctx;
}
