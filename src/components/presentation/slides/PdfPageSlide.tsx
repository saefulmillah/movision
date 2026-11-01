import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { loadPdfDocument } from "@/lib/presentationPdf";
import styles from "./PdfPageSlide.module.css";

interface PdfPageSlideProps {
  pdfId: number;
  page: number;
}

const Z_MIN = 1;
const Z_MAX = 3;
const Z_STEP = 0.25;

/** Render satu halaman PDF ke canvas + kontrol zoom in/out (pan via scroll). */
export function PdfPageSlide({ pdfId, page }: PdfPageSlideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset zoom tiap ganti halaman/slide.
  useEffect(() => {
    setZoom(1);
  }, [pdfId, page]);

  // Pantau status fullscreen: fullscreen → isi 100%; jendela → pas layar proporsional.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

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
        // Resolusi tinggi agar tetap tajam saat di-zoom (sampai ~2x).
        const scale = Math.min(4, Math.max(1, 2200 / base.width));
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

  const zoomBy = (d: number) =>
    setZoom((z) => Math.min(Z_MAX, Math.max(Z_MIN, Math.round((z + d) * 100) / 100)));

  return (
    <div className={styles.wrap}>
      <div className={styles.viewport} style={{ display: state === "ready" ? "flex" : "none" }}>
        <canvas
          ref={canvasRef}
          className={`${styles.canvas} ${isFullscreen ? styles.fill : styles.fit} ${state === "ready" ? "pfx-fade-up" : ""}`}
          style={
            isFullscreen
              ? { width: `${zoom * 100}%`, height: `${zoom * 100}%` }
              : { maxWidth: `${zoom * 100}%`, maxHeight: `${zoom * 100}%` }
          }
        />
      </div>

      {state === "loading" && (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat halaman PDF…" />
        </div>
      )}
      {state === "error" && (
        <div className={styles.stateBox}>
          <EmptyState icon="file-x" title="Gagal memuat PDF" description="Dokumen tidak dapat ditampilkan." />
        </div>
      )}

      {state === "ready" && (
        <div className={styles.zoomBar}>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={() => zoomBy(-Z_STEP)}
            disabled={zoom <= Z_MIN}
            aria-label="Perkecil"
            title="Perkecil"
          >
            <Icon name="zoom-out" size={16} />
          </button>
          <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={() => zoomBy(Z_STEP)}
            disabled={zoom >= Z_MAX}
            aria-label="Perbesar"
            title="Perbesar"
          >
            <Icon name="zoom-in" size={16} />
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            aria-label="Pas layar"
            title="Pas layar"
          >
            <Icon name="maximize" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
