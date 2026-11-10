import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SosStrip } from "./SosStrip";
import { useTickets } from "@/context/TicketsContext";
import styles from "./AppShell.module.css";

/**
 * Kerangka aplikasi (handoff §Struktur kerangka):
 *   AppShell [data-theme]
 *   ├── Sidebar (236px ↔ 66px)
 *   └── MainColumn
 *       ├── TopBar (60px)
 *       ├── SosStrip (hanya bila ada tiket terbuka)
 *       └── Content (layar aktif)
 *
 * Pada mode layar penuh (Peta/CCTV) Sidebar, TopBar, dan SosStrip
 * disembunyikan — ditangani oleh masing-masing layar lewat portal/flag,
 * belum diaktifkan pada fase kerangka.
 */
export function AppShell() {
  // Lipat sidebar (mode rail) — hanya berlaku di desktop.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Drawer sidebar untuk layar kecil (off-canvas). Default tertutup.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Jumlah tiket SOS terbuka — satu sumber kebenaran (handoff §State global).
  const { openCount: openTickets } = useTickets();

  // Layar peta & CCTV memenuhi seluruh area (tanpa padding & tanpa scroll).
  const { pathname } = useLocation();
  const fullBleed = pathname === "/peta" || pathname === "/cctv";

  // Tutup drawer mobile setiap kali berpindah halaman.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        openTickets={openTickets}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && <div className={styles.backdrop} onClick={() => setMobileNavOpen(false)} aria-hidden="true" />}
      <div className={styles.main}>
        <TopBar openTickets={openTickets} onMenuClick={() => setMobileNavOpen(true)} />
        {openTickets > 0 && <SosStrip count={openTickets} />}
        <div className={fullBleed ? styles.contentFull : styles.content}>
          <div key={pathname} className="route-fade">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
