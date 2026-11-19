import { useCallback, useEffect, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import type { Renderer, Cluster } from "@googlemaps/markerclusterer";
import type { LayerKey, MapPoint } from "./layers";
import { ROUTE_LAYERS, isHutamaKarya, isLabelRight, routeFeatureStyle } from "./routeLayers";
import type { RouteKey } from "./routeLayers";
import type { NetworkArc } from "@/types/map";

/** Marker kini berbasis elemen HTML (AdvancedMarkerElement) agar bisa animasi
 *  CSS pop-in. Wajib Map ID aktif (VITE_GOOGLE_MAPS_MAP_ID). */
type AdvMarker = google.maps.marker.AdvancedMarkerElement;

const RING = "#0A1120";

/* ---------- Animasi marker (pop-in) + gaya elemen HTML ---------- */
const MARKER_CSS =
  "@keyframes petaMkEnter{from{opacity:0;transform:translateY(10px) scale(.6)}to{opacity:1;transform:none}}" +
  ".peta-mk-enter{animation:petaMkEnter 440ms cubic-bezier(.22,1,.36,1) both;transform-origin:50% 50%}" +
  ".peta-mk-icon{display:block;position:relative;will-change:transform,opacity}" +
  ".peta-cluster{display:flex;align-items:center;justify-content:center;cursor:pointer;" +
  "color:#eaf2ff;font:700 12px/1 'IBM Plex Sans',system-ui,sans-serif;transition:transform .12s ease}" +
  ".peta-cluster:hover{transform:scale(1.06)}" +
  // Badge jumlah pada marker bertumpuk (koordinat sama) → tanda bisa di-spiderfy.
  ".peta-mk-badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 3px;" +
  "border-radius:8px;background:#0ea5e9;color:#fff;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.55);" +
  "font:800 10px/16px 'IBM Plex Sans',system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .15s}" +
  ".peta-spider-open .peta-mk-badge{opacity:0}" +
  // Garis penghubung saat marker dikipas (spiderfy).
  ".peta-spider-leg{position:absolute;height:1.6px;background:rgba(255,255,255,.55);transform-origin:0 50%;" +
  "pointer-events:none;z-index:-1}";

let markerStyleInjected = false;
function ensureMarkerStyle(): void {
  if (markerStyleInjected) return;
  const s = document.createElement("style");
  s.textContent = MARKER_CSS;
  document.head.appendChild(s);
  markerStyleInjected = true;
}

/* Koordinasi tooltip: saat kursor di atas marker/cluster, tooltip nama ruas
   (polyline di bawahnya) ditahan agar tak menumpuk dua tooltip sekaligus. */
let markerHovering = false;
let routeHideTip: (() => void) | null = null;
function enterMarkerHover(): void {
  markerHovering = true;
  routeHideTip?.();
}
function leaveMarkerHover(): void {
  markerHovering = false;
}

/** Putar ulang animasi pop-in pada elemen (hapus→reflow→tambah class). */
function playEnter(el: HTMLElement): void {
  el.classList.remove("peta-mk-enter");
  void el.offsetWidth; // paksa reflow agar animasi bisa diputar lagi
  el.classList.add("peta-mk-enter");
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/* ---------- Warna & label kategori (segmen donut + tooltip) ---------- */
const CAT_COLORS: Record<string, string> = {
  cctv: "#34D399",
  vms: "#FBBF24",
  fo: "#22D3EE",
  gps: "#5A8DFF",
  gate: "#F43F5E",
  weather: "#38BDF8",
  sos: "#FB7185"
};
const CAT_LABEL: Record<string, string> = {
  cctv: "CCTV",
  vms: "VMS",
  fo: "FO",
  gps: "GPS",
  gate: "Gerbang",
  weather: "Cuaca",
  sos: "SOS"
};

/* GPS sering tetap bertumpuk walau sudah zoom-in → cluster-nya dipecah per
   JENIS KENDARAAN (bukan satu warna "gps"). Warna per jenis dipilih deterministik
   dari palet agar stabil lintas render. */
const VEHICLE_PALETTE = ["#5A8DFF", "#A78BFA", "#F472B6", "#34D399", "#FBBF24", "#22D3EE", "#FB923C", "#4ADE80", "#E879F9", "#60A5FA"];
function vehicleColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return VEHICLE_PALETTE[h % VEHICLE_PALETTE.length];
}
/** Id kategori untuk komposisi donut: GPS dipecah per jenis kendaraan, lainnya per layer. */
function catId(layer: LayerKey, vtype?: string): string {
  return layer === "gps" ? `gps:${vtype || "Tidak diketahui"}` : layer;
}
function catColor(cat: string): string {
  if (cat.startsWith("gps:")) return vehicleColor(cat.slice(4));
  return CAT_COLORS[cat] ?? "#64748b";
}
function catLabel(cat: string): string {
  if (cat.startsWith("gps:")) return cat.slice(4);
  return CAT_LABEL[cat] ?? cat;
}
/** Maks. segmen donut; sisanya digabung jadi "Lainnya" agar tak terlalu ramai. */
const MAX_SEGMENTS = 8;

/* Jenis aset yang DIGABUNG dalam satu cluster multi-kategori.
   GPS PUNYA CLUSTERER SENDIRI (lihat GPS_MAX_ZOOM) agar kendaraan berkoordinat
   hampir sama tetap mengelompok di semua level zoom, bukan bertumpuk individual.
   SOS/FO/Cuaca juga clusterer sendiri. */
const MERGED_LAYERS = new Set<LayerKey>(["cctv", "vms", "gate"]);
const MERGED_KEY = "__merged__";

/* GPS: clusterer tersendiri yang TETAP meng-cluster sampai zoom dalam (maxZoom
   tinggi) → titik berdekatan selalu jadi grup; hover grup menampilkan daftar
   kendaraannya. Klik grup zoom secukupnya (titik kebetulan sama tak akan pecah). */
const GPS_MAX_ZOOM = 20;
const GPS_CLICK_TARGET = 17;
/** Ambang: cluster GPS kecil → tooltip daftar kendaraan; besar → komposisi jenis. */
const MEMBER_LIST_MAX = 15;

/* Tiga tingkat visualisasi menurut zoom (sesuai usulan):
   <DONUT_MIN_ZOOM      → bubble agregat polos
   DONUT..UNCLUSTER-1   → donut komposisi kategori
   ≥UNCLUSTER_ZOOM      → marker individual (cluster pecah) */
const DONUT_MIN_ZOOM = 8;
const UNCLUSTER_ZOOM = 12;
const CLUSTER_RADIUS = 70; // radius grid supercluster (px)

/** Metadata per marker (kategori + status + jenis & nama kendaraan) untuk komposisi donut & tooltip. */
const markerMeta = new WeakMap<AdvMarker, { layer: LayerKey; critical: boolean; vtype?: string; name?: string }>();
/** Elemen HTML beranimasi tiap marker (untuk memutar ulang pop-in saat uncluster). */
const markerEnterEl = new WeakMap<AdvMarker, HTMLElement>();
/** Elemen konten + offset centering dasar + ukuran (untuk spiderfy: geser via piksel). */
const markerBox = new WeakMap<AdvMarker, { root: HTMLElement; center: HTMLElement; bx: number; by: number; w: number; h: number }>();

/** zIndex dasar marker menurut jenis/status (untuk dipulihkan usai spiderfy). */
function baseZIndex(layer: LayerKey, critical: boolean): number {
  return layer === "sos" ? 1000 : layer === "gate" ? 600 : critical ? 500 : 1;
}

/** Kunci koordinat untuk mendeteksi marker bertumpuk (CCTV A/B sering sama). */
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Zoom bertahap + halus menuju target (pan dulu, lalu naik zoom per level)
 *  — menggantikan lompatan fitBounds yang kaku saat cluster diklik. */
function smoothZoom(map: google.maps.Map, center: google.maps.LatLng, target: number): void {
  map.panTo(center);
  const step = () => {
    const z = map.getZoom() ?? 0;
    if (z >= target) return;
    map.setZoom(z + 1);
    window.setTimeout(step, 150);
  };
  window.setTimeout(step, 110);
}

/* ---------- Popup info (hover & klik) ---------- */
/** Rincian per kategori komposisi cluster (cat id, warna & label sudah di-resolve). */
type TallyEntry = { cat: string; total: number; off: number; color: string; label: string };
type ClusterTally = TallyEntry[];
/** Daftar kendaraan (untuk tooltip grup GPS kecil). */
type ClusterMember = { name: string; type: string; color: string };

interface PopupOverlay extends google.maps.OverlayView {
  showMarker(latLng: google.maps.LatLngLiteral, name: string, type: string): void;
  showCluster(latLng: google.maps.LatLngLiteral, count: number, tally: ClusterTally, members?: ClusterMember[], unit?: string): void;
  hide(): void;
  mapInstance: google.maps.Map | null;
}

/** Rincian cluster: total + per kategori (jumlah & offline). */
function clusterPopupHtml(count: number, tally: ClusterTally, members?: ClusterMember[], unit = "perangkat"): string {
  // Grup kecil (mis. GPS berkoordinat mirip) → daftar tiap kendaraan.
  if (members && members.length) {
    const rows = members
      .map(
        (m) =>
          `<div style="display:flex;align-items:center;gap:7px;font-size:11px;line-height:1.5">` +
          `<span style="width:8px;height:8px;border-radius:50%;background:${m.color};flex:none"></span>` +
          `<span style="color:var(--text);font-weight:600">${escapeHtml(m.name)}</span>` +
          `<span style="margin-left:auto;padding-left:14px;color:var(--text-muted);font-family:var(--font-mono)">${escapeHtml(m.type)}</span>` +
          `</div>`
      )
      .join("");
    return `<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">${count} ${unit}</div>${rows}`;
  }
  const rows = tally
    .map((e) => {
      // Chip status hanya saat ada yang offline (kategori tanpa konsep offline
      // seperti GPS/Cuaca cukup tampil jumlahnya saja).
      const status = e.off > 0 ? `<span style="margin-left:auto;padding-left:14px;color:#fca5a5">${e.off} offline</span>` : "";
      return (
        `<div style="display:flex;align-items:center;gap:7px;font-size:11px;line-height:1.55">` +
        `<span style="width:8px;height:8px;border-radius:50%;background:${e.color};flex:none"></span>` +
        `<span style="color:var(--text);font-weight:600">${escapeHtml(e.label)}</span>` +
        `<span style="color:var(--text-muted);font-family:var(--font-mono)">${e.total}</span>` +
        status +
        `</div>`
      );
    })
    .join("");
  return `<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">${count} ${unit}</div>${rows}`;
}

function createPopup(): PopupOverlay {
  class Popup extends google.maps.OverlayView {
    private pos: google.maps.LatLng | null = null;
    private el: HTMLDivElement;
    private card: HTMLDivElement;
    // "side" → tooltip di samping marker (tak menutupi marker yang bertumpuk
    // vertikal); "above" → di atas titik (dipakai untuk bubble cluster).
    private place: "side" | "above" = "side";
    constructor() {
      super();
      this.card = document.createElement("div");
      this.card.style.cssText =
        "position:absolute;left:0;top:0;background:var(--surface-1);border:1px solid var(--line-strong);" +
        "border-radius:8px;padding:7px 11px;box-shadow:0 8px 22px rgba(0,0,0,0.32);white-space:nowrap;";
      this.el = document.createElement("div");
      this.el.style.cssText = "position:absolute;pointer-events:none;z-index:60;";
      this.el.appendChild(this.card);
    }
    private open(latLng: google.maps.LatLngLiteral, html: string, place: "side" | "above") {
      this.pos = new google.maps.LatLng(latLng.lat, latLng.lng);
      this.place = place;
      this.card.innerHTML = html;
      if (!this.getMap()) this.setMap(this.mapInstance);
      this.draw();
    }
    showMarker(latLng: google.maps.LatLngLiteral, name: string, type: string) {
      this.open(
        latLng,
        `<div style="font-size:12.5px;font-weight:600;color:var(--text);line-height:1.3">${escapeHtml(name)}</div>` +
          `<div style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px">${escapeHtml(type)}</div>`,
        "side"
      );
    }
    showCluster(latLng: google.maps.LatLngLiteral, count: number, tally: ClusterTally, members?: ClusterMember[], unit?: string) {
      this.open(latLng, clusterPopupHtml(count, tally, members, unit), "above");
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
      const proj = this.getProjection();
      const p = proj?.fromLatLngToDivPixel(this.pos);
      if (!p) return;
      this.el.style.left = `${p.x}px`;
      this.el.style.top = `${p.y}px`;
      if (this.place === "above") {
        // Di atas titik (bubble cluster).
        this.card.style.transform = "translate(-50%,calc(-100% - 16px))";
        return;
      }
      // Di samping marker: default kanan, flip ke kiri bila dekat tepi kanan
      // layar agar tak terpotong. Offset 18px dari titik, rata tengah vertikal.
      const container = proj?.fromLatLngToContainerPixel(this.pos);
      const div = (this.getMap() as google.maps.Map | null)?.getDiv() as HTMLElement | undefined;
      const w = div?.clientWidth ?? 0;
      const flipLeft = container != null && w > 0 && container.x > w - 220;
      this.card.style.transform = flipLeft
        ? "translate(calc(-100% - 18px),-50%)"
        : "translate(18px,-50%)";
    }
  }
  return new Popup() as unknown as PopupOverlay;
}

/* ---------- Ikon bubble cluster (donut komposisi / agregat polos) ---------- */
/** Bangun data-URI SVG: donut multi-segmen (komposisi kategori) atau — bila
 *  `aggregateColor` diberi — bubble polos satu warna (tampilan zoom-jauh). */
function clusterIcon(r: number, segments: Array<{ color: string; frac: number }>, aggregateColor?: string): string {
  const size = r * 2;
  const cx = r;
  const cy = r;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  if (aggregateColor) {
    svg += `<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${aggregateColor}" fill-opacity="0.92" stroke="#ffffff" stroke-width="2.5"/>`;
  } else {
    const sw = Math.max(6, r * 0.46);
    const rr = r - sw / 2 - 1.5; // radius tengah cincin
    const C = 2 * Math.PI * rr;
    const hole = Math.max(0, rr - sw / 2); // radius lubang tengah
    svg += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.9"/>`;
    let acc = 0;
    for (const s of segments) {
      const len = s.frac * C;
      svg +=
        `<circle cx="${cx}" cy="${cy}" r="${rr.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${sw.toFixed(2)}" ` +
        `stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" ` +
        `transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += s.frac;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="${hole.toFixed(2)}" fill="${RING}"/>`;
  }
  svg += `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Bungkus elemen ikon menjadi konten AdvancedMarkerElement yang ter-anchor.
 *  API menaruh titik-dasar konten (bawah-tengah) di koordinat; kita geser `inner`
 *  agar titik anchor ikon (ax,ay) tepat di koordinat. Transform centering ada di
 *  elemen terpisah dari elemen animasi (agar tidak saling menimpa). */
function anchoredContent(
  inner: HTMLElement,
  w: number,
  h: number,
  ax: number,
  ay: number
): { root: HTMLElement; center: HTMLElement; bx: number; by: number } {
  const bx = w / 2 - ax;
  const by = h - ay;
  const root = document.createElement("div");
  root.style.cssText = `position:relative;width:${w}px;height:${h}px`;
  const center = document.createElement("div");
  center.style.cssText = `position:absolute;left:0;top:0;transform:translate(${bx}px,${by}px)`;
  center.appendChild(inner);
  root.appendChild(center);
  return { root, center, bx, by };
}

/** Renderer cluster → AdvancedMarkerElement (konten HTML): agregat polos (<zoom 8)
 *  / donut kategori (8–11), dengan tooltip hover rincian kategori + online/offline.
 *  Menutup event polyline di bawahnya (perbaikan tooltip "nama ruas" keliru). */
function makeClusterRenderer(map: google.maps.Map, popup: PopupOverlay): Renderer {
  return {
    render(cluster: Cluster) {
      const markers = (cluster.markers as AdvMarker[]) ?? [];
      const count = cluster.count;
      const zoom = map.getZoom() ?? 0;

      // Komposisi per kategori: GPS dipecah per jenis kendaraan (cantumkan jenisnya),
      // aset lain per layer. Warna + label di-resolve sekali di sini.
      const tallyMap = new Map<string, { total: number; off: number }>();
      for (const m of markers) {
        const meta = markerMeta.get(m);
        if (!meta) continue;
        const cat = catId(meta.layer, meta.vtype);
        const e = tallyMap.get(cat) ?? { total: 0, off: 0 };
        e.total += 1;
        if (meta.critical) e.off += 1;
        tallyMap.set(cat, e);
      }
      let tally: ClusterTally = [...tallyMap.entries()]
        .map(([cat, e]) => ({ cat, total: e.total, off: e.off, color: catColor(cat), label: catLabel(cat) }))
        .sort((a, b) => b.total - a.total);
      // Batasi jumlah segmen agar donut tak terlalu ramai; sisa → "Lainnya".
      if (tally.length > MAX_SEGMENTS) {
        const head = tally.slice(0, MAX_SEGMENTS - 1);
        const rest = tally.slice(MAX_SEGMENTS - 1);
        const merged = rest.reduce(
          (a, e) => ({ cat: "__other__", total: a.total + e.total, off: a.off + e.off, color: "#64748b", label: "Lainnya" }),
          { cat: "__other__", total: 0, off: 0, color: "#64748b", label: "Lainnya" }
        );
        tally = [...head, merged];
      }

      // Cluster GPS-saja & kecil → daftar kendaraan di tooltip (nama + jenis).
      const allGps = markers.length > 0 && markers.every((m) => markerMeta.get(m)?.layer === "gps");
      const unit = allGps ? "kendaraan" : "perangkat";
      let members: ClusterMember[] | undefined;
      if (allGps && count <= MEMBER_LIST_MAX) {
        members = markers
          .map((m) => {
            const meta = markerMeta.get(m);
            const vt = meta?.vtype || "Tidak diketahui";
            return { name: meta?.name || "Kendaraan", type: vt, color: vehicleColor(vt) };
          })
          .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
      }

      const r = count < 10 ? 19 : count < 50 ? 23 : count < 200 ? 27 : 31;
      let url: string;
      if (zoom < DONUT_MIN_ZOOM) {
        url = clusterIcon(r, [], tally[0]?.color ?? "#64748b");
      } else {
        const total = count || 1;
        const segs = tally.map((e) => ({ color: e.color, frac: e.total / total }));
        url = clusterIcon(r, segs);
      }

      const bubble = document.createElement("div");
      bubble.className = "peta-cluster";
      bubble.style.width = `${r * 2}px`;
      bubble.style.height = `${r * 2}px`;
      bubble.style.background = `url("${url}") center/contain no-repeat`;
      if (count >= 1000) bubble.style.fontSize = "10px";
      const cnt = document.createElement("span");
      cnt.textContent = String(count);
      bubble.appendChild(cnt);

      const pos = cluster.position;
      bubble.addEventListener("mouseenter", () => {
        enterMarkerHover();
        popup.showCluster({ lat: pos.lat(), lng: pos.lng() }, count, tally, members, unit);
      });
      bubble.addEventListener("mouseleave", () => {
        leaveMarkerHover();
        popup.hide();
      });

      return new google.maps.marker.AdvancedMarkerElement({
        position: cluster.position,
        content: anchoredContent(bubble, r * 2, r * 2, r, r).root,
        zIndex: 900 + Math.min(count, 99),
        gmpClickable: true
      });
    }
  };
}

/** Bangun satu AdvancedMarkerElement untuk titik aset (ikon HTML + pop-in CSS +
 *  hover/klik via DOM). `groupSize` > 1 → tampilkan badge jumlah (marker
 *  bertumpuk, bisa di-spiderfy). Klik dialihkan ke `onActivate`. */
function buildAssetMarker(p: MapPoint, groupSize: number, onActivate: (id: string) => void, popup: PopupOverlay): AdvMarker {
  const [w, h] = p.iconSize ?? [30, 30];
  const [ax, ay] = p.iconAnchor ?? [w / 2, h / 2];

  const enter = document.createElement("div");
  enter.className = "peta-mk-icon peta-mk-enter";
  enter.style.cssText = `width:${w}px;height:${h}px`;
  if (p.iconUrl) {
    const img = document.createElement("img");
    img.src = p.iconUrl;
    img.draggable = false;
    img.style.cssText = "display:block;width:100%;height:100%";
    enter.appendChild(img);
  } else {
    const d = p.critical ? 13 : 9;
    const dot = document.createElement("div");
    dot.style.cssText = `width:${d}px;height:${d}px;border-radius:50%;margin:${(h - d) / 2}px auto;background:${p.color};border:1.4px solid ${RING}`;
    enter.appendChild(dot);
  }
  if (groupSize > 1) {
    const badge = document.createElement("div");
    badge.className = "peta-mk-badge";
    badge.textContent = String(groupSize);
    enter.appendChild(badge);
  }
  // Pop-in hanya sekali per kemunculan: setelah selesai, lepas class agar tak
  // terputar ulang saat marker dipasang-ulang (pan). Diputar ulang eksplisit
  // saat cluster pecah (lihat useMarkers).
  enter.addEventListener("animationend", () => enter.classList.remove("peta-mk-enter"));

  const { root, center, bx, by } = anchoredContent(enter, w, h, ax, ay);
  root.style.cursor = "pointer";

  const name = p.name ?? p.id;
  const type = p.typeLabel ?? p.layer;
  // Gerbang: popup hover dinonaktifkan (status via tooltip kepadatan persisten).
  const infoPopup = p.layer !== "gate";
  // Jeda tampil: menyapu kursor antar-marker berdekatan TIDAK langsung memunculkan
  // tooltip yang menutupi marker lain; tooltip baru muncul bila kursor berhenti.
  let tipTimer = 0;
  root.addEventListener("mouseenter", () => {
    enterMarkerHover(); // tahan tooltip ruas segera (cegah 2 tooltip menumpuk)
    if (!infoPopup) return;
    window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => popup.showMarker({ lat: p.lat, lng: p.lng }, name, type), 320);
  });
  root.addEventListener("mouseleave", () => {
    leaveMarkerHover();
    window.clearTimeout(tipTimer);
    if (infoPopup) popup.hide();
  });
  root.addEventListener("click", (e) => {
    e.stopPropagation(); // jangan sampai menutup spiderfy (listener klik peta)
    onActivate(p.id);
  });

  const marker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat: p.lat, lng: p.lng },
    content: root,
    zIndex: baseZIndex(p.layer, p.critical)
  });
  markerMeta.set(marker, { layer: p.layer, critical: p.critical, vtype: p.vehicleType, name: p.name });
  markerEnterEl.set(marker, enter);
  markerBox.set(marker, { root, center, bx, by, w, h });
  return marker;
}

/** Render clusterer secara aman: tambah marker dgn noDraw lalu render saat
 *  proyeksi OverlayView siap. Mencegah render sinkron pada overlay yang baru
 *  dibuat (belum `onAdd`) — pola aman lintas algoritma. */
function safeRender(cl: MarkerClusterer, tries = 0): void {
  const ov = cl as unknown as { getProjection(): unknown; getMap(): unknown; render(): void };
  if (!ov.getMap()) return; // clusterer sudah dilepas
  if (ov.getProjection() || tries > 150) {
    try {
      ov.render();
    } catch {
      /* overlay dilepas di tengah tunggu — abaikan */
    }
    return;
  }
  requestAnimationFrame(() => safeRender(cl, tries + 1));
}

/** Perbarui isi clusterer tanpa render sinkron (hindari crash proyeksi-null),
 *  lalu render aman saat proyeksi siap. */
function syncClusterer(cl: MarkerClusterer, markers: AdvMarker[]): void {
  cl.clearMarkers(true);
  cl.addMarkers(markers, true);
  safeRender(cl);
}

/** Buat clusterer: cluster SEMUA titik (bukan hanya viewport) agar aset di luar
 *  layar tetap tampil sebagai cluster; pecah di UNCLUSTER_ZOOM, klik → zoom halus
 *  bertahap (bukan fitBounds). */
function makeClusterer(
  map: google.maps.Map,
  popup: PopupOverlay,
  maxZoom = UNCLUSTER_ZOOM - 1,
  clickTarget = UNCLUSTER_ZOOM
): MarkerClusterer {
  return new MarkerClusterer({
    map,
    markers: [],
    algorithm: new SuperClusterAlgorithm({ maxZoom, radius: CLUSTER_RADIUS }),
    renderer: makeClusterRenderer(map, popup),
    onClusterClick: (_e, cluster, m) => {
      const z = m.getZoom() ?? 0;
      smoothZoom(m, cluster.position, Math.min(z + 2, clickTarget));
    }
  });
}

/** Signature visual marker: bila berubah (ikon/status/ukuran), marker dibangun
 *  ulang agar konten HTML-nya ikut diperbarui. */
function visualSig(p: MapPoint): string {
  const [w, h] = p.iconSize ?? [30, 30];
  return `${p.iconUrl ?? p.color}|${p.critical ? 1 : 0}|${w}x${h}`;
}

/** Kelola marker imperatif (AdvancedMarkerElement): satu cluster multi-kategori
 *  (CCTV/VMS/Gerbang) + clusterer GPS tersendiri (mengelompok di semua zoom) +
 *  clusterer terpisah untuk SOS/FO/Cuaca; popup hover/klik semua marker;
 *  animasi pop-in CSS saat muncul/uncluster. */
export function useMarkers(points: MapPoint[], onSelect: (id: string) => void): void {
  const map = useMap();
  const markerLib = useMapsLibrary("marker"); // pastikan AdvancedMarkerElement termuat
  const markersRef = useRef<Map<string, AdvMarker>>(new Map());
  const visRef = useRef<Map<string, string>>(new Map());
  const clusterersRef = useRef<Map<string, MarkerClusterer>>(new Map());
  const sigRef = useRef<Map<string, string>>(new Map());
  const popupRef = useRef<PopupOverlay | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null); // deteksi instance peta diganti
  // Spiderfy: grup marker berkoordinat sama (CCTV A/B), + status terbuka.
  const groupsRef = useRef<Map<string, string[]>>(new Map()); // coordKey → ids
  const idGroupRef = useRef<Map<string, string>>(new Map()); // id → coordKey
  const spiderRef = useRef<{ key: string } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Kipas (spiderfy) anggota grup berkoordinat sama agar semua terlihat & bisa
  // diklik — geser konten via offset piksel (tetap, lepas dari zoom) + garis.
  const spiderfy = useCallback((key: string) => {
    const ids = groupsRef.current.get(key);
    if (!ids || ids.length < 2) return;
    const members = ids.map((id) => markersRef.current.get(id)).filter(Boolean) as AdvMarker[];
    const n = members.length;
    const R = Math.max(26, 14 + n * 6);
    members.forEach((m, i) => {
      const box = markerBox.get(m);
      if (!box) return;
      const ang = (2 * Math.PI * i) / n - Math.PI / 2;
      const dx = Math.cos(ang) * R;
      const dy = Math.sin(ang) * R;
      box.center.style.transition = "transform .22s cubic-bezier(.22,1,.36,1)";
      box.center.style.transform = `translate(${box.bx + dx}px,${box.by + dy}px)`;
      box.root.classList.add("peta-spider-open");
      m.zIndex = 3000 + i;
      // Garis penghubung dari titik (bawah-tengah konten = w/2,h) ke ikon terkipas.
      let leg = box.root.querySelector<HTMLDivElement>(".peta-spider-leg");
      if (!leg) {
        leg = document.createElement("div");
        leg.className = "peta-spider-leg";
        box.root.appendChild(leg);
      }
      leg.style.left = `${box.w / 2}px`;
      leg.style.top = `${box.h}px`;
      leg.style.width = `${R}px`;
      leg.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    });
    spiderRef.current = { key };
  }, []);

  const collapse = useCallback(() => {
    const s = spiderRef.current;
    if (!s) return;
    for (const id of groupsRef.current.get(s.key) ?? []) {
      const m = markersRef.current.get(id);
      if (!m) continue;
      const box = markerBox.get(m);
      if (box) {
        box.center.style.transform = `translate(${box.bx}px,${box.by}px)`;
        box.root.classList.remove("peta-spider-open");
        box.root.querySelector(".peta-spider-leg")?.remove();
      }
      const meta = markerMeta.get(m);
      m.zIndex = meta ? baseZIndex(meta.layer, meta.critical) : 1;
    }
    spiderRef.current = null;
  }, []);

  // Klik marker: bila bagian dari tumpukan & belum terbuka → kipas; selain itu
  // (sudah terbuka / marker tunggal) → pilih untuk buka detail.
  const onActivate = useCallback(
    (id: string) => {
      const key = idGroupRef.current.get(id);
      const ids = key ? groupsRef.current.get(key) : null;
      const s = spiderRef.current;
      if (key && ids && ids.length > 1 && (!s || s.key !== key)) {
        collapse();
        spiderfy(key);
        return;
      }
      onSelectRef.current(id);
    },
    [collapse, spiderfy]
  );

  useEffect(() => {
    if (!map || !markerLib || !window.google?.maps?.marker) return;
    ensureMarkerStyle();

    // Instance peta diganti (vis.gl MEMBUAT ULANG <Map> saat mapId/colorScheme
    // berubah, mis. ganti Map ID atau toggle tema) → clusterer, popup & marker
    // lama terikat ke peta yang sudah mati; bongkar semua lalu bangun ulang di
    // peta baru. Tanpa ini, marker/cluster "hilang" meski datanya ada.
    if (mapRef.current && mapRef.current !== map) {
      for (const cl of clusterersRef.current.values()) {
        cl.clearMarkers(true);
        cl.setMap(null);
      }
      clusterersRef.current.clear();
      sigRef.current.clear();
      for (const mk of markersRef.current.values()) mk.map = null;
      markersRef.current.clear();
      visRef.current.clear();
      popupRef.current?.setMap(null);
      popupRef.current = null;
      spiderRef.current = null;
    }
    mapRef.current = map;

    if (!popupRef.current) {
      popupRef.current = createPopup();
      (popupRef.current as unknown as { mapInstance: google.maps.Map }).mapInstance = map;
    }
    const popup = popupRef.current;
    const existing = markersRef.current;
    const nextIds = new Set(points.map((p) => p.id));

    // Deteksi grup koordinat sama (untuk badge jumlah & spiderfy).
    const groups = new Map<string, string[]>();
    const idGroup = new Map<string, string>();
    for (const p of points) {
      const ck = coordKey(p.lat, p.lng);
      (groups.get(ck) ?? groups.set(ck, []).get(ck)!).push(p.id);
      idGroup.set(p.id, ck);
    }
    groupsRef.current = groups;
    idGroupRef.current = idGroup;
    const groupSize = (p: MapPoint) => groups.get(coordKey(p.lat, p.lng))?.length ?? 1;

    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.map = null;
        existing.delete(id);
        visRef.current.delete(id);
      }
    }

    // Buat marker baru / bangun ulang bila visual/tumpukan berubah / perbarui posisi.
    for (const p of points) {
      const vs = `${visualSig(p)}|g${groupSize(p)}`;
      const cur = existing.get(p.id);
      if (!cur || visRef.current.get(p.id) !== vs) {
        if (cur) cur.map = null; // visual/tumpukan berubah → ganti objek
        const marker = buildAssetMarker(p, groupSize(p), onActivate, popup);
        existing.set(p.id, marker);
        visRef.current.set(p.id, vs);
      } else {
        cur.position = { lat: p.lat, lng: p.lng };
        markerMeta.set(cur, { layer: p.layer, critical: p.critical, vtype: p.vehicleType, name: p.name });
      }
    }

    // Kelompokkan: CCTV/VMS/Gerbang → satu clusterer gabungan; GPS → clusterer
    // "gps" sendiri; sisanya (SOS/FO/Cuaca) → clusterer per jenis.
    // Sig mencakup id+posisi+visual.
    const byClusterer = new Map<string, AdvMarker[]>();
    const sigParts = new Map<string, string[]>();
    for (const p of points) {
      const m = existing.get(p.id);
      if (!m) continue;
      const key = MERGED_LAYERS.has(p.layer) ? MERGED_KEY : p.layer;
      (byClusterer.get(key) ?? byClusterer.set(key, []).get(key)!).push(m);
      (sigParts.get(key) ?? sigParts.set(key, []).get(key)!).push(`${p.id}@${p.lat},${p.lng}#${visRef.current.get(p.id)}`);
    }
    for (const [key, markers] of byClusterer) {
      let cl = clusterersRef.current.get(key);
      if (!cl) {
        // GPS: clusterer yang tetap mengelompok sampai zoom dalam (koordinat mirip
        // selalu jadi grup); lainnya pecah di UNCLUSTER_ZOOM.
        cl = key === "gps" ? makeClusterer(map, popup, GPS_MAX_ZOOM, GPS_CLICK_TARGET) : makeClusterer(map, popup);
        clusterersRef.current.set(key, cl);
      }
      const sig = (sigParts.get(key) ?? []).sort().join("|");
      if (sig !== sigRef.current.get(key)) {
        sigRef.current.set(key, sig);
        syncClusterer(cl, markers);
      }
    }
    // Clusterer yang tak lagi punya titik → kosongkan.
    for (const [key, cl] of clusterersRef.current) {
      if (!byClusterer.has(key) && sigRef.current.get(key)) {
        syncClusterer(cl, []);
        sigRef.current.set(key, "");
      }
    }

    // Jika sedang spiderfy tapi marker dibangun ulang (data refresh), pasang
    // kembali kipas pada objek baru; grup lenyap → tutup.
    if (spiderRef.current) {
      const still = groups.get(spiderRef.current.key);
      if (still && still.length > 1) spiderfy(spiderRef.current.key);
      else collapse();
    }
  }, [map, markerLib, points, onActivate, spiderfy, collapse]);

  // Tutup spiderfy saat klik peta kosong atau zoom berubah.
  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const l1 = map.addListener("click", () => collapse());
    const l2 = map.addListener("zoom_changed", () => collapse());
    return () => {
      l1.remove();
      l2.remove();
    };
  }, [map, collapse]);

  // Animasi pop-in: saat zoom menembus ambang uncluster (cluster pecah jadi
  // marker individual), putar ulang animasi marker yang kini tampil di viewport.
  // Hanya saat melintasi ambang (bukan tiap pan) agar tak mengganggu.
  useEffect(() => {
    if (!map || !window.google?.maps) return;
    let prev = map.getZoom() ?? 0;
    const l = map.addListener("idle", () => {
      const z = map.getZoom() ?? 0;
      const crossedIn = prev < UNCLUSTER_ZOOM && z >= UNCLUSTER_ZOOM;
      prev = z;
      if (!crossedIn) return;
      const b = map.getBounds();
      for (const m of markersRef.current.values()) {
        const pos = m.position as google.maps.LatLngLiteral | null;
        if (!pos || (b && !b.contains(pos))) continue;
        const el = markerEnterEl.get(m);
        if (el) playEnter(el);
      }
    });
    return () => l.remove();
  }, [map]);

  useEffect(() => {
    const existing = markersRef.current;
    const clusterers = clusterersRef.current;
    const sigs = sigRef.current;
    const vis = visRef.current;
    return () => {
      for (const cl of clusterers.values()) {
        cl.clearMarkers(true);
        cl.setMap(null);
      }
      clusterers.clear();
      sigs.clear();
      vis.clear();
      for (const marker of existing.values()) marker.map = null;
      existing.clear();
      popupRef.current?.setMap(null);
      popupRef.current = null;
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

/* ---------- Tooltip status kepadatan gerbang (persisten) ---------- */
/* Pill berwarna level (Lancar/Ramai/Padat/Kritis/…) yang SELALU tampil di atas
   marker gerbang terkait — tanpa perlu disorot. Satu OverlayView mengelola
   banyak pill agar hemat (reposisi massal tiap pan/zoom). */

export interface DensityTip {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  pct: string;
}

interface DensityOverlay extends google.maps.OverlayView {
  setItems(items: DensityTip[]): void;
  destroy(): void;
}

// Pill di SEBELAH KANAN marker dengan jarak (tanpa panah penunjuk). Background
// slate terang (kontras di atas peta biru gelap), teks nama level putih,
// persen + dot berwarna level.
const DENSITY_TIP_CSS =
  ".peta-density-tip{position:absolute;pointer-events:none;transform:translate(34px,-50%);" +
  "display:flex;align-items:center;gap:7px;padding:5px 11px;border-radius:10px;white-space:nowrap;" +
  "font:700 11.5px/1.15 'IBM Plex Sans',system-ui,sans-serif;background:rgba(27,42,70,.97);" +
  "border:1.5px solid var(--tip);box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 12px color-mix(in srgb,var(--tip) 55%,transparent);}" +
  ".peta-density-dot{width:8px;height:8px;border-radius:50%;background:var(--tip);box-shadow:0 0 8px var(--tip);flex:none;}" +
  ".peta-density-label{color:#eef4ff;}" +
  ".peta-density-pct{color:var(--tip);font-weight:800;filter:brightness(1.25);}";

function createDensityOverlay(map: google.maps.Map): DensityOverlay {
  class DensityLayer extends google.maps.OverlayView {
    private container: HTMLDivElement;
    private items: DensityTip[] = [];
    private nodes = new Map<string, HTMLDivElement>();
    constructor() {
      super();
      this.container = document.createElement("div");
      this.container.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:70;";
    }
    onAdd() {
      this.getPanes()?.floatPane.appendChild(this.container);
    }
    onRemove() {
      this.container.parentNode?.removeChild(this.container);
      this.nodes.clear();
    }
    setItems(items: DensityTip[]) {
      this.items = items;
      const keep = new Set(items.map((i) => i.id));
      for (const [id, el] of this.nodes) {
        if (!keep.has(id)) {
          el.remove();
          this.nodes.delete(id);
        }
      }
      for (const it of items) {
        let el = this.nodes.get(it.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "peta-density-tip";
          this.container.appendChild(el);
          this.nodes.set(it.id, el);
        }
        el.style.setProperty("--tip", it.color);
        el.innerHTML =
          `<span class="peta-density-dot"></span>` +
          `<span class="peta-density-label">${escapeHtml(it.label)}</span>` +
          `<span class="peta-density-pct">${escapeHtml(it.pct)}</span>`;
      }
      this.draw();
    }
    draw() {
      const proj = this.getProjection();
      if (!proj) return;
      // Offset-X harus sama dengan transform translateX pada .peta-density-tip.
      const X_OFFSET = 34;
      const GAP = 4;
      // Posisi dasar tiap pill (pusat vertikal di titik gerbang).
      const entries: { el: HTMLDivElement; x: number; y: number; w: number; h: number }[] = [];
      for (const it of this.items) {
        const el = this.nodes.get(it.id);
        if (!el) continue;
        const p = proj.fromLatLngToDivPixel(new google.maps.LatLng(it.lat, it.lng));
        if (!p) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        entries.push({ el, x: p.x, y: p.y, w: el.offsetWidth, h: el.offsetHeight });
      }
      // Urut atas→bawah (stabil) lalu tempatkan greedy: dorong TURUN pill yang
      // bertindihan dengan yang sudah ditempatkan (deklutter saat zoom out).
      entries.sort((a, b) => a.y - b.y || a.x - b.x);
      const placed: { left: number; top: number; w: number; h: number }[] = [];
      for (const e of entries) {
        const left = e.x + X_OFFSET;
        let top = e.y;
        for (let guard = 0; guard < 300; guard++) {
          let moved = false;
          for (const q of placed) {
            const overlapX = left < q.left + q.w + GAP && left + e.w + GAP > q.left;
            const overlapY = top - e.h / 2 < q.top + q.h / 2 + GAP && top + e.h / 2 + GAP > q.top - q.h / 2;
            if (overlapX && overlapY) {
              top = q.top + q.h / 2 + e.h / 2 + GAP; // tumpuk tepat di bawahnya
              moved = true;
            }
          }
          if (!moved) break;
        }
        e.el.style.left = `${e.x}px`;
        e.el.style.top = `${top}px`;
        placed.push({ left, top, w: e.w, h: e.h });
      }
    }
    destroy() {
      this.setMap(null);
    }
  }
  const o = new DensityLayer() as unknown as DensityOverlay;
  (o as google.maps.OverlayView).setMap(map);
  return o;
}

/** Tampilkan tooltip kepadatan persisten untuk daftar gerbang. Mati bila
 *  `visible` false (toggle "Status Kepadatan" di panel layer). */
export function useDensityTooltips(tips: DensityTip[], visible: boolean): void {
  const map = useMap();
  const ovRef = useRef<DensityOverlay | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    if (!styleRef.current) {
      const s = document.createElement("style");
      s.textContent = DENSITY_TIP_CSS;
      document.head.appendChild(s);
      styleRef.current = s;
    }
    if (!visible || tips.length === 0) {
      ovRef.current?.destroy();
      ovRef.current = null;
      return;
    }
    if (!ovRef.current) ovRef.current = createDensityOverlay(map);
    ovRef.current.setItems(tips);
  }, [map, visible, tips]);

  useEffect(() => {
    return () => {
      ovRef.current?.destroy();
      ovRef.current = null;
      styleRef.current?.remove();
      styleRef.current = null;
    };
  }, []);
}

/* ---------- Layer jaringan jalan tol (GeoJSON) ---------- */

type GeoCoord = [number, number]; // [lng, lat]
interface GeoFeature {
  geometry: { type: string; coordinates: GeoCoord[] | GeoCoord[][] };
  properties?: Record<string, unknown>;
}
interface GeoFC {
  features?: GeoFeature[];
}

// Cache per-URL agar GeoJSON hanya di-fetch sekali walau layer di-toggle berulang.
const geoCache = new Map<string, Promise<GeoFC>>();
function loadGeo(url: string): Promise<GeoFC> {
  let p = geoCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`gagal memuat ${url}: ${r.status}`);
        return r.json() as Promise<GeoFC>;
      })
      .catch((e) => {
        geoCache.delete(url); // izinkan coba ulang pada toggle berikutnya
        throw e;
      });
    geoCache.set(url, p);
  }
  return p;
}

