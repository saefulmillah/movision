/* Marker peta: badge lingkaran berwarna + glyph Lucide putih, sebagai SVG data-URI
   (dibangun runtime, tanpa file/aset baru). Konsisten dengan marker GPS. */

// Inner path Lucide (viewBox 24×24) untuk ikon legend.
const GLYPHS: Record<string, string> = {
  cctv: '<path d="M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97"/><path d="M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z"/><path d="M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15"/><path d="M2 21v-4"/><path d="M7 9h.01"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  "share-2": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  "building-2": '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>'
};

export interface MarkerIconOptions {
  /** Cincin luar penekanan (mis. untuk SOS). */
  ring?: boolean;
  ringColor?: string;
}

/** Bangun data-URI marker badge. `glyph` = key GLYPHS, `color` = warna badge. */
export function markerDataUri(glyph: string, color: string, opts: MarkerIconOptions = {}): string {
  const inner = GLYPHS[glyph] ?? "";
  const ring = opts.ring
    ? `<circle cx="20" cy="20" r="18.5" fill="none" stroke="${opts.ringColor ?? color}" stroke-width="2" opacity="0.45"/>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    ring +
    `<circle cx="20" cy="20" r="16" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>` +
    `<g transform="translate(10.4,10.4) scale(0.8)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
}

export interface LabeledIcon {
  url: string;
  size: [number, number];
  anchor: [number, number];
}

/** Marker badge + label teks ber-outline di bawahnya (mis. nama gerbang). */
export function labeledMarkerDataUri(glyph: string, color: string, label: string): LabeledIcon {
  const inner = GLYPHS[glyph] ?? "";
  const text = escapeXml(label);
  const w = Math.max(48, Math.ceil(text.length * 6.6) + 16);
  const h = 50;
  const cx = w / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<circle cx="${cx}" cy="16" r="13" fill="${color}" stroke="#ffffff" stroke-width="2.2"/>` +
    `<g transform="translate(${cx - 9},7) scale(0.75)" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>` +
    `<text x="${cx}" y="41" text-anchor="middle" font-family="'IBM Plex Sans',system-ui,sans-serif" font-size="11" font-weight="700" ` +
    `fill="#ffffff" stroke="#10233f" stroke-width="3.2" paint-order="stroke" style="paint-order:stroke">${text}</text>` +
    `</svg>`;
  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size: [w, h], anchor: [cx, 16] };
}

// Warna marker per keadaan.
export const MARKER_COLORS = {
  gray: "#94A3B8",
  cctv: "#34D399",
  vms: "#FBBF24",
  fo: "#22D3EE",
  gate: "#F43F5E",
  weather: "#38BDF8",
  sos: "#F43F5E"
};
