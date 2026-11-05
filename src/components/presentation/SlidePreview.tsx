import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useSlideThumb } from "./SlideThumbProvider";
import { parsePdfSlide } from "./pdfSlides";
import { loadPdfDocument } from "@/lib/presentationPdf";
import styles from "./SlidePreview.module.css";

/** Jenis skematik ringan (dipakai saat kartu TIDAK dipilih). */
export type ThumbKind = "cover" | "table" | "matrix" | "chart" | "kpi" | "pdf";

interface SlidePreviewProps {
  slideId: string;
  /** URL gambar sampul scope aktif (untuk slide bertipe sampul). */
  coverBg: string | null;
  /** true bila slide bertipe sampul (full-bleed) — buang border kotak. */
  cover?: boolean;
  /** Jenis skematik/placeholder per jenis slide. */
  kind: ThumbKind;
  /** false → sembunyikan teks "Klik untuk preview" (cukup ikon mata, mis. mode compact). */
  hintCaption?: boolean;
}

/**
 * Thumbnail kartu agenda — RINGAN sepenuhnya (tidak pernah merender chart hidup):
 * PDF → `PdfThumb` (gambar resolusi rendah, cache); slide sampul → `CoverThumb`
 * (gambar sampul diperkecil); slide data (grafik/tabel/peta/KPI) → `SnapshotThumb`
 * (gambar hasil rasterisasi sekali via {@link useSlideThumb}, skematik sbg
 * placeholder). Preview nyata dibuka langsung di MODE PRESENTASI (klik thumbnail),
 * bukan lagi di dalam kartu.
 */
export function SlidePreview({ slideId, coverBg, cover, kind, hintCaption = true }: SlidePreviewProps) {
  // PDF selalu tampil nyata (halaman asli), tapi via renderer thumbnail RINGAN
  // (resolusi rendah + cache), bukan PdfPageSlide layar-penuh.
  if (kind === "pdf") {
    const meta = parsePdfSlide(slideId);
    return (
      <div className={`${styles.box}`} aria-hidden="true">
        {meta ? <PdfThumb pdfId={meta.pdfId} page={meta.page} /> : <div className={styles.skeleton} />}
      </div>
    );
  }
  // Semua slide (termasuk SAMPUL): tampilkan thumbnail GAMBAR hasil rasterisasi
  // slide ASLI (sekali, di-cache) — ringan karena hanya <img> statis. Selama belum
  // siap, pakai skematik (untuk sampul = gambar sampul) sebagai placeholder.
  return <SnapshotThumb slideId={slideId} kind={kind} coverBg={coverBg} cover={cover} hintCaption={hintCaption} />;
}

/** Thumbnail berupa gambar hasil rasterisasi slide asli (via SlideThumbProvider);
 *  selama belum siap, tampilkan skematik ringan sebagai placeholder. */
function SnapshotThumb({
  slideId,
  kind,
  coverBg,
  cover,
  hintCaption
}: {
  slideId: string;
  kind: ThumbKind;
  coverBg: string | null;
  cover?: boolean;
  hintCaption: boolean;
}) {
  // Hanya rasterisasi saat kartu TERLIHAT (atau mendekat) → cegah ledakan kerja di
  // awal: kartu di luar layar tak ikut di-generate sampai di-scroll.
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const img = useSlideThumb(slideId, visible);
  return (
    <div ref={boxRef} className={`${styles.box} ${cover ? styles.boxCover : ""}`} aria-hidden="true">
      {img ? (
        <img src={img} alt="" className={styles.snapImg} loading="lazy" decoding="async" draggable={false} />
      ) : (
        <Schematic kind={kind} coverBg={coverBg} />
      )}
      <div className={styles.hint}>
        <Icon name="eye" size={18} />
        {hintCaption && <span className={styles.hintText}>Klik untuk preview</span>}
      </div>
    </div>
  );
}

