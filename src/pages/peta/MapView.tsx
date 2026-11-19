import { useEffect } from "react";
import { APIProvider, ColorScheme, Map, useMap } from "@vis.gl/react-google-maps";
import { Icon } from "@/components/ui/Icon";
import { useArcs, useDensityTooltips, useMarkers, useRouteLayers } from "./useMapOverlays";
import type { DensityTip, RouteClickHandler } from "./useMapOverlays";
import type { MapPoint } from "./layers";
import type { RouteKey } from "./routeLayers";
import type { NetworkArc } from "@/types/map";
import styles from "./peta.module.css";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "";

// Map ID untuk Cloud-based Map Styling (opsional). Bila diisi, style diambil
// dari Google Cloud Console (impor FUTURISTIC_BLUE / docs/google-maps-futuristic-blue.json)
// dan properti `styles` inline TIDAK dipakai. Bila kosong → fallback ke style inline.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined)?.trim() || "";

// Pusat default: kira-kira tengah jaringan ruas (Sumatra–Jawa).
const DEFAULT_CENTER = { lat: -2.5, lng: 104.5 };
const DEFAULT_ZOOM = 5;

const WORLD_PX = 256; // ukuran ubin dunia pada zoom 0
const FIT_PADDING = 36; // px sisi dalam agar ruas tak menempel tepi
const FIT_MAX_ZOOM = 15; // jangan terlalu dekat (mis. ruas 1 titik)
const FIT_MIN_ZOOM = 6;

/** Proyeksi lintang ke fraksi Mercator [0..1] (standar Google). */
function latRad(lat: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  const r = Math.log((1 + s) / (1 - s)) / 2;
  return Math.max(Math.min(r, Math.PI), -Math.PI) / 2;
}

/** Hitung zoom agar span (dalam fraksi dunia) muat di `spanPx` piksel. */
function zoomForSpan(spanPx: number, worldFraction: number): number {
  if (worldFraction <= 0) return FIT_MAX_ZOOM;
  return Math.log2(spanPx / WORLD_PX / worldFraction);
}

/** Center + zoom untuk membingkai kumpulan titik, dihitung dari ukuran div
 *  peta yang SEBENARNYA (hindari salah ukur fitBounds saat mount). */
function frameForCoords(
  map: google.maps.Map,
  coords: Array<{ lat: number; lng: number }>
): { center: { lat: number; lng: number }; zoom: number } | null {
  if (coords.length === 0) return null;
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

  const div = map.getDiv() as HTMLElement | null;
  const w = div?.clientWidth ?? 0;
  const h = div?.clientHeight ?? 0;
  if (w < 40 || h < 40) return { center, zoom: 11 }; // div belum terukur → fallback

  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  let lngDiff = maxLng - minLng;
  if (lngDiff < 0) lngDiff += 360;
  const lngFraction = lngDiff / 360;

  const latZoom = zoomForSpan(h - 2 * FIT_PADDING, latFraction);
  const lngZoom = zoomForSpan(w - 2 * FIT_PADDING, lngFraction);
  let zoom = Math.min(latZoom, lngZoom);
  if (!Number.isFinite(zoom)) zoom = 13;
  zoom = Math.max(FIT_MIN_ZOOM, Math.min(FIT_MAX_ZOOM, Math.floor(zoom)));
  return { center, zoom };
}

/* Gaya peta "biru futuristic": basis navy dalam + batas administrasi neon
   halus, dirancang agar layer vektor (polyline ruas) menonjol. Label nama
   wilayah yang ramai (POI, transit, nama jalan, kelurahan/kecamatan, land
   parcel) disembunyikan; negara/provinsi/kota disisakan untuk orientasi. */
const FUTURISTIC_BLUE: google.maps.MapTypeStyle[] = [
  // Basis & teks
  { elementType: "geometry", stylers: [{ color: "#081a33" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a86c2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#030a17" }, { weight: 2 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // Daratan
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0a1e3d" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0b2347" }] },

  // Perairan — gelap pekat agar daratan & vektor kontras
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#03101f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#2e5c8f" }] },

  // Batas administrasi — garis biru/sian tipis (kesan neon)
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1d4c88" }, { weight: 1 }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2f74c0" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#215aa0" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#7fb0e6" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#6c9ad6" }] },

  // Jalan (geometri) diredupkan supaya tak bersaing dengan polyline kita
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#10305a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#143a6a" }] },

  // --- Filter nama wilayah: sembunyikan label yang ramai ---
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] }
];

export type LatLng = { lat: number; lng: number };

/** Permintaan auto-fit peta saat ruas aktif berganti.
 *  - "overview": kembali ke tampilan seluruh jaringan (Semua Ruas).
 *  - "branch": zoom & center ke ruas terpilih (bounds dari titik ruas, atau
 *    center ruas sebagai fallback). `token` memastikan efek jalan sekali
 *    per pergantian ruas (bukan tiap polling data). */
export type FitRequest =
  | { token: number; kind: "overview" }
  | { token: number; kind: "branch"; coords: LatLng[]; center: LatLng | null };

