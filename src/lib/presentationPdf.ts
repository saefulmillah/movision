/* ============================================================
   Dokumen PDF presentasi — klien API + pemuat pdf.js.
   File di-serve backend lewat endpoint ber-auth; tiap halaman PDF
   ditampilkan sebagai satu slide di presentasi Rapat Direktorat.
   ============================================================ */
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api, BASE_URL, getToken } from "@/lib/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfDoc {
  id: number;
  title: string;
  original_name: string | null;
  page_count: number | null;
  size_bytes: number | null;
  created_at: string;
}

export function listPdfs(): Promise<PdfDoc[]> {
  return api.get<PdfDoc[]>("/presentation-pdf");
}

export function uploadPdf(file: File, title: string, pageCount: number | null): Promise<PdfDoc> {
  const fd = new FormData();
  fd.append("file", file);
  if (title) fd.append("title", title);
  if (pageCount != null) fd.append("page_count", String(pageCount));
  return api.post<PdfDoc>("/presentation-pdf", fd);
}

export function deletePdf(id: number): Promise<unknown> {
  return api.delete(`/presentation-pdf/${id}`);
}

/** Ambil byte PDF (ber-auth) untuk pdf.js. */
async function fetchPdfBytes(id: number): Promise<ArrayBuffer> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/presentation-pdf/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(`Gagal memuat berkas PDF (${res.status})`);
  return res.arrayBuffer();
}

// Cache dokumen pdf.js per id (hindari fetch & parse ulang antar halaman/slide).
const docCache = new Map<number, Promise<PDFDocumentProxy>>();

export function loadPdfDocument(id: number): Promise<PDFDocumentProxy> {
  let p = docCache.get(id);
  if (!p) {
    p = fetchPdfBytes(id).then((buf) => pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise);
    docCache.set(id, p);
  }
  return p;
}

export function clearPdfCache(id?: number): void {
  if (id == null) {
    docCache.clear();
  } else {
    docCache.delete(id);
  }
}

/** Jumlah halaman sebuah file PDF lokal (dihitung sebelum upload). */
export async function countPagesOfFile(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}
