/* Registry slide presentasi — satu entri per slide. Menambah slide fitur baru
   cukup menambah entri di sini + penanganan render di PresentationOverlay. */

export interface SlideDef {
  id: string;
  feature: string;
  title: string;
  badge: string;
}

export const SLIDES: Record<string, SlideDef> = {
  title: { id: "title", feature: "Pembuka", title: "Rapat Direktorat", badge: "Sampul" },
  "lr-cover": { id: "lr-cover", feature: "Laba Rugi", title: "Laba Rugi — Pembuka", badge: "Sampul" },
  "lr-konsol": { id: "lr-konsol", feature: "Laba Rugi", title: "Konsolidasi", badge: "Tabel" },
  "lr-regional": { id: "lr-regional", feature: "Laba Rugi", title: "Per Regional", badge: "Tabel" },
  "lr-ruas": { id: "lr-ruas", feature: "Laba Rugi", title: "Per Ruas", badge: "Tabel" },
  "risk-cover": { id: "risk-cover", feature: "Manajemen Risiko", title: "Manajemen Risiko — Pembuka", badge: "Sampul" },
  "risk-map": { id: "risk-map", feature: "Manajemen Risiko", title: "Peta Risiko & Top Risk", badge: "Peta" },
  "pend-cover": { id: "pend-cover", feature: "Pendapatan", title: "Pendapatan — Pembuka", badge: "Sampul" },
  "pend-overview": { id: "pend-overview", feature: "Pendapatan", title: "KPI & Pencapaian per Ruas", badge: "Dashboard" },
  closing: { id: "closing", feature: "Penutup", title: "Terima Kasih", badge: "Sampul" }
};

export const DEFAULT_ORDER = [
  "title",
  "lr-cover",
  "lr-konsol",
  "lr-regional",
  "lr-ruas",
  "risk-cover",
  "risk-map",
  "pend-cover",
  "pend-overview",
  "closing"
];