interface MapViewProps {
  points: MapPoint[];
  arcs: NetworkArc[];
  foVisible: boolean;
  routeVisible: Record<RouteKey, boolean>;
  densityTips: DensityTip[];
  densityOn: boolean;
  focus: { lat: number; lng: number } | null;
  fitRequest: FitRequest | null;
  onSelect: (id: string) => void;
  onRouteClick: RouteClickHandler;
}

function Overlays({ points, arcs, foVisible, routeVisible, densityTips, densityOn, focus, fitRequest, onSelect, onRouteClick }: MapViewProps) {
  const map = useMap();
  useMarkers(points, onSelect);
  useArcs(arcs, foVisible);
  useRouteLayers(routeVisible, onRouteClick);
  useDensityTooltips(densityTips, densityOn);

  // Auto zoom & center ke ruas yang dipilih (dropdown "Ruas Aktif").
  useEffect(() => {
    if (!map || !fitRequest || !window.google?.maps) return;

    if (fitRequest.kind === "overview") {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }

    const req = fitRequest;
    const apply = () => {
      const frame = frameForCoords(map, req.coords);
      if (frame) {
        map.setCenter(frame.center);
        map.setZoom(frame.zoom);
      } else if (req.center) {
        // Tak ada titik → pakai center ruas sebagai fallback.
        map.setCenter(req.center);
        map.setZoom(11);
      }
    };

    apply();
    // Terapkan ulang sekali setelah peta idle: saat mount, ukuran div bisa
    // belum final sehingga zoom salah; perhitungan ulang mengoreksinya.
    // Untuk pergantian ruas biasa (div sudah final) ini idempoten.
    const once = google.maps.event.addListenerOnce(map, "idle", apply);
    return () => google.maps.event.removeListener(once);
  }, [map, fitRequest]);

  useEffect(() => {
    if (map && focus) {
      map.panTo(focus);
      if ((map.getZoom() ?? 0) < 12) map.setZoom(13);
    }
  }, [map, focus]);

  return null;
}

function MapControls({
  onToggleFull,
  isFull,
  mapTheme,
  onToggleTheme
}: {
  onToggleFull: () => void;
  isFull: boolean;
  mapTheme: MapTheme;
  onToggleTheme: () => void;
}) {
  const map = useMap();
  const zoom = (delta: number) => {
    if (map) map.setZoom((map.getZoom() ?? DEFAULT_ZOOM) + delta);
  };
  const nextTheme = mapTheme === "dark" ? "terang" : "gelap";
  return (
    <div className={styles.mapControls} data-full={isFull || undefined}>
      <button className={styles.mapBtn} onClick={() => zoom(1)} title="Perbesar" aria-label="Perbesar">
        <Icon name="plus" size={16} />
      </button>
      <button className={styles.mapBtn} onClick={() => zoom(-1)} title="Perkecil" aria-label="Perkecil">
        <Icon name="minus" size={16} />
      </button>
      <button className={styles.mapBtn} onClick={onToggleTheme} title={`Tema peta ${nextTheme}`} aria-label={`Tema peta ${nextTheme}`}>
        <Icon name={mapTheme === "dark" ? "sun" : "moon"} size={16} />
      </button>
      {!isFull && (
        <button className={styles.mapBtn} onClick={onToggleFull} title="Layar penuh" aria-label="Layar penuh">
          <Icon name="maximize" size={16} />
        </button>
      )}
    </div>
  );
}

export type MapTheme = "dark" | "light";

interface FullMapViewProps extends MapViewProps {
  onToggleFull: () => void;
  isFull: boolean;
  mapTheme: MapTheme;
  onToggleTheme: () => void;
}

export function MapView(props: FullMapViewProps) {
  if (!API_KEY) {
    return (
      <div className={styles.mapFallback}>
        <Icon name="map" size={30} />
        <div>
          <strong>Google Maps API key belum diisi.</strong>
          <div style={{ fontSize: "var(--fs-sm)", marginTop: 6 }}>
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> di <code>movision/.env</code> lalu muat ulang.
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        // colorScheme diterapkan saat init; vis.gl membuat ulang instance map
        // otomatis saat colorScheme berubah & mempertahankan posisi kamera.
        className={styles.mapHost}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        backgroundColor={props.mapTheme === "dark" ? "#081a33" : "#e8eef5"}
        // Tema terang/gelap bawaan Google (vector map / Map ID). Mengganti style
        // biru-inline yang kini diabaikan karena Map ID aktif.
        colorScheme={props.mapTheme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
        // Cloud styling (Map ID) bila tersedia; jika tidak, style JSON inline.
        // Keduanya tak boleh dipasang bersamaan (styles diabaikan saat ada mapId).
        {...(MAP_ID ? { mapId: MAP_ID } : { styles: FUTURISTIC_BLUE })}
      >
        <Overlays {...props} />
        <MapControls
          onToggleFull={props.onToggleFull}
          isFull={props.isFull}
          mapTheme={props.mapTheme}
          onToggleTheme={props.onToggleTheme}
        />
      </Map>
    </APIProvider>
  );
}
