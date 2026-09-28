import { useEffect, useState } from "react";
import type { RefObject } from "react";
import Hls from "hls.js";

export type HlsState = "idle" | "loading" | "playing" | "error";

/**
 * Pasang stream HLS ke elemen video saat `enabled`. Melepas & membebaskan
 * resource saat tidak aktif (mis. tile keluar viewport) agar jumlah stream
 * serentak mengikuti kapasitas grid.
 */
export function useHls(videoRef: RefObject<HTMLVideoElement>, url: string | null, enabled: boolean): HlsState {
  const [state, setState] = useState<HlsState>("idle");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !enabled) {
      setState("idle");
      return;
    }

    setState("loading");
    let hls: Hls | null = null;
    let cancelled = false;

    const onPlaying = () => !cancelled && setState("playing");
    const onError = () => !cancelled && setState("error");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setState("error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari — HLS native
      video.src = url;
      video.play().catch(() => undefined);
    } else {
      setState("error");
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      if (hls) {
        hls.destroy();
      } else {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [videoRef, url, enabled]);

  return state;
}
