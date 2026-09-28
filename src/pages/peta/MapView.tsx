import { useEffect } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { useArcs, useMarkers } from "./useMapOverlays";
import type { MapPoint } from "./layers";
import type { NetworkArc } from "@/types/map";
import styles from "./peta.module.css";

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "";

// Pusat default: kira-kira tengah jaringan ruas (Sumatra–Jawa).
const DEFAULT_CENTER = { lat: -2.5, lng: 104.5 };
const DEFAULT_ZOOM = 5;

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#102f5c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#93a8c9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d2547" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c2140" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b3d6b" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#274f87" }] }
];

interface MapViewProps {
  points: MapPoint[];
  arcs: NetworkArc[];
  foVisible: boolean;
  focus: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
}

function Overlays({ points, arcs, foVisible, focus, onSelect }: MapViewProps) {
  const map = useMap();
  useMarkers(points, onSelect);
  useArcs(arcs, foVisible);

  useEffect(() => {
    if (map && focus) {
      map.panTo(focus);
      if ((map.getZoom() ?? 0) < 12) map.setZoom(13);
    }
  }, [map, focus]);

  return null;
}

function MapControls({ onToggleFull, isFull }: { onToggleFull: () => void; isFull: boolean }) {
  const map = useMap();
  const zoom = (delta: number) => {
    if (map) map.setZoom((map.getZoom() ?? DEFAULT_ZOOM) + delta);
  };
  return (
    <div className={styles.mapControls} data-full={isFull || undefined}>
      <button className={styles.mapBtn} onClick={() => zoom(1)} title="Perbesar" aria-label="Perbesar">
        <Icon name="plus" size={16} />
      </button>
      <button className={styles.mapBtn} onClick={() => zoom(-1)} title="Perkecil" aria-label="Perkecil">
        <Icon name="minus" size={16} />
      </button>
      {!isFull && (
        <button className={styles.mapBtn} onClick={onToggleFull} title="Layar penuh" aria-label="Layar penuh">
          <Icon name="maximize" size={16} />
        </button>
      )}
    </div>
  );
}

interface FullMapViewProps extends MapViewProps {
  onToggleFull: () => void;
  isFull: boolean;
}

export function MapView(props: FullMapViewProps) {
  const { theme } = useTheme();

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
        className={styles.mapHost}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        styles={theme === "dark" ? DARK_STYLE : undefined}
      >
        <Overlays {...props} />
        <MapControls onToggleFull={props.onToggleFull} isFull={props.isFull} />
      </Map>
    </APIProvider>
  );
}
