/* ============================================================
   Logika tampilan tabel Laba Rugi (baris akun, kolom entitas, format).
   Dipakai slide Presentasi; sumber data = lib/labaRugi (getPeriod).
   Konstanta mengikuti LabaRugiPage (Konsolidasi / Per Regional / Per Ruas).
   ============================================================ */
import type { Cell, EntityData, PeriodData } from "@/types/labaRugi";

export type LrView = "konsol" | "regional" | "ruas";

export interface RowDef {
  id: string;
  label: string;
  type: "section" | "sub" | "total" | "hpp";
}

export const ROWS: RowDef[] = [
  { id: "pend_usaha", label: "Pend. Usaha", type: "section" },
  { id: "tol", label: "Tol", type: "sub" },
  { id: "usaha_lainnya", label: "Usaha Lainnya", type: "sub" },
  { id: "elektronifikasi", label: "Elektronifikasi", type: "sub" },
  { id: "beban_langsung", label: "Beban Langsung", type: "section" },
  { id: "beban_i", label: "Beban I", type: "sub" },
  { id: "beban_ii", label: "Beban II", type: "sub" },
  { id: "beban_iii", label: "Beban III", type: "sub" },
  { id: "laba_operasi", label: "Laba Operasi", type: "total" },
  { id: "beban_usaha", label: "Beban Usaha", type: "section" },
  { id: "bunga", label: "Bunga", type: "sub" },
  { id: "pajak_tangguhan", label: "Pajak Tangguhan", type: "sub" },
  { id: "eat", label: "EAT", type: "total" },
  { id: "ebitda", label: "EBITDA", type: "total" },
  { id: "hpp", label: "HPP (%)", type: "hpp" }
];

interface RegionDef {
  id: string;
  label: string;
}
const REGIONS: RegionDef[] = [
  { id: "JKT", label: "JKT" },
  { id: "SUMBAGSEL", label: "REG SUMBAGSEL" },
  { id: "SUMBAGTENG", label: "REG SUMBAGTENG" },
  { id: "SUMBAGUT", label: "REG SUMBAGUT" },
  { id: "JTTS", label: "JTTS" },
  { id: "PBBL", label: "PBBL" }
];

interface RuasDef {
  id: string;
  grp: string;
  always?: boolean;
}
const RUAS: RuasDef[] = [
  { id: "DIVISI", grp: "DIVISI", always: true },
  { id: "JORR S", grp: "JKT" },
  { id: "ATP", grp: "JKT" },
  { id: "TERPEKA", grp: "SUMBAGSEL" },
  { id: "PALINDRA", grp: "SUMBAGSEL" },
  { id: "INPRABU", grp: "SUMBAGSEL" },
  { id: "BENGTABA", grp: "SUMBAGSEL" },
  { id: "PALTUNG", grp: "SUMBAGSEL" },
  { id: "PERMAI", grp: "SUMBAGTENG" },
  { id: "PEKBANGPAR", grp: "SUMBAGTENG" },
  { id: "PACIN", grp: "SUMBAGTENG" },
  { id: "LINGKAR PKU", grp: "SUMBAGTENG" },
  { id: "SIBANCEH", grp: "SUMBAGUT" },
  { id: "BINBRAN", grp: "SUMBAGUT" },
  { id: "INKIS", grp: "SUMBAGUT" },
  { id: "JTTS", grp: "JTTS", always: true },
  { id: "PBBL", grp: "PBBL", always: true }
];

const TINT_KEYS = ["JKT", "SUMBAGSEL", "SUMBAGTENG", "SUMBAGUT", "JTTS", "PBBL", "DIVISI"];
function tintOf(key: string): string {
  return TINT_KEYS.includes(key) ? key : "JKT";
}

export interface FmtOut {
  t: string;
  neg: boolean;
}
export function fmtNum(v: number | null | undefined): FmtOut {
  if (v == null) return { t: "–", neg: false };
  // Presentasi: nilai dibulatkan ke bilangan bulat (tanpa desimal).
  const r = Math.round(v);
  if (r === 0) return { t: "–", neg: false };
  const neg = r < 0;
  const s = Math.abs(r).toLocaleString("en-US");
  return { t: neg ? `(${s})` : s, neg };
}
export function fmtPct(v: number | null | undefined): FmtOut {
  if (v == null) return { t: "–", neg: false };
  // Presentasi: persentase dibulatkan ke bilangan bulat.
  return { t: `${Math.round(v)}%`, neg: v > 100 };
}

