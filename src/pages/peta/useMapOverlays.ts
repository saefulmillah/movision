import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Renderer } from "@googlemaps/markerclusterer";
import type { MapPoint } from "./layers";
import type { NetworkArc } from "@/types/map";

const RING = "#0A1120";

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/* ---------- Popup info (hover & klik) ---------- */
interface PopupOverlay extends google.maps.OverlayView {
  show(latLng: google.maps.LatLngLiteral, name: string, type: string): void;
  hide(): void;
}

function createPopup(): PopupOverlay {
  class Popup extends google.maps.OverlayView {
    private pos: google.maps.LatLng | null = null;
    private el: HTMLDivElement;
    private card: HTMLDivElement;
    constructor() {
      super();
      this.card = document.createElement("div");
      this.card.style.cssText =
        "transform:translate(-50%,calc(-100% - 14px));background:var(--surface-1);border:1px solid var(--line-strong);" +
        "border-radius:8px;padding:7px 11px;box-shadow:0 8px 22px rgba(0,0,0,0.32);white-space:nowrap;";
      this.el = document.createElement("div");
      this.el.style.cssText = "position:absolute;pointer-events:none;z-index:60;";
      this.el.appendChild(this.card);
    }
    show(latLng: google.maps.LatLngLiteral, name: string, type: string) {
      this.pos = new google.maps.LatLng(latLng.lat, latLng.lng);
      this.card.innerHTML =
        `<div style="font-size:12.5px;font-weight:600;color:var(--text);line-height:1.3">${escapeHtml(name)}</div>` +
        `<div style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px">${escapeHtml(type)}</div>`;
      if (!this.getMap()) this.setMap(this.mapInstance);
      this.draw();
    }
    hide() {
      if (this.getMap()) this.setMap(null);
    }
    mapInstance: google.maps.Map | null = null;
    onAdd() {
      const panes = this.getPanes();
      panes?.floatPane.appendChild(this.el);
    }
    onRemove() {
      this.el.parentNode?.removeChild(this.el);
    }
    draw() {
      if (!this.pos) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (p) {
        this.el.style.left = `${p.x}px`;
        this.el.style.top = `${p.y}px`;
      }
    }
  }
  return new Popup() as unknown as PopupOverlay;
}

/* ---------- Renderer cluster (CCTV) ---------- */
const clusterRenderer: Renderer = {
  render({ count, position }) {
    const r = count < 10 ? 20 : count < 50 ? 24 : count < 200 ? 28 : 32;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}">` +
      `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="#34D399" fill-opacity="0.92" stroke="#ffffff" stroke-width="2.5"/>` +
      `</svg>`;
    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(r * 2, r * 2),
        anchor: new google.maps.Point(r, r)
      },
      label: { text: String(count), color: "#06281c", fontSize: "12px", fontWeight: "700" },
      zIndex: 900
    });
  }
};

/** Kelola marker imperatif: cluster khusus CCTV, popup hover/klik semua marker. */
export function useMarkers(points: MapPoint[], onSelect: (id: string) => void): void {
  const map = useMap();
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const popupRef = useRef<PopupOverlay | null>(null);
  const cctvSigRef = useRef<string>("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    if (!popupRef.current) {
      popupRef.current = createPopup();
      (popupRef.current as unknown as { mapInstance: google.maps.Map }).mapInstance = map;
    }
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({ map, markers: [], renderer: clusterRenderer });
    }
    const popup = popupRef.current;
    const existing = markersRef.current;
    const nextIds = new Set(points.map((p) => p.id));

    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        existing.delete(id);
      }
    }

    for (const p of points) {
      const isCctv = p.layer === "cctv";
      const [w, h] = p.iconSize ?? [30, 30];
      const [ax, ay] = p.iconAnchor ?? [w / 2, h / 2];
      const icon: google.maps.Symbol | google.maps.Icon = p.iconUrl
        ? { url: p.iconUrl, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(ax, ay) }
        : { path: google.maps.SymbolPath.CIRCLE, fillColor: p.color, fillOpacity: 1, strokeColor: RING, strokeWeight: 1.4, scale: p.critical ? 6.5 : 4.5 };

      let marker = existing.get(p.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          icon,
          optimized: false,
          zIndex: p.layer === "sos" ? 1000 : p.layer === "gate" ? 600 : p.critical ? 500 : 1,
          // CCTV dikelola clusterer (map di-set clusterer), lainnya langsung.
          map: isCctv ? null : map
        });
        const name = p.name ?? p.id;
        const type = p.typeLabel ?? p.layer;
        marker.addListener("mouseover", () => popup.show({ lat: p.lat, lng: p.lng }, name, type));
        marker.addListener("mouseout", () => popup.hide());
        marker.addListener("click", () => {
          popup.show({ lat: p.lat, lng: p.lng }, name, type);
          onSelectRef.current(p.id);
        });
        existing.set(p.id, marker);
      } else {
        marker.setPosition({ lat: p.lat, lng: p.lng });
        marker.setIcon(icon);
      }
    }

    // Perbarui clusterer hanya bila kumpulan CCTV berubah (hemat re-cluster).
    const cctvMarkers = points.filter((p) => p.layer === "cctv").map((p) => existing.get(p.id)!).filter(Boolean);
    const sig = points.filter((p) => p.layer === "cctv").map((p) => p.id).sort().join("|");
    if (sig !== cctvSigRef.current) {
      cctvSigRef.current = sig;
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(cctvMarkers);
    }
  }, [map, points]);

  useEffect(() => {
    const existing = markersRef.current;
    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
      for (const marker of existing.values()) marker.setMap(null);
      existing.clear();
      popupRef.current?.setMap(null);
      popupRef.current = null;
      cctvSigRef.current = "";
    };
  }, []);
}

const FO_COLOR = "#22D3EE";
const FO_DOWN = "#F43F5E";

/** Gambar koneksi FO sebagai polyline Google Maps. */
export function useArcs(arcs: NetworkArc[], visible: boolean): void {
  const map = useMap();
  const linesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    for (const line of linesRef.current) line.setMap(null);
    linesRef.current = [];
    if (!visible) return;

    for (const e of arcs) {
      const s = e.source;
      const t = e.target;
      if (!s?.lat || !s?.lng || !t?.lat || !t?.lng) continue;
      const down = String(e.status).toLowerCase() !== "normal";
      const line = new google.maps.Polyline({
        path: [
          { lat: s.lat, lng: s.lng },
          { lat: t.lat, lng: t.lng }
        ],
        map,
        strokeColor: down ? FO_DOWN : FO_COLOR,
        strokeOpacity: 0.75,
        strokeWeight: 2,
        geodesic: true
      });
      linesRef.current.push(line);
    }
  }, [map, arcs, visible]);

  useEffect(() => {
    const lines = linesRef.current;
    return () => {
      for (const line of lines) line.setMap(null);
    };
  }, []);
}
