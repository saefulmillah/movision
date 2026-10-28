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
  "kinerja-regional": { id: "kinerja-regional", feature: "Laba Rugi", title: "Kinerja Keuangan Regional", badge: "Dashboard" },
  "lhr-phr-bp": { id: "lhr-phr-bp", feature: "Pendapatan", title: "Pencapaian LHR & PHR vs Business Plan", badge: "Dashboard" },
  "risk-cover": { id: "risk-cover", feature: "Manajemen Risiko", title: "Manajemen Risiko — Pembuka", badge: "Sampul" },
  "risk-map": { id: "risk-map", feature: "Manajemen Risiko", title: "Peta Risiko & Top Risk", badge: "Peta" },
  "pend-cover": { id: "pend-cover", feature: "Pendapatan", title: "Pendapatan — Pembuka", badge: "Sampul" },
  "pend-overview": { id: "pend-overview", feature: "Pendapatan", title: "KPI & Pencapaian per Ruas", badge: "Dashboard" },
  "sent-cover": { id: "sent-cover", feature: "Sentimen", title: "Analisis Sentimen — Pembuka", badge: "Sampul" },
  "sent-dashboard": { id: "sent-dashboard", feature: "Sentimen", title: "Dashboard Sentimen (drill)", badge: "Dashboard" },
  "odol-cover": { id: "odol-cover", feature: "ODOL", title: "ODOL — Pembuka", badge: "Sampul" },
  "odol-dashboard": { id: "odol-dashboard", feature: "ODOL", title: "Dashboard ODOL", badge: "Dashboard" },
  closing: { id: "closing", feature: "Penutup", title: "Terima Kasih", badge: "Sampul" }
};

export const DEFAULT_ORDER = [
  "title",
  "lr-cover",
  "lr-konsol",
  "lr-regional",
  "lr-ruas",
  "kinerja-regional",
  "lhr-phr-bp",
  "risk-cover",
  "risk-map",
  "pend-cover",
  "pend-overview",
  "sent-cover",
  "sent-dashboard",
  "odol-cover",
  "odol-dashboard",
  "closing"
];

/* Slide yang hanya berlaku pada tingkat scope tertentu. Slide di luar peta ini
   berlaku untuk semua scope. "kinerja-regional" hanya untuk scope regional
   (tidak di divisi/cabang — keputusan user). */
export const SLIDE_SCOPE_ONLY: Record<string, "divisi" | "regional" | "cabang"> = {
  "kinerja-regional": "regional",
  "lhr-phr-bp": "regional"
};

/** Apakah slide `id` boleh tampil pada scope dengan level `level`? */
export function isSlideAllowedForScope(id: string, level?: string | null): boolean {
  const only = SLIDE_SCOPE_ONLY[id];
  return !only || level === only;
}
