import { FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP } from "@/context/PresentationContext";
import styles from "./FontSizeControl.module.css";

/**
 * Kontrol ukuran font slide berupa slider (100%–{FONT_SCALE_MAX*100}%). Dipakai di
 * header mode presentasi dan di builder. `value` = fontScale aktif dari context,
 * `onChange` dipanggil dengan skala pengali baru (mis. 1.45).
 */
export function FontSizeControl({
  value,
  onChange,
  variant = "overlay"
}: {
  value: number;
  onChange: (v: number) => void;
  variant?: "overlay" | "builder";
}) {
  const pct = Math.round(value * 100);
  return (
    <div
      className={`${styles.wrap} ${variant === "builder" ? styles.builder : styles.overlay}`}
      role="group"
      aria-label="Ukuran teks slide"
    >
      <span className={`${styles.glyph} ${styles.glyphSm}`} aria-hidden="true">A</span>
      <input
        type="range"
        className={styles.range}
        min={FONT_SCALE_MIN}
        max={FONT_SCALE_MAX}
        step={FONT_SCALE_STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Ukuran teks slide"
        aria-valuetext={`${pct}%`}
        title={`Ukuran teks: ${pct}%`}
      />
      <span className={`${styles.glyph} ${styles.glyphLg}`} aria-hidden="true">A</span>
      <span className={styles.value}>{pct}%</span>
    </div>
  );
}