// Simbol strip untuk garis putus-putus (ruas fungsional).
function dashIcons(color: string): google.maps.IconSequence[] {
  return [
    {
      icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: 1, strokeWeight: 3, scale: 3 },
      offset: "0",
      repeat: "14px"
    }
  ];
}

function lineStrings(geom: GeoFeature["geometry"]): GeoCoord[][] {
  if (geom.type === "LineString") return [geom.coordinates as GeoCoord[]];
  if (geom.type === "MultiLineString") return geom.coordinates as GeoCoord[][];
  return [];
}

export type RouteClickHandler = (lat: number, lng: number, info: { functional: boolean; name: string }) => void;

interface RouteObj {
  vis: google.maps.Polyline;
  hit: google.maps.Polyline;
  dashed: boolean;
  color: string;
}
interface LayerBuilt {
  routes: RouteObj[];
  labels: google.maps.Marker[];
}

const LABEL_MIN_ZOOM = 8; // tampilkan nama ruas mulai zoom ini (hindari tumpang-tindih saat overview)
const DASH_MIN_ZOOM = 10; // fungsional: putus-putus saat dekat; garis tipis solid saat zoom out

/** Setel gaya garis fungsional menurut zoom: solid tipis saat jauh (jaringan
 *  terlihat jelas), putus-putus saat dekat (tanda ruas fungsional). */
