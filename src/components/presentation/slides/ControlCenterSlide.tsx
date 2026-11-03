import type { CSSProperties } from "react";
import styles from "./ControlCenterSlide.module.css";
import presentationLaptop from "@/assets/presentation/presentation-laptop.webp";
import presentationTablet from "@/assets/presentation/presentation-tablet.webp";
import dashboardThumb from "@/assets/presentation/control-center-tablet.webp";
import mobileThumb from "@/assets/presentation/mobile-home.webp";
import mocheckThumb from "@/assets/presentation/app-mocheck.webp";
import mozyThumb from "@/assets/presentation/app-mozy.webp";

/* ============================================================================
   Slide Movision - Presentation (scope divisi) — TEMA TERANG. Peta produk tanpa
   kartu: gambar perangkat tampil mengambang (floating). KIRI = yang sudah
   dibangun (Dashboard & Mobile Apps, nama saja); KANAN = yang disosialisasikan
   hari ini (Movision - Presentation, di-highlight + penjelasan singkat).
   ============================================================================ */

export function ControlCenterSlide() {
  return (
    <div className={styles.slide}>
      <div className={styles.aurora} aria-hidden>
        <span className={`${styles.blob} ${styles.blob1}`} />
        <span className={`${styles.blob} ${styles.blob2}`} />
      </div>

      <header className={styles.head}>
        <span className={styles.kicker}>Sosialisasi Hari Ini · Divisi OPT</span>
        <h1 className={styles.title}>Ekosistem Produk Mozy</h1>
      </header>

      <div className={styles.body}>
        {/* KIRI — sudah dibangun (gambar mengambang, tanpa kartu) */}
        <div className={styles.built}>
          <span className={styles.colLabel}>Sudah Dibangun</span>
          <div className={styles.builtGrid}>
            <div className={styles.builtItem}>
              <img className={styles.builtImg} style={{ ["--bd" as string]: "0s" } as CSSProperties} src={dashboardThumb} alt="Movision Dashboard" />
              <span className={styles.builtName}>Movision Dashboard</span>
            </div>
            <div className={styles.builtItem}>
              <img className={styles.builtImg} style={{ ["--bd" as string]: "0.3s" } as CSSProperties} src={mobileThumb} alt="Movision Mobile Apps" />
              <span className={styles.builtName}>Movision Mobile Apps</span>
            </div>
            <div className={styles.builtItem}>
              <img className={styles.builtImg} style={{ ["--bd" as string]: "0.6s" } as CSSProperties} src={mocheckThumb} alt="MoCheck" />
              <span className={styles.builtName}>MoCheck</span>
            </div>
            <div className={styles.builtItem}>
              <img className={styles.builtImg} style={{ ["--bd" as string]: "0.9s" } as CSSProperties} src={mozyThumb} alt="Mozy" />
              <span className={styles.builtName}>Mozy</span>
            </div>
          </div>
        </div>

        {/* Jembatan */}
        <div className={styles.bridge} aria-hidden>
          <span className={styles.bridgeLabel}>Hari Ini</span>
          <span className={styles.chev} />
          <span className={`${styles.chev} ${styles.chev2}`} />
          <span className={`${styles.chev} ${styles.chev3}`} />
        </div>

        {/* KANAN — disosialisasikan hari ini (highlight, gambar mengambang) */}
        <div className={styles.focus}>
          <span className={styles.focusBadge}><span className={styles.badgeDot} />Disosialisasikan Hari Ini</span>
          <h2 className={styles.focusName}>Movision - Presentation</h2>
          <p className={styles.focusDesc}>
            Satu dek interaktif untuk Rapat Direktorat — menyajikan kinerja keuangan, pendapatan, risiko, dan operasi secara terpadu dalam satu paparan.
          </p>
          <div className={styles.showcase}>
            <span className={styles.glow} />
            <img className={styles.laptop} src={presentationLaptop} alt="Movision - Presentation di laptop" />
            <img className={styles.tablet} src={presentationTablet} alt="Movision - Presentation di tablet" />
          </div>

          <div className={styles.sticky} role="note">
            <span className={styles.stickyTape} aria-hidden />
            <div className={styles.stickyTitle}>Format Paparan Prarakor</div>
            <ol className={styles.stickyList}>
              <li>Pendapatan &amp; Biaya</li>
              <li>Pemeliharaan (PML) — lokasi krusial &amp; program</li>
              <li>Operasional — LHR &amp; kecelakaan</li>
              <li>ITSO — kesiapan sistem</li>
              <li>Manajemen Risiko &amp; evaluasi</li>
              <li>UJL &amp; Rest Area — evaluasi SPM</li>
              <li>Isu Strategis</li>
              <li>Persiapan Nataru</li>
              <li>ODOL</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
