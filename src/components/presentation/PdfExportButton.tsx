import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { usePresentation } from "@/context/PresentationContext";
import { resolveCoverUrl } from "@/lib/presentationCover";
import { loadPdfDocument } from "@/lib/presentationPdf";
import { SlideView } from "./SlideView";
import { parsePdfSlide } from "./pdfSlides";
import styles from "./PdfExportButton.module.css";

/* Ukuran render tiap slide (16:9). Di-rasterisasi 2× → ~2560×1440 px agar tajam. */
const EXPORT_W = 1280;
const EXPORT_H = 720;
/* Jeda agar layout + animasi masuk chart (Recharts) selesai sebelum di-capture. */
const SETTLE_MS = 1600;
/* Batas tunggu snapshot data siap. */
const SNAPSHOT_TIMEOUT_MS = 15000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Bersihkan string jadi nama berkas yang aman. */
function safeName(s: string): string {
  return (s || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ExportJob {
  ids: string[];
  coverBg: string | null;
  fileName: string;
}

/**
 * Tombol "Export PDF" (ikon saja) + mesin ekspor. Tiap slide aktif dirender di
 * panggung luar-layar (memakai {@link SlideView} — sumber kebenaran yang sama
 * dengan mode presentasi) lalu dirasterisasi ke gambar dan disusun jadi PDF
 * landscape 16:9, satu slide per halaman. Halaman PDF hasil upload diambil
 * langsung resolusi tinggi via pdf.js (lebih tajam daripada men-screenshot DOM).
 *
 * Memakai rasterisasi berbasis SVG foreignObject (modern-screenshot) agar CSS
 * modern yang dipakai slide — `color-mix()`, `backdrop-filter`, SVG Recharts —
 * ikut apa adanya (html2canvas tidak mendukungnya).
 */
export function PdfExportButton({ className }: { className?: string }) {
  const p = usePresentation();
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Cermin snapshot terkini agar loop tunggu tak kena stale closure.
  const snapRef = useRef(p.snapshot);
  snapRef.current = p.snapshot;

  const beginExport = useCallback(async () => {
    if (busy) return;
    const ids = p.activeSlides;
    if (!ids.length) return;
    setBusy(true);
    try {
      // Pastikan snapshot periode×scope aktif termuat, lalu tunggu siap.
      p.ensureSnapshot();
      const t0 = Date.now();
      while (
        (snapRef.current.loading || !snapRef.current.data) &&
        Date.now() - t0 < SNAPSHOT_TIMEOUT_MS
      ) {
        await sleep(150);
      }
      const coverBg = await resolveCoverUrl(p.scope?.key ?? "divisi").catch(() => null);
      const scopeTag = p.scope && p.scope.level !== "divisi" ? p.scope.label : "";
      const fileName = `${safeName(
        [p.meetingTitle || "Rapat Direktorat", scopeTag, p.periodLabel].filter(Boolean).join(" ")
      ) || "Presentasi"}.pdf`;
      nodeRefs.current.clear();
      // Mount panggung luar-layar → effect [job] menjalankan capture.
      setJob({ ids, coverBg, fileName });
    } catch {
      setBusy(false);
    }
  }, [busy, p]);

  // Jalankan capture setelah slide luar-layar ter-render (dipicu oleh `job`).
  useEffect(() => {
    if (!job) return;
    let alive = true;
    (async () => {
      try {
        await sleep(SETTLE_MS);
        if (!alive) return;
        const [{ jsPDF }, { domToPng }] = await Promise.all([import("jspdf"), import("modern-screenshot")]);
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [EXPORT_W, EXPORT_H] });
        let added = 0;
        for (const id of job.ids) {
          if (!alive) return;
          const pdfMeta = parsePdfSlide(id);

          if (pdfMeta) {
            // Halaman PDF asli: render langsung resolusi tinggi via pdf.js,
            // letterbox (contain) ke kanvas 16:9 agar rasio tak melar.
            const img = await renderPdfPage(pdfMeta.pdfId, pdfMeta.page).catch(() => null);
            if (added > 0) pdf.addPage([EXPORT_W, EXPORT_H], "landscape");
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, EXPORT_W, EXPORT_H, "F");
            if (img) {
              const fit = contain(img.w, img.h, EXPORT_W, EXPORT_H);
              pdf.addImage(img.data, "JPEG", fit.x, fit.y, fit.w, fit.h, undefined, "FAST");
            }
            added += 1;
          } else {
            const node = nodeRefs.current.get(id);
            if (!node) continue;
            const data = await domToPng(node, { scale: 2 }).catch(() => null);
            if (!data) continue;
            if (added > 0) pdf.addPage([EXPORT_W, EXPORT_H], "landscape");
            pdf.addImage(data, "PNG", 0, 0, EXPORT_W, EXPORT_H, undefined, "FAST");
            added += 1;
          }
        }
        if (alive && added > 0) pdf.save(job.fileName);
      } finally {
        if (alive) {
          setJob(null);
          setBusy(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  return (
    <>
      <Button
        variant="secondary"
        iconOnly
        icon={busy ? "loader" : "download"}
        onClick={() => void beginExport()}
        disabled={busy || !p.activeSlides.length}
        className={className}
        title={busy ? "Menyiapkan PDF…" : "Export PDF"}
        aria-label="Export PDF"
      />
      {job && (
        <div className={styles.exportHost} aria-hidden="true">
          {job.ids
            .filter((id) => !parsePdfSlide(id))
            .map((id) => (
              <div
                key={id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(id, el);
                }}
                className={styles.capture}
              >
                <SlideView slideId={id} coverBg={job.coverBg} />
              </div>
            ))}
        </div>
      )}
    </>
  );
}

/** Render satu halaman PDF ke dataURL JPEG resolusi tinggi + dimensi aslinya. */
async function renderPdfPage(
  pdfId: number,
  page: number
): Promise<{ data: string; w: number; h: number }> {
  const doc = await loadPdfDocument(pdfId);
  const pg = await doc.getPage(page);
  const base = pg.getViewport({ scale: 1 });
  // Target ~2× lebar halaman ekspor agar tajam saat dicetak.
  const scale = Math.min(3, (EXPORT_W * 2) / base.width);
  const viewport = pg.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pg.render({ canvasContext: ctx, viewport }).promise;
  return { data: canvas.toDataURL("image/jpeg", 0.92), w: canvas.width, h: canvas.height };
}

/** Hitung penempatan gambar agar "contain" (center, jaga rasio) di kotak w×h. */
function contain(iw: number, ih: number, bw: number, bh: number) {
  const s = Math.min(bw / iw, bh / ih);
  const w = iw * s;
  const h = ih * s;
  return { w, h, x: (bw - w) / 2, y: (bh - h) / 2 };
}
