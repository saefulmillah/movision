/* Util id slide PDF dinamis: "pdf:<pdfId>:<page>" (1-based). */
import type { PdfDoc } from "@/lib/presentationPdf";

export const PDF_SLIDE_PREFIX = "pdf:";

export function makePdfSlideId(pdfId: number, page: number): string {
  return `${PDF_SLIDE_PREFIX}${pdfId}:${page}`;
}

export function isPdfSlide(id: string): boolean {
  return id.startsWith(PDF_SLIDE_PREFIX);
}

export function parsePdfSlide(id: string): { pdfId: number; page: number } | null {
  const m = /^pdf:(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return { pdfId: Number(m[1]), page: Number(m[2]) };
}

/** Buang slide pdf yang tak lagi punya dokumen/halaman valid pada daftar `pdfs`. */
export function prunePdfSlides(order: string[], pdfs: PdfDoc[]): string[] {
  const byId = new Map(pdfs.map((d) => [d.id, d]));
  const next = order.filter((id) => {
    const meta = parsePdfSlide(id);
    if (!meta) return true; // slide statis — biarkan
    const doc = byId.get(meta.pdfId);
    if (!doc) return false;
    if (doc.page_count == null) return true;
    return meta.page >= 1 && meta.page <= doc.page_count;
  });
  // Pertahankan referensi bila tak berubah (hindari re-render tak perlu).
  return next.length === order.length ? order : next;
}

/** Label slide pdf untuk agenda/dots, mis. "Brosur Tol · hal 2/5". */
export function pdfSlideLabel(id: string, pdfs: PdfDoc[]): { title: string; feature: string } | null {
  const meta = parsePdfSlide(id);
  if (!meta) return null;
  const doc = pdfs.find((d) => d.id === meta.pdfId);
  const title = doc?.title || `PDF #${meta.pdfId}`;
  const total = doc?.page_count || null;
  return { title, feature: total ? `Dokumen PDF · hal ${meta.page}/${total}` : `Dokumen PDF · hal ${meta.page}` };
}
