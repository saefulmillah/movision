import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useHls } from "@/lib/useHls";
import type { Camera } from "@/types/cctv";
import styles from "./cctv.module.css";

interface CameraTileProps {
  camera: Camera;
  selected?: boolean;
}

function kmOf(cam: Camera): string {
  if (cam.cctv_desc) return cam.cctv_desc;
  const m = cam.cctv_name.match(/km\s*[\d+.]+/i);
  return m ? m[0].toUpperCase() : cam.branch_name || "";
}

export function CameraTile({ camera, selected }: CameraTileProps) {
  const online = Number(camera.is_active) === 1 && !!camera.stream_play_url;
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  // Hanya putar stream saat tile terlihat di viewport (batasi stream serentak).
  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 0.6] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const state = useHls(videoRef, online ? camera.stream_play_url : null, online && visible);
  const km = kmOf(camera);
  const offline = !online || state === "error";

  return (
    <div className={styles.tile} ref={tileRef} data-cam-id={camera.id} data-selected={selected || undefined}>
      {online && <video ref={videoRef} muted playsInline />}

      {!offline && state !== "playing" && (
        <div className={styles.tilePlaceholder}>
          <Icon name="video" size={26} />
        </div>
      )}

      {offline && (
        <div className={styles.offline}>
          <Icon name="video-off" size={26} />
          <span className={styles.offlineLabel}>OFFLINE</span>
        </div>
      )}

      <div className={styles.ovTop}>
        <span className={styles.statusDot} data-off={offline || undefined} />
        <span className={styles.ovName}>{camera.cctv_name}</span>
        {state === "playing" && (
          <span className={styles.live}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        )}
      </div>

      <div className={styles.ovBottom}>
        {km && <span className={styles.ovKm}>{km}</span>}
        <span className={styles.ovStatus}>{offline ? "Offline" : state === "playing" ? "Online" : "Memuat…"}</span>
      </div>
    </div>
  );
}
