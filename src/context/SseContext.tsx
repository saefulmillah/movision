import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SseClient } from "@/lib/sse";
import type { SseMessage, SseStatus } from "@/lib/sse";
import { useAuth } from "@/context/AuthContext";

interface SseContextValue {
  status: SseStatus;
  /** Berlangganan pesan SSE. Mengembalikan fungsi unsubscribe. */
  subscribe: (handler: (msg: SseMessage) => void) => () => void;
}

const SseContext = createContext<SseContextValue | null>(null);

/** Satu koneksi SSE bersama untuk seluruh aplikasi (handoff §Pengambilan data). */
export function SseProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const clientRef = useRef<SseClient | null>(null);
  const [status, setStatus] = useState<SseStatus>("closed");

  if (!clientRef.current) {
    clientRef.current = new SseClient("/map-events/stream");
  }

  useEffect(() => {
    const client = clientRef.current!;
    const off = client.onStatus(setStatus);
    return off;
  }, []);

  useEffect(() => {
    const client = clientRef.current!;
    if (authStatus === "authenticated") {
      client.start();
    } else {
      client.stop();
    }
    return () => {
      if (authStatus !== "authenticated") client.stop();
    };
  }, [authStatus]);

  const value = useMemo<SseContextValue>(
    () => ({
      status,
      subscribe: (handler) => clientRef.current!.onMessage(handler)
    }),
    [status]
  );

  return <SseContext.Provider value={value}>{children}</SseContext.Provider>;
}

export function useSse(): SseContextValue {
  const ctx = useContext(SseContext);
  if (!ctx) throw new Error("useSse harus dipakai di dalam SseProvider");
  return ctx;
}

/** Hook praktis: berlangganan event SSE tertentu. */
export function useSseEvent(eventName: string | string[], handler: (data: unknown, event: string) => void): void {
  const { subscribe } = useSse();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const names = Array.isArray(eventName) ? eventName : [eventName];
    return subscribe((msg) => {
      if (names.includes(msg.event)) handlerRef.current(msg.data, msg.event);
    });
  }, [subscribe, Array.isArray(eventName) ? eventName.join(",") : eventName]);
}
