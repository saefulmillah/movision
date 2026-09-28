import { useRef } from "react";
import { Icon } from "./Icon";
import { useHls } from "@/lib/useHls";
import styles from "./HlsVideo.module.css";

interface HlsVideoProps {
  url: string | null;
  /** Mulai memutar (default true). */
  active?: boolean;
  /** Tandai offline eksplisit (mis. is_online=false) tanpa mencoba stream. */
  offline?: boolean;
}

/** Pemutar HLS mandiri (16:9) dengan state memuat / LIVE / offline. */
export function HlsVideo({ url, active = true, offline }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canPlay = !offline && !!url;
  const state = useHls(videoRef, canPlay ? url : null, canPlay && active);
  const isOffline = offline || !url || state === "error";

  return (
    <div className={styles.wrap}>
      {canPlay && <video ref={videoRef} muted playsInline />}

      {state === "playing" && (
        <span className={styles.live}>
          <span className={styles.liveDot} />
          LIVE
        </span>
      )}

      {isOffline ? (
        <div className={styles.center}>
          <Icon name="video-off" size={26} />
          <span className={styles.label}>OFFLINE</span>
        </div>
      ) : (
        state !== "playing" && (
          <div className={styles.center}>
            <Icon name="video" size={26} />
            <span className={styles.label}>MEMUAT…</span>
          </div>
        )
      )}
    </div>
  );
}
