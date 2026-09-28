import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("src/assets/map-icons");
const LUCIDE_DIR = resolve("node_modules/lucide-static/icons");

const statuses = {
  normal: {
    key: "normal",
    label: "Normal",
    color: "#16A34A",
    accent: "#DCFCE7",
    pulse: false
  },
  offline: {
    key: "offline",
    label: "Error / Offline",
    color: "#9CA3AF",
    accent: "#E5E7EB",
    pulse: false
  },
  "sos-created": {
    key: "sos-created",
    label: "SOS Created",
    color: "#DC2626",
    accent: "#FEE2E2",
    pulse: false
  },
  "sos-dispatched": {
    key: "sos-dispatched",
    label: "SOS Dispatched",
    color: "#F97316",
    accent: "#FFEDD5",
    pulse: true
  }
};

const icons = {
  cctv: {
    label: "CCTV",
    lucide: "cctv"
  },
  vms: {
    label: "VMS",
    lucide: "monitor"
  },
  wim: {
    label: "WIM",
    lucide: "scale"
  },
  radio: {
    label: "Radio",
    lucide: "radio"
  },
  "gerbang-tol": {
    label: "Gerbang Tol",
    lucide: "waypoints"
  },
  cuaca: {
    label: "Cuaca",
    lucide: "cloud-sun"
  },
  sos: {
    label: "SOS",
    lucide: "siren"
  },
  patroli: {
    label: "Patroli",
    lucide: "car-front",
    badge: "siren"
  },
  rescue: {
    label: "Rescue",
    lucide: "truck",
    badge: "life-buoy"
  },
  ambulance: {
    label: "Ambulance",
    lucide: "ambulance"
  },
  pjr: {
    label: "PJR",
    lucide: "car-front",
    badge: "shield-check"
  },
  derek: {
    label: "Derek / Towing",
    lucide: "truck",
    badge: "wrench"
  },
  "water-tank": {
    label: "Water Tank",
    lucide: "truck",
    badge: "droplet"
  },
  skylift: {
    label: "Skylift",
    lucide: "forklift",
    badge: "arrow-up"
  },
  roadsweeper: {
    label: "Road Sweeper",
    lucide: "truck",
    badge: "brush"
  },
  shuttle: {
    label: "Shuttle",
    lucide: "bus-front"
  },
  inspector: {
    label: "Inspector",
    lucide: "car-front",
    badge: "clipboard-list"
  },
  kamtib: {
    label: "Kamtib",
    lucide: "car-front",
    badge: "shield-check"
  },
  general: {
    label: "General",
    lucide: "car-front"
  }
};

function pulseMarkup(color) {
  return `
    <circle cx="32" cy="32" r="24" fill="none" stroke="${color}" stroke-width="2" opacity="0.48">
      <animate attributeName="r" values="24;31;24" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.48;0;0.48" dur="1.8s" repeatCount="indefinite" />
    </circle>
    <circle cx="32" cy="32" r="25" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.3">
      <animate attributeName="r" values="25;34;25" dur="1.8s" begin="0.35s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0;0.3" dur="1.8s" begin="0.35s" repeatCount="indefinite" />
    </circle>
  `;
}

const lucideCache = new Map();

function lucideMarkup(iconName) {
  if (!lucideCache.has(iconName)) {
    const source = readFileSync(resolve(LUCIDE_DIR, `${iconName}.svg`), "utf8");
    const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);

    if (!match) {
      throw new Error(`Unable to read Lucide SVG: ${iconName}`);
    }

    lucideCache.set(iconName, match[1].trim());
  }

  return lucideCache.get(iconName);
}

