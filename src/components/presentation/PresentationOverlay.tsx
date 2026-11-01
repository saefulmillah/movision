import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES } from "./slideRegistry";
import { pdfSlideLabel } from "./pdfSlides";
import { SlideView, isCoverSlide } from "./SlideView";
import { resolveCoverUrl } from "@/lib/presentationCover";
import brandLogos from "@/assets/presentation/brand-logos.png";
import movisionMark from "@/assets/presentation/movision-mark.webp";
import "@/styles/presentation-anim.css";
import styles from "./PresentationOverlay.module.css";

export function PresentationOverlay() {
  const p = usePresentation();
  const rootRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  // Gambar sampul pembuka per scope aktif (null → foto bawaan).
  const [coverBg, setCoverBg] = useState<string | null>(null);

  const total = p.activeSlides.length;
  const cur = Math.min(p.cur, Math.max(0, total - 1));
  const key = p.activeSlides[cur] || "title";
  const isCover = isCoverSlide(key);

  // Aksi stabil (useCallback di context) — dipakai di efek tanpa memicu re-run tiap render.
  const { mode, auto, autoSec, next, prev, exit: ctxExit } = p;

  // Navigasi keyboard.
  useEffect(() => {
    if (mode !== "present") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next(false);
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen?.();
        ctxExit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, next, prev, ctxExit]);

  // Auto-advance — restart tiap ganti slide / ubah setelan.
  useEffect(() => {
    if (mode !== "present" || !auto || total === 0) return;
    const t = setInterval(() => next(true), autoSec * 1000);
    return () => clearInterval(t);
  }, [mode, auto, autoSec, cur, total, next]);

  // Tutup dropdown periode saat klik di luar (berbasis ref, mousedown — agar opsi tetap terpilih).
  useEffect(() => {
    if (!periodOpen) return;
    const onDown = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [periodOpen]);

  // Muat gambar sampul scope aktif saat masuk mode present / ganti scope.
  useEffect(() => {
    if (p.mode !== "present") return;
    let alive = true;
    resolveCoverUrl(p.scope?.key ?? "divisi")
      .then((url) => alive && setCoverBg(url))
      .catch(() => alive && setCoverBg(null));
    return () => {
      alive = false;
    };
  }, [p.mode, p.scope?.key]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    ctxExit();
  }, [ctxExit]);

  if (p.mode !== "present") return null;

  // Slide dirender oleh SlideView (dipakai bersama preview thumbnail builder).
  const renderSlide = () => <SlideView slideId={key} coverBg={coverBg} />;

  // Label slide untuk dots (override judul builder → judul statis → label PDF).
  const dotLabel = (id: string): string =>
    p.titles[id] || SLIDES[id]?.title || pdfSlideLabel(id, p.pdfs)?.title || id;

  return (
    <div className={styles.overlay} ref={rootRef}>
      <header className={styles.header}>
        <span className={styles.mark}>
          <img src={movisionMark} alt="Movision" />
        </span>
        <span className={styles.brand}>Rapat Direktorat</span>
        <span className={styles.sep} />
        <div className={styles.periodWrap} ref={periodRef}>
          <button
            className={styles.periodBtn}
            onClick={() => setPeriodOpen((v) => !v)}
            title="Ganti periode"
          >
            <Icon name="calendar" size={14} />
            {p.periodLabel}
            <Icon name="chevron-down" size={13} />
          </button>
          {periodOpen && (
            <div className={styles.periodMenu}>
              {p.periods.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.periodOpt} ${opt.key === p.period ? styles.periodOptActive : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.setPeriod(opt.key);
                    setPeriodOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.spacer} />
        <span className={styles.pageLabel}>
          {cur + 1} / {total}
        </span>
        <button className={styles.iconBtn} onClick={toggleFullscreen} title="Layar penuh" aria-label="Layar penuh">
          <Icon name="maximize" size={16} />
        </button>
        <button className={styles.exitBtn} onClick={exit} title="Keluar (Esc)">
          <Icon name="x" size={15} />
          Keluar
        </button>
      </header>

      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${total ? ((cur + 1) / total) * 100 : 0}%` }} />
      </div>

      {isCover ? (
        <div className={`${styles.stageWrap} ${styles.stageWrapCover}`}>
          <div key={key} className={`${styles.stage} ${styles.stageCover}`}>{renderSlide()}</div>
        </div>
      ) : (
        <div key={key} className={`${styles.stageWrap} ${styles.stageData}`}>{renderSlide()}</div>
      )}

      <footer className={styles.footer}>
        <button className={styles.navBtn} onClick={p.prev} title="Sebelumnya (◄)" aria-label="Sebelumnya">
          <Icon name="chevron-left" size={18} />
        </button>
        <div className={styles.dots}>
          {p.activeSlides.map((id, i) => (
            <button
              key={id}
              className={`${styles.dot} ${i === cur ? styles.dotActive : ""}`}
              onClick={() => p.goto(i)}
              title={dotLabel(id)}
              aria-label={dotLabel(id)}
            />
          ))}
        </div>
        <button className={styles.navBtn} onClick={() => p.next(false)} title="Berikutnya (►)" aria-label="Berikutnya">
          <Icon name="chevron-right" size={18} />
        </button>
        <span className={styles.footSep} />
        <button
          className={`${styles.autoBtn} ${p.auto ? styles.autoBtnOn : ""}`}
          onClick={p.toggleAuto}
          title="Putar otomatis"
        >
          <Icon name={p.auto ? "pause" : "play"} size={15} />
          {p.auto ? `Auto · ${p.autoSec}s` : "Putar otomatis"}
        </button>
        <div className={styles.brandLogo} aria-hidden="true">
          <img src={brandLogos} alt="Danantara Indonesia · Hutama Karya" />
        </div>
      </footer>
    </div>
  );
}
