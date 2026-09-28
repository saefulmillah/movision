import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { CameraTile } from "./CameraTile";
import type { Camera } from "@/types/cctv";
import styles from "./cctv.module.css";

interface CameraGridProps {
  cameras: Camera[];
  cols: number;
  /** Mode layar penuh hanya menampilkan n² tile. */
  full: boolean;
  selectedId: number | null;
}

export function CameraGrid({ cameras, cols, full, selectedId }: CameraGridProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Daftar sudah dipotong per halaman oleh induk (fullscreen) atau penuh (normal).
  const shown = cameras;

  // Gulir ke tile terpilih (dari daftar) pada mode normal.
  useEffect(() => {
    if (full || selectedId == null) return;
    const el = wrapRef.current?.querySelector(`[data-cam-id="${selectedId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId, full]);

  return (
    <div className={styles.gridWrap} ref={wrapRef}>
      <div className={styles.grid} style={{ "--cols": cols } as CSSProperties}>
        {shown.map((cam) => (
          <CameraTile key={cam.id} camera={cam} selected={selectedId === cam.id} />
        ))}
      </div>
    </div>
  );
}