function lucideSvg(iconName, x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${lucideMarkup(iconName)}
  </svg>`;
}

function markerMarkup(icon, status, includePulse = true) {
  const vehicleGlyph = icon.badge
    ? lucideSvg(icon.lucide, 13, 19, 31)
    : lucideSvg(icon.lucide, 16, 16, 32);
  const badge = icon.badge
    ? `<circle cx="43" cy="21" r="9" fill="#FFFFFF" stroke="${status.color}" stroke-width="2" />
  ${lucideSvg(icon.badge, 36.5, 14.5, 13)}`
    : "";

  return `
  ${includePulse && status.pulse ? pulseMarkup(status.color) : ""}
  <circle cx="32" cy="32" r="23" fill="${status.color}" opacity="0.14" />
  <circle cx="32" cy="32" r="20.5" fill="#FFFFFF" filter="url(#marker-shadow)" />
  <circle cx="32" cy="32" r="20.5" stroke="${status.color}" stroke-width="3" />
  <circle cx="32" cy="32" r="16.5" fill="${status.accent}" opacity="0.5" />
  <g color="${status.color}">
    ${vehicleGlyph}
    ${badge}
  </g>`;
}

function defsMarkup() {
  return `<defs>
    <filter id="marker-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#0F172A" flood-opacity="0.24" />
    </filter>
  </defs>`;
}

function buildSvg(icon, status) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${icon.label} ${status.label}">
  <title>${icon.label} - ${status.label}</title>
  <!-- Icon path supplied by Lucide v0.469.0, ISC License. -->
  ${defsMarkup()}
  ${markerMarkup(icon, status)}
</svg>
`;
}

function buildPreviewSvg() {
  const tiles = Object.values(icons).map((icon, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 34 + column * 150;
    const y = 58 + row * 120;
    return `<g transform="translate(${x} ${y}) scale(1.15)">
      ${markerMarkup(icon, statuses.normal, false)}
    </g>
    <text x="${x + 37}" y="${y + 78}" text-anchor="middle" class="label">${icon.label}</text>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="820" height="590" viewBox="0 0 820 590" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${defsMarkup()}
  <rect width="820" height="590" rx="24" fill="#F4F7FA" />
  <path d="M0 112H820M0 232H820M0 352H820M0 472H820" stroke="#DCE4EA" stroke-width="1" />
  <text x="34" y="32" class="title">MOVISION / OPERATIONAL MAP ICONS</text>
  <text x="34" y="50" class="subtitle">Status ring: normal green · offline gray · SOS created red · dispatched orange pulse</text>
  <style>
    .title { fill: #0F172A; font: 700 13px Arial, sans-serif; letter-spacing: 1.2px; }
    .subtitle { fill: #64748B; font: 11px Arial, sans-serif; }
    .label { fill: #334155; font: 600 11px Arial, sans-serif; }
  </style>
  ${tiles.join("\n  ")}
</svg>\n`;
}

function buildManifest() {
  return {
    statuses: Object.values(statuses).map(({ key, label, color }) => ({ key, label, color })),
    icons: Object.entries(icons).map(([key, value]) => ({
      key,
      label: value.label,
      files: Object.keys(statuses).map((statusKey) => `${key}/${statusKey}.svg`)
    }))
  };
}

mkdirSync(OUT_DIR, { recursive: true });

for (const [iconKey, icon] of Object.entries(icons)) {
  const iconDir = resolve(OUT_DIR, iconKey);
  mkdirSync(iconDir, { recursive: true });

  for (const status of Object.values(statuses)) {
    writeFileSync(resolve(iconDir, `${status.key}.svg`), buildSvg(icon, status), "utf8");
  }
}

writeFileSync(resolve(OUT_DIR, "manifest.json"), `${JSON.stringify(buildManifest(), null, 2)}\n`, "utf8");
writeFileSync(resolve(OUT_DIR, "preview.svg"), buildPreviewSvg(), "utf8");
writeFileSync(
  resolve(OUT_DIR, "README.md"),
  `# Monitoring SVG Icon Set

Set ikon SVG untuk aset dan perangkat operasional Movision.

## Status warna

- \`normal\`: hijau (\`#16A34A\`)
- \`offline\`: abu-abu (\`#9CA3AF\`)
- \`sos-created\`: merah (\`#DC2626\`)
- \`sos-dispatched\`: oranye dengan animasi denyut (\`#F97316\`)

## Struktur file

Setiap jenis aset memiliki 4 varian status:

\`\`\`
src/assets/map-icons/<jenis-aset>/<status>.svg
\`\`\`

Contoh:

\`\`\`
src/assets/map-icons/cctv/normal.svg
src/assets/map-icons/cctv/offline.svg
src/assets/map-icons/cctv/sos-created.svg
src/assets/map-icons/cctv/sos-dispatched.svg
\`\`\`
`,
  "utf8"
);
