import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui";
import { loadPdfDocument } from "@/lib/presentationPdf";
import styles from "./PdfPageSlide.module.css";

interface PdfPageSlideProps {
  pdfId: number;
  page: number;
}

/** Render satu halaman PDF ke canvas, diskalakan agar pas di panggung slide. */
export function PdfPageSlide({ pdfId, page }: PdfPageSlideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    let task: { cancel?: () => void; promise: Promise<unknown> } | null = null;
    setState("loading");

    (async () => {
      try {
        const doc = await loadPdfDocument(pdfId);
        if (!alive) return;
        const pg = await doc.getPage(page);
        if (!alive) return;

        const base = pg.getViewport({ scale: 1 });
        // Render pada resolusi cukup tinggi lalu diskalakan via CSS (object-fit).
        const scale = Math.min(3, Math.max(1, 1600 / base.width));
        const viewport = pg.getViewport({ scale });

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        task = pg.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (!alive) return;
        setState("ready");
      } catch {
        if (alive) setState("error");
      }
    })();

    return () => {
      alive = false;
      try {
        task?.cancel?.();
      } catch {
        /* abaikan pembatalan render */
      }
    };
  }, [pdfId, page]);

  return (
    <div className={styles.wrap}>
      {state === "error" && (
        <EmptyState icon="file-x" title="Gagal memuat PDF" description="Dokumen tidak dapat ditampilkan." />
      )}
      {state === "loading" && <EmptyState icon="loader" title="Memuat halaman PDF…" />}
      <canvas ref={canvasRef} className={styles.canvas} style={{ display: state === "ready" ? "block" : "none" }} />
    </div>
  );
}
