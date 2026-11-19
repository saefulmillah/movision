/* Konfigurasi layer jaringan jalan tol (GeoJSON) untuk Peta Aset.
   Dibedakan atas status operasional vs fungsional berdasarkan properti
   `highway` tiap fitur OSM:
     - "motorway"     → ruas OPERASIONAL  → warna beragam, garis solid
     - "construction" → ruas FUNGSIONAL   → merah, garis putus-putus */

export type RouteKey = "trans_operasional" | "lingkar_pekanbaru" | "palembang_betung";

export interface RouteLayerMeta {
  key: RouteKey;
  name: string;
  desc: string;
  /** URL GeoJSON (disajikan dari movision/public/geojson). */
  url: string;
  /** Jenis dominan ruas pada file ini (untuk legenda panel). */
  kind: "operational" | "functional";
  defaultOn: boolean;
}

export const ROUTE_LAYERS: RouteLayerMeta[] = [
  {
    key: "trans_operasional",
    name: "Tol Operasional",
    desc: "Ruas beroperasi (Trans Sumatera)",
    url: "/geojson/trans-sumatera-operasional.geojson",
    kind: "operational",
    defaultOn: true
  },
  {
    key: "lingkar_pekanbaru",
    name: "Lingkar Pekanbaru",
    desc: "Ruas fungsional (konstruksi)",
    url: "/geojson/lingkar-pekanbaru.geojson",
    kind: "functional",
    defaultOn: false
  },
  {
    key: "palembang_betung",
    name: "Palembang–Betung",
    desc: "Ruas fungsional (konstruksi)",
    url: "/geojson/palembang-betung.geojson",
    kind: "functional",
    defaultOn: false
  }
];

/** Warna ruas fungsional (seragam, merah). */
export const FUNCTIONAL_COLOR = "#F43F5E";

/** Palet warna beragam untuk ruas operasional (diberi per nama ruas). */
const ROAD_PALETTE = [
  "#38BDF8", // sky
  "#34D399", // green
  "#FBBF24", // amber
  "#A78BFA", // violet
  "#22D3EE", // cyan
  "#F472B6", // pink
  "#4ADE80", // lime
  "#FB923C", // orange
  "#60A5FA", // blue
  "#C084FC", // purple
  "#2DD4BF", // teal
  "#FACC15", // yellow
  "#818CF8", // indigo
  "#F87171" // soft red (bukan merah fungsional)
];

/** Hash string → indeks palet yang stabil (ruas yang sama = warna sama). */
function paletteIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % len;
}

export interface RouteStyle {
  color: string;
  dashed: boolean;
}

/* --- Filter "ruas milik Hutama Karya saja" ---
   Operator OSM mayoritas kosong, jadi: buang bila operator eksplisit non-HK,
   atau namanya ada di denylist ruas non-HK (Jasa Marga/JMKT). Sisanya (JTTS)
   dianggap HK. Daftar mudah disunting bila ada koreksi. */
const NON_HK_OPERATOR = /waskita|jasa\s*marga|jasamarga|jmkt|kualanamu|nusantara/i;
const NON_HK_NAME = ["belmera", "medan tebing tinggi", "sei ular", "kuala namu", "kualanamu"];

export function isHutamaKarya(props: Record<string, unknown> | undefined): boolean {
  const op = String(props?.operator ?? "");
  if (op && NON_HK_OPERATOR.test(op)) return false;
  const name = String(props?.name ?? props?.alt_name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (NON_HK_NAME.some((d) => name.includes(d))) return false;
  return true;
}

/* Ruas yang label-nya diletakkan di SEBELAH KANAN garis (sisanya kiri).
   Daftar sesuai permintaan: Bakter, Terpeka, Betung–Tempino–Jambi, Dumai–Parapat,
   Pekanbaru–Dumai, Rengat–Pekanbaru, Kuala Tanjung–Tebing Tinggi, Kisaran–Tebing
   Tinggi, Binjai–Langsa, Medan–Binjai. */
const LABEL_RIGHT = [
  "bakauheni",
  "terbanggi",
  "betung",
  "bayung lencir",
  "tempino",
  "parapat",
  "dumai",
  "rengat",
  "kuala tanjung",
  "kisaran",
  "binjai"
];

/** true bila label ruas ini diletakkan di kanan garis. */
export function isLabelRight(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return LABEL_RIGHT.some((k) => n.includes(k));
}

/** Tentukan gaya garis per fitur berdasarkan status jalannya. */
export function routeFeatureStyle(props: Record<string, unknown> | undefined): RouteStyle {
  const hw = String(props?.highway ?? "");
  // Fungsional / dalam konstruksi → merah putus-putus.
  if (hw === "construction") return { color: FUNCTIONAL_COLOR, dashed: true };
  // Operasional → warna beragam per nama ruas.
  const seed = String(props?.name ?? props?.alt_name ?? props?.ref ?? "tol");
  return { color: ROAD_PALETTE[paletteIndex(seed, ROAD_PALETTE.length)], dashed: false };
}