/** Mock CSS ringan per jenis slide — cukup untuk membedakan jenis tanpa data. */
function Schematic({ kind, coverBg }: { kind: ThumbKind; coverBg: string | null }) {
  if (kind === "cover") {
    return <CoverThumb url={coverBg} />;
  }
  if (kind === "pdf") {
    return (
      <div className={styles.schemPdf}>
        <div className={styles.schemPdfPage}>
          <span className={styles.schemLineW} />
          <span className={styles.schemLine} />
          <span className={styles.schemLine} />
          <span className={styles.schemLineS} />
          <span className={styles.schemPdfTag}>PDF</span>
        </div>
      </div>
    );
  }
  if (kind === "table") {
    return (
      <div className={styles.schemTable}>
        <span className={styles.schemRowHead} />
        <span className={styles.schemRow} />
        <span className={styles.schemRow} />
        <span className={styles.schemRow} />
        <span className={styles.schemRowS} />
      </div>
    );
  }
  if (kind === "matrix") {
    return (
      <div className={styles.schemMatrix}>
        {MATRIX_TINT.map((cls, i) => (
          <span key={i} className={cls} />
        ))}
      </div>
    );
  }
  if (kind === "kpi") {
    return (
      <div className={styles.schemKpi}>
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }
  // chart
  return (
    <div className={styles.schemChart}>
      <span style={{ height: "40%" }} />
      <span style={{ height: "66%" }} />
      <span style={{ height: "50%" }} />
      <span style={{ height: "84%" }} />
      <span style={{ height: "32%" }} />
    </div>
  );
}

/* Cache gambar sampul yang sudah diperkecil (dataURL JPEG) per URL sumber →
   satu kali decode gambar besar, dipakai ulang semua kartu sampul. */
const IMG_THUMB_CACHE = new Map<string, string>();
const COVER_THUMB_WIDTH = 360;

/** Perkecil gambar (blob/URL) ke dataURL JPEG kecil; null bila belum siap/gagal. */
function useDownscaledImage(url: string | null, width = COVER_THUMB_WIDTH): string | null {
  const [out, setOut] = useState<string | null>(() => (url ? IMG_THUMB_CACHE.get(url) ?? null : null));
  useEffect(() => {
    if (!url) {
      setOut(null);
      return;
    }
    const cached = IMG_THUMB_CACHE.get(url);
    if (cached) {
      setOut(cached);
      return;
    }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, width / (img.naturalWidth || width));
        const w = Math.max(1, Math.round((img.naturalWidth || width) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || width) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.7);
        IMG_THUMB_CACHE.set(url, data);
        if (alive) setOut(data);
      } catch {
        // Kanvas ter-taint / gagal → pakai URL asli apa adanya.
        if (alive) setOut(url);
      }
    };
    img.onerror = () => {
      if (alive) setOut(url);
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url, width]);
  return out;
}

/** Thumbnail slide sampul: gambar sampul (diperkecil) bila ada, atau gradien+bar. */
function CoverThumb({ url }: { url: string | null }) {
  const small = useDownscaledImage(url);
  return (
    <div className={styles.schemCover} style={small ? { backgroundImage: `url(${small})` } : undefined}>
      {!url && (
        <>
          <span className={styles.schemCoverBar1} />
          <span className={styles.schemCoverBar2} />
          <span className={styles.schemCoverBar3} />
        </>
      )}
    </div>
  );
}

// Peta risiko 3×3 — pola lampu lalu lintas (hijau/amber/merah).
const MATRIX_TINT = [
  styles.cellGreen, styles.cellAmber, styles.cellRed,
  styles.cellAmber, styles.cellRed, styles.cellGreen,
  styles.cellGreen, styles.cellAmber, styles.cellRed
];

/* Cache thumbnail PDF (dataURL JPEG) per `pdfId:page`, dibagi semua kartu →
   render sekali, dipakai ulang saat scroll/urut/pilih. */
const PDF_THUMB_CACHE = new Map<string, string>();
/** Lebar render thumbnail PDF (px). Sengaja KECIL → kompresi maksimal (thumbnail
    kartu saja; slide PDF layar-penuh tetap resolusi tinggi via PdfPageSlide). */
const PDF_THUMB_WIDTH = 220;
/** Kualitas JPEG thumbnail PDF — rendah agar sangat ringan. */
const PDF_THUMB_QUALITY = 0.5;

/**
 * Preview halaman PDF versi RINGAN untuk thumbnail: render pdf.js pada resolusi
 * rendah, ekspor JPEG kualitas turun, hanya saat kartu terlihat (lazy), dan
 * hasilnya di-cache antar kartu/mount. Jauh lebih murah dari PdfPageSlide.
 */
function PdfThumb({ pdfId, page }: { pdfId: number; page: number }) {
  const key = `${pdfId}:${page}`;
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(() => PDF_THUMB_CACHE.get(key) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (PDF_THUMB_CACHE.has(key)) {
      setUrl(PDF_THUMB_CACHE.get(key) ?? null);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let task: { cancel?: () => void; promise: Promise<unknown> } | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void (async () => {
          try {
            const doc = await loadPdfDocument(pdfId);
            if (!alive) return;
            const pg = await doc.getPage(page);
            if (!alive) return;
            const base = pg.getViewport({ scale: 1 });
            const scale = Math.min(1.5, PDF_THUMB_WIDTH / base.width);
            const viewport = pg.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) throw new Error("no 2d context");
            task = pg.render({ canvasContext: ctx, viewport });
            await task.promise;
            if (!alive) return;
            const dataUrl = canvas.toDataURL("image/jpeg", PDF_THUMB_QUALITY);
            PDF_THUMB_CACHE.set(key, dataUrl);
            if (alive) setUrl(dataUrl);
          } catch {
            if (alive) setFailed(true);
          }
        })();
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
      try {
        task?.cancel?.();
      } catch {
        /* abaikan pembatalan render */
      }
    };
  }, [pdfId, page, key]);

  return (
    <div ref={ref} className={styles.pdfThumb}>
      {url ? (
        <img src={url} alt="" className={styles.pdfThumbImg} loading="lazy" decoding="async" draggable={false} />
      ) : failed ? (
        <div className={styles.pdfThumbState}>
          <Icon name="file-x" size={20} />
        </div>
      ) : (
        <div className={styles.skeleton} />
      )}
    </div>
  );
}
