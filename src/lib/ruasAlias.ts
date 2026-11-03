// ============================================================================
// Kanonikalisasi kode ruas lintas-modul → kode OPERASIONAL (Insights) yang seragam.
// Ruas fisik yang sama dieja beda di tiap modul data (upload): Laba Rugi & Pendapatan
// memakai kode sendiri (mis. BINBRAN / BINTAN) sedangkan modul operasional/Insights
// memakai kode m_ruas (mis. BINSA). Agar penulisan ruas KONSISTEN di semua slide
// presentasi, label tampilan di-kanonikalisasi ke kode operasional lewat helper ini.
// Pasangan alias diverifikasi dari resolveFinancialRuasCode vs m_ruas.kode_ruas
// (lihat cctv-backend/src/constants/financial-ruas.js).
//
// CATATAN: ini hanya untuk TAMPILAN. Kunci pencarian data (code/entity_code) tetap
// memakai kode asli modulnya — jangan pakai hasil fungsi ini untuk lookup data.
// ============================================================================

// kode finansial/pendapatan (ternormalisasi) → kode operasional (m_ruas).
const RUAS_ALIAS: Record<string, string> = {
  "JORR S": "JORRS",
  BENGTABA: "BENGTAB",
  INPRABU: "INDRAPRABU",
  PEKBANGPAR: "PEKBANG",
  BINBRAN: "BINSA",
  BINTAN: "BINSA"
};

/** Kembalikan kode ruas operasional (Insights) yang seragam untuk sebuah kode ruas
 *  dari modul mana pun. Tak dikenal → kembalikan apa adanya (sudah seragam). */
export function toOperationalRuas(code?: string | null): string {
  if (code == null) return "";
  const key = String(code).trim().replace(/\s+/g, " ").toUpperCase();
  return RUAS_ALIAS[key] ?? String(code).trim();
}