function styleFunctional(vis: google.maps.Polyline, color: string, zoom: number): void {
  if (zoom >= DASH_MIN_ZOOM) {
    vis.setOptions({ strokeOpacity: 0, strokeWeight: 3, icons: dashIcons(color) });
  } else {
    vis.setOptions({ strokeOpacity: 0.85, strokeWeight: 2, icons: [] });
  }
}

/** Render ruas jalan tol (HK saja) dari GeoJSON sebagai polyline Google Maps,
 *  solid berwarna untuk operasional & fungsional adaptif-zoom (solid tipis saat
 *  jauh / putus-putus saat dekat), dengan nama ruas sebagai label peta. */
export function useRouteLayers(visible: Record<RouteKey, boolean>, onRouteClick?: RouteClickHandler): void {
  const map = useMap();
  const builtRef = useRef<Map<RouteKey, LayerBuilt>>(new Map());
  const tipRef = useRef<HTMLDivElement | null>(null);
  const styleElRef = useRef<HTMLStyleElement | null>(null);
  const clickRef = useRef(onRouteClick);
  clickRef.current = onRouteClick;

  // Terapkan gaya bergantung zoom (dash fungsional + visibilitas label).
  const applyZoom = useCallback(() => {
    if (!map) return;
    const zoom = map.getZoom() ?? 0;
    const showLabels = zoom >= LABEL_MIN_ZOOM;
    for (const lb of builtRef.current.values()) {
      for (const r of lb.routes) if (r.dashed) styleFunctional(r.vis, r.color, zoom);
      for (const m of lb.labels) m.setVisible(showLabels);
    }
  }, [map]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const built = builtRef.current;
    let cancelled = false;

    // CSS label ruas (teks ber-outline agar terbaca tanpa kotak yg menutupi garis).
    if (!styleElRef.current) {
      const s = document.createElement("style");
      s.textContent =
        ".peta-road-label{text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.85);letter-spacing:.2px;white-space:nowrap}" +
        ".peta-road-label-right{transform:translateX(calc(50% + 10px))}" +
        ".peta-road-label-left{transform:translateX(calc(-50% - 10px))}";
      document.head.appendChild(s);
      styleElRef.current = s;
    }

    // Tooltip modern (pill mengikuti kursor) menggantikan InfoWindow bawaan.
    const ensureTip = () => {
      if (!tipRef.current) {
        const el = document.createElement("div");
        el.style.cssText =
          "position:fixed;left:0;top:0;z-index:9999;pointer-events:none;opacity:0;" +
          "transform:translate(-50%,calc(-100% - 14px));transition:opacity .12s ease;" +
          "padding:5px 10px;border-radius:8px;white-space:nowrap;" +
          "font-size:12px;font-weight:600;line-height:1.2;" +
          "color:var(--text,#e6edf7);background:var(--surface-1,#0f1b30);" +
          "border:1px solid var(--line-strong,#2a3b57);box-shadow:0 8px 24px rgba(0,0,0,.4);";
        document.body.appendChild(el);
        tipRef.current = el;
      }
      return tipRef.current;
    };
    const showTip = (name: string, x: number, y: number) => {
      if (markerHovering) return; // kursor di atas marker/cluster → jangan tumpuk
      const el = ensureTip();
      el.textContent = name;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = "1";
    };
    const moveTip = (x: number, y: number) => {
      const el = tipRef.current;
      if (!el) return;
      if (markerHovering) {
        el.style.opacity = "0";
        return;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const hideTip = () => {
      if (tipRef.current) tipRef.current.style.opacity = "0";
    };
    // Daftarkan agar marker-hover bisa menyembunyikan tooltip ruas seketika.
    routeHideTip = hideTip;

    for (const layer of ROUTE_LAYERS) {
      const on = visible[layer.key];
      const existing = built.get(layer.key);

      if (!on) {
        if (existing) {
          for (const r of existing.routes) {
            r.vis.setMap(null);
            r.hit.setMap(null);
          }
          for (const m of existing.labels) m.setMap(null);
        }
        continue;
      }
      // Sudah dibangun → tampilkan ulang + selaraskan gaya zoom.
      if (existing) {
        for (const r of existing.routes) {
          r.vis.setMap(map);
          r.hit.setMap(map);
        }
        for (const m of existing.labels) m.setMap(map);
        applyZoom();
        continue;
      }
      // Belum dibangun → fetch + bangun sekali.
      loadGeo(layer.url)
        .then((fc) => {
          if (cancelled || !visible[layer.key]) return;
          const routes: RouteObj[] = [];
          const labels: google.maps.Marker[] = [];
          const zoom = map.getZoom() ?? 0;
          const seenLabel = new Set<string>();
          // bbox layer (utk satu label nama ruas fungsional di tengah).
          let bMinLat = 90,
            bMaxLat = -90,
            bMinLng = 180,
            bMaxLng = -180;

          const makeLabel = (text: string, lat: number, lng: number, dashed: boolean) => {
            const marker = new google.maps.Marker({
              position: { lat, lng },
              map,
              clickable: false,
              zIndex: 9,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0.01, fillOpacity: 0, strokeOpacity: 0 },
              label: {
                text,
                color: dashed ? "#fecdd3" : "#e4ecf8",
                fontSize: "11px",
                fontWeight: "600",
                className: `peta-road-label ${isLabelRight(text) ? "peta-road-label-right" : "peta-road-label-left"}`
              }
            });
            marker.setVisible(zoom >= LABEL_MIN_ZOOM);
            labels.push(marker);
          };

          for (const ft of fc.features ?? []) {
            const st = routeFeatureStyle(ft.properties);
            const name = String(ft.properties?.name ?? ft.properties?.alt_name ?? layer.name);
            const parts = lineStrings(ft.geometry);

            for (const coords of parts) {
              const path = coords.map(([lng, lat]) => ({ lat, lng }));
              if (path.length < 2) continue;
              const baseWeight = st.dashed ? 3 : 3.5;
              const vis = new google.maps.Polyline({
                path,
                map,
                strokeColor: st.color,
                strokeOpacity: st.dashed ? 0 : 1,
                strokeWeight: baseWeight,
                icons: st.dashed ? dashIcons(st.color) : undefined,
                zIndex: st.dashed ? 6 : 5,
                clickable: false
              });
              if (st.dashed) styleFunctional(vis, st.color, zoom);
              const hit = new google.maps.Polyline({
                path,
                map,
                strokeColor: "#000000",
                strokeOpacity: 0,
                strokeWeight: 18,
                zIndex: 8,
                clickable: true
              });
              const domXY = (e: google.maps.PolyMouseEvent) => e.domEvent as MouseEvent | undefined;
              hit.addListener("mouseover", (e: google.maps.PolyMouseEvent) => {
                vis.setOptions({ strokeWeight: (vis.get("strokeWeight") as number) + 2 });
                const d = domXY(e);
                if (d) showTip(name, d.clientX, d.clientY);
              });
              hit.addListener("mousemove", (e: google.maps.PolyMouseEvent) => {
                const d = domXY(e);
                if (d) moveTip(d.clientX, d.clientY);
              });
              hit.addListener("mouseout", () => {
                // kembalikan ke gaya normal sesuai jenis & zoom
                if (st.dashed) styleFunctional(vis, st.color, map.getZoom() ?? 0);
                else vis.setOptions({ strokeWeight: baseWeight });
                hideTip();
              });
              hit.addListener("click", (e: google.maps.PolyMouseEvent) => {
                if (e.latLng) clickRef.current?.(e.latLng.lat(), e.latLng.lng(), { functional: st.dashed, name });
              });
              routes.push({ vis, hit, dashed: st.dashed, color: st.color });
              // Perluas bbox layer.
              for (const [lng, lat] of coords) {
                if (lat < bMinLat) bMinLat = lat;
                if (lat > bMaxLat) bMaxLat = lat;
                if (lng < bMinLng) bMinLng = lng;
                if (lng > bMaxLng) bMaxLng = lng;
              }
            }

            // Operasional: label hanya untuk ruas HK yang punya NAMA asli (bukan
            // fallback "Tol Operasional"), satu per nama (dedup). Vektor non-HK &
            // tanpa nama tetap tampil tanpa label.
            const roadName = String(ft.properties?.name ?? ft.properties?.alt_name ?? "").trim();
            if (layer.kind === "operational" && roadName && isHutamaKarya(ft.properties) && !seenLabel.has(roadName)) {
              const longest = parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0] ?? []);
              if (longest.length > 0) {
                seenLabel.add(roadName);
                const [lng, lat] = longest[Math.floor(longest.length / 2)];
                makeLabel(roadName, lat, lng, st.dashed);
              }
            }
          }

          // Fungsional: SATU label (nama ruas layer) di tengah jaringan,
          // bukan per-segmen (menghindari tumpukan nama OSM).
          if (layer.kind === "functional" && bMaxLat >= bMinLat) {
            makeLabel(layer.name, (bMinLat + bMaxLat) / 2, (bMinLng + bMaxLng) / 2, true);
          }

          built.set(layer.key, { routes, labels });
        })
        .catch((err) => console.error("[peta] route layer:", err));
    }

    return () => {
      cancelled = true;
    };
  }, [map, visible, applyZoom]);

  // Pantau zoom → sesuaikan dash fungsional & visibilitas label.
  useEffect(() => {
    if (!map) return;
    const l = map.addListener("zoom_changed", applyZoom);
    return () => l.remove();
  }, [map, applyZoom]);

  // Bersihkan saat unmount.
  useEffect(() => {
    const built = builtRef.current;
    return () => {
      for (const lb of built.values()) {
        for (const r of lb.routes) {
          r.vis.setMap(null);
          r.hit.setMap(null);
        }
        for (const m of lb.labels) m.setMap(null);
      }
      built.clear();
      tipRef.current?.remove();
      tipRef.current = null;
      styleElRef.current?.remove();
      styleElRef.current = null;
      routeHideTip = null;
    };
  }, []);
}
