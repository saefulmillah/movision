import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePresentation } from "@/context/PresentationContext";
import { resolveCoverUrl } from "@/lib/presentationCover";
import { SlideView } from "./SlideView";
import styles from "./SlideThumbProvider.module.css";

/* ============================================================================
   Provider thumbnail slide: merasterisasi slide DATA (grafik/tabel/peta/KPI) jadi
   GAMBAR kecil satu kali, lalu menyajikannya sebagai <img> statis di kartu agenda
   & grid navigasi. Tujuan: thumbnail menampilkan isi slide SEBENARNYA tanpa
   membebani — karena yang ditampilkan hanya gambar (bukan puluhan chart Recharts
   hidup sekaligus).

   Mekanisme (meniru ekspor PDF): SlideView dirender di panggung luar-layar →
   tunggu layout + animasi chart selesai → `modern-screenshot` domToJpeg (diperkecil
   via `scale`, kualitas sedang) → cache. HANYA SATU slide dirasterisasi pada satu
   waktu (antrean) agar beban terbatas; hasil di-cache level modul (bertahan lintas
   remount/route). Kunci cache menyertakan scope×periode → otomatis kedaluwarsa saat
   ganti lingkup/periode.
   ============================================================================ */

// Target ~1280×720 × SCALE. 0.34 → ~435×245 px (cukup tajam untuk kartu, sangat ringan).
const THUMB_SCALE = 0.34;
const THUMB_QUALITY = 0.6;
// Jeda agar layout + animasi masuk chart (Recharts) selesai sebelum di-capture.
const SETTLE_MS = 1200;
// Batas tunggu data snapshot siap.
const SNAPSHOT_TIMEOUT_MS = 12000;

// Cache + pub/sub level modul (bertahan lintas remount).
const cache = new Map<string, string>();
// Key yang sudah tuntas (sukses/gagal) — jangan diulang (level modul agar bisa di-reset).
const done = new Set<string>();
const listeners = new Set<() => void>();
function emitThumbs() {
  listeners.forEach((l) => l());
}

// --- Persistensi ke localStorage: thumbnail dibuat SEKALI lalu dipakai ulang lintas
//     reload (hemat kinerja — tak merasterisasi ulang tiap buka builder). Dibatasi
//     jumlahnya & disimpan debounce agar tak memberatkan. ---
const LS_KEY = "tollsentra.presentation.thumbs";
const MAX_PERSIST = 80;
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const k of Object.keys(obj)) if (typeof obj[k] === "string") cache.set(k, obj[k]);
  }
} catch {
  /* abaikan — mulai dari cache kosong */
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const slice = [...cache.entries()].slice(-MAX_PERSIST); // Map jaga urutan sisip → ambil terbaru
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(slice)));
    } catch {
      /* kuota penuh/ditolak → abaikan (cache memori tetap jalan) */
    }
  }, 1500);
}

/** Buang semua thumbnail ter-cache (mis. setelah ganti/hapus gambar sampul) agar
 *  dirasterisasi ulang. Komponen yang berlangganan akan minta ulang otomatis. */
export function invalidateSlideThumbs(): void {
  cache.clear();
  done.clear();
  persistSoon();
  emitThumbs();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Jalankan saat browser idle (jaga app responsif selama rasterisasi). Fallback timer.
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof ric === "function") ric(() => resolve(), { timeout: 1000 });
    else setTimeout(resolve, 200);
  });
}

interface ThumbCtx {
  request: (id: string, key: string) => void;
}
const Ctx = createContext<ThumbCtx | null>(null);

/** Kunci cache: slide × scope × periode. SENGAJA tidak menyertakan judul/subjudul
 *  atau isi data — thumbnail tak perlu ikut berubah tiap slide diubah (keputusan
 *  user; hemat kinerja). Refresh gambar sampul ditangani `invalidateSlideThumbs`. */
function thumbKey(slideId: string, scopeKey: string, period: string): string {
  return `${slideId}::${scopeKey}::${period}`;
}

/**
 * Thumbnail gambar sebuah slide (null bila belum dirasterisasi). Saat `active`
 * (mis. kartu sudah terlihat), memicu antrean rasterisasi bila belum ada; selalu
 * mengembalikan hasil cache yang ada + re-render saat hasilnya siap.
 */