function hppOf(d: EntityData): Cell {
  const bl = d.beban_langsung;
  const pu = d.pend_usaha;
  const f = (b?: number | null, p?: number | null) => (p == null || p === 0 || b == null ? null : (b / p) * 100);
  return [f(bl?.[0], pu?.[0]), f(bl?.[1], pu?.[1])];
}
export function cellVal(d: EntityData, rowId: string): Cell {
  if (rowId === "hpp") return hppOf(d);
  return d[rowId] ?? [null, null];
}

export interface LrColumn {
  label: string;
  tint: string;
  data: EntityData;
  /** Kunci entitas/konsol untuk lookup breakdown (konsol: key dgn tahun; entity: kode). */
  code: string;
  /** Label sub-kolom realisasi: "REAL" (bulan sudah terealisasi) atau "RKK" (bulan berjalan/proyeksi). */
  realLabel: string;
}

/** Uraian (account_id) yang bisa di-expand jadi breakdown detail. */
export const EXPANDABLE_PARENTS = ["beban_i", "beban_ii", "beban_iii", "beban_usaha", "bunga", "pajak_tangguhan"];

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
/** Urutan kronologis dari label konsol ("Oktober 2026" / "SD Oktober 2026"); -1 bila tak terbaca. */
function monthOrder(key: string): number {
  const m = /([A-Za-z]+)\s+(\d{4})/.exec(key.replace(/^SD\s+/i, ""));
  if (!m) return -1;
  const mi = MONTH_NAMES.findIndex((n) => n.toLowerCase() === m[1].toLowerCase());
  return mi < 0 ? -1 : Number(m[2]) * 12 + mi;
}

/** Bangun kolom untuk sebuah view dari PeriodData nyata (mengikuti LabaRugiPage). */
export function buildColumns(data: PeriodData, view: LrView): LrColumn[] {
  const has = (code: string) => data.entities[code] !== undefined;
  if (view === "konsol") {
    // Sama seperti tab "Konsolidasi" LabaRugiPage: kolom = blok konsol multi-periode
    // (mis. "Agustus 2026", "SD Agustus 2026", ...); tahun dilepas dari label.
    // Bulan TERBARU = bulan berjalan/proyeksi → sub-kolom realisasi diberi label "RKK".
    const keys = Object.keys(data.konsol);
    const latest = Math.max(-1, ...keys.map(monthOrder));
    // Warna kolom berbeda-beda per periode (biar mudah dibedakan).
    const KONSOL_TINTS = ["JKT", "SUMBAGTENG", "SUMBAGSEL", "SUMBAGUT"];
    return keys.map((k, i) => ({
      label: k.replace(/ 20\d\d$/, ""),
      tint: KONSOL_TINTS[i % KONSOL_TINTS.length],
      data: data.konsol[k],
      code: k,
      realLabel: monthOrder(k) === latest && latest >= 0 ? "RKK" : "REAL"
    }));
  }
  if (view === "regional") {
    return REGIONS.filter((r) => has(r.id)).map((r) => ({ label: r.label, tint: tintOf(r.id), data: data.entities[r.id], code: r.id, realLabel: "REAL" }));
  }
  // ruas — sembunyikan PALTUNG (mengikuti default LabaRugiPage), tampilkan yang ada datanya.
  return RUAS.filter((x) => x.id !== "PALTUNG" && has(x.id)).map((x) => ({
    label: x.id,
    tint: tintOf(x.grp),
    data: data.entities[x.id],
    code: x.id,
    realLabel: "REAL"
  }));
}

export const LR_FOOTNOTES: Record<LrView, string> = {
  konsol: "",
  regional: "JTTS sudah mencakup 3 regional Sumatra (SUMBAGSEL + SUMBAGTENG + SUMBAGUT).",
  ruas: "Ruas dikelompokkan per regional (warna). JTTS = SUMBAGSEL + SUMBAGTENG + SUMBAGUT."
};

export const LR_VIEW_TITLE: Record<LrView, string> = {
  konsol: "Laba Rugi — Konsolidasi",
  regional: "Laba Rugi — Per Regional",
  ruas: "Laba Rugi — Per Ruas"
};
