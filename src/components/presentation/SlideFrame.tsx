import type { ReactNode } from "react";
import styles from "./SlideFrame.module.css";

/* ============================================================
   Kerangka slide data bersama (Rapat Direktorat): band judul aksen navy
   minimalis → konten mengisi (edge-to-edge) → strip keterangan opsional.
   Dipakai semua slide data agar judul, spacing, dan pemisah keterangan
   SERAGAM. Chrome (header app + navigasi) ada di PresentationOverlay.
   ============================================================ */

interface SlideFrameProps {
  title: ReactNode;
  /** Subjudul di samping judul (mis. "Periode SD September 2026"). */
  subtitle?: ReactNode;
  /** Meta kanan-atas (mis. "RKAP vs Realisasi (dalam juta)"). */
  rightMeta?: ReactNode;
  /** Tag scope aktif (regional/cabang); kosong untuk divisi. */
  scopeLabel?: string | null;
  /** Keterangan/sumber/catatan di bawah konten; disembunyikan bila kosong. */
  footnote?: ReactNode;
  /** Konten tanpa padding dalam (mis. peta/PDF yang mengisi penuh). */
  flush?: boolean;
  /** Fade-up bertahap pada komponen isi (header judul tetap statis). Default true.
   *  Slide yang mengatur stagger-nya sendiri (mis. Sentimen) set false. */
  stagger?: boolean;
  children: ReactNode;
}

export function SlideFrame({ title, subtitle, rightMeta, scopeLabel, footnote, flush, stagger = true, children }: SlideFrameProps) {
  const hasFootnote = footnote !== undefined && footnote !== null && footnote !== false && footnote !== "";
  return (
    <div className={styles.frame}>
      <div className={styles.titleBar}>
        <h1 className={styles.title}>{title}</h1>
        {scopeLabel ? <span className={styles.scopeTag}>{scopeLabel}</span> : null}
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        <span className={styles.spacer} />
        {rightMeta ? <span className={styles.rightMeta}>{rightMeta}</span> : null}
      </div>

      <div className={`${styles.content} pfx-slide ${flush ? styles.flush : ""} ${stagger ? "pfx-stagger" : ""}`}>{children}</div>

      {hasFootnote ? <div className={styles.footnote}>{footnote}</div> : null}
    </div>
  );
}