export function useSlideThumb(slideId: string, active = true): string | null {
  const ctx = useContext(Ctx);
  const p = usePresentation();
  const key = thumbKey(slideId, p.scope?.key ?? "divisi", p.period);

  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (active && !cache.has(key) && ctx) ctx.request(slideId, key);
  }, [active, key, ctx, slideId]);

  return cache.get(key) ?? null;
}

export function SlideThumbProvider({ children }: { children: ReactNode }) {
  const p = usePresentation();
  const scopeKey = p.scope?.key ?? "divisi";
  const period = p.period;

  const queueRef = useRef<{ id: string; key: string }[]>([]);
  const inflightRef = useRef<string | null>(null); // key yang sedang dirasterisasi
  const [current, setCurrent] = useState<{ id: string; key: string } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Gambar sampul scope aktif → agar thumbnail slide SAMPUL = slide asli (latar + teks).
  const [coverBg, setCoverBg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveCoverUrl(scopeKey)
      .then((url) => {
        if (alive) setCoverBg(url);
      })
      .catch(() => {
        if (alive) setCoverBg(null);
      });
    return () => {
      alive = false;
    };
  }, [scopeKey]);

  // Cermin snapshot & current agar async/closure tak stale.
  const snapRef = useRef(p.snapshot);
  snapRef.current = p.snapshot;
  const currentRef = useRef<{ id: string; key: string } | null>(null);
  currentRef.current = current;

  const pump = useCallback(() => {
    if (inflightRef.current) return; // sedang/akan kapتur (penanda SINKRON → cegah tumpang-tindih)
    const next = queueRef.current.shift();
    if (!next) return;
    inflightRef.current = next.key;
    setCurrent(next);
  }, []);

  const request = useCallback(
    (id: string, key: string) => {
      if (
        cache.has(key) ||
        done.has(key) ||
        inflightRef.current === key ||
        currentRef.current?.key === key ||
        queueRef.current.some((q) => q.key === key)
      ) {
        return;
      }
      queueRef.current.push({ id, key });
      pump();
    },
    [pump]
  );

  // Ganti scope/periode → buang antrean & batalkan kapتur berjalan (key tak lagi
  // relevan; thumb akan request ulang dengan key baru). Cache lama tetap (keyed).
  useEffect(() => {
    queueRef.current = [];
    inflightRef.current = null;
    setCurrent(null);
  }, [scopeKey, period]);

  // Pastikan snapshot termuat saat ada yang mengantre.
  useEffect(() => {
    if (current) p.ensureSnapshot();
  }, [current, p]);

  // Rasterisasi slide `current` setelah panggung luar-layar ter-render.
  useEffect(() => {
    if (!current) return;
    const { key } = current;
    let alive = true;
    (async () => {
      try {
        // Tunggu data snapshot siap agar tak meng-capture StageLoader.
        const t0 = Date.now();
        while (alive && (snapRef.current.loading || !snapRef.current.data) && Date.now() - t0 < SNAPSHOT_TIMEOUT_MS) {
          await sleep(150);
        }
        await sleep(SETTLE_MS);
        if (!alive) return;
        // Tunggu main thread idle → domToJpeg (CPU berat) tak membekukan interaksi.
        await whenIdle();
        if (!alive) return;
        const node = hostRef.current;
        if (node) {
          const { domToJpeg } = await import("modern-screenshot");
          const data = await domToJpeg(node, { scale: THUMB_SCALE, quality: THUMB_QUALITY, backgroundColor: "#ffffff" });
          if (!alive) return;
          if (data) {
            cache.set(key, data);
            persistSoon();
            emitThumbs();
          }
        }
      } catch {
        /* abaikan — kartu tetap memakai skematik ringan */
      } finally {
        if (alive) {
          done.add(key); // tuntas (sukses/gagal) → jangan berputar mengulang
          inflightRef.current = null;
          setCurrent(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Lanjut antrean saat kapتur selesai — DIJADWALKAN saat idle + jeda kecil agar
  // tak ada rentetan kapتur back-to-back yang membuat app tersendat di awal.
  useEffect(() => {
    if (current) return;
    let alive = true;
    void whenIdle().then(() => {
      if (alive) pump();
    });
    return () => {
      alive = false;
    };
  }, [current, pump]);

  return (
    <Ctx.Provider value={{ request }}>
      {children}
      {current ? (
        <div className={styles.host} aria-hidden="true">
          <div className={styles.capture} ref={hostRef}>
            <SlideView slideId={current.id} coverBg={coverBg} />
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
