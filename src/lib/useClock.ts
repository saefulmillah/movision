import { useEffect, useState } from "react";

/** Jam HH:MM:SS yang diperbarui tiap detik (TopBar, panel mengambang). */
export function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("id-ID", { hour12: false });
}
