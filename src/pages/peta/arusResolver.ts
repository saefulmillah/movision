/* Resolusi klik vektor ruas → arah (koridor) arus lalin.
   Data arus dikunci per `arah`/gerbang (lihat trafficFlow), tanpa koordinat.
   Jembatannya: gerbang PETA (punya lat/lng + branch_id) dicocokkan NAMA-nya ke
   pemetaan gerbang→arah (/arah-map). Pemetaan diturunkan di runtime agar tahan
   beda environment (branch_id bisa beda antar-DB). */

import type { GateAlert } from "@/types/monitoring";
import type { ArahMapItem } from "@/lib/trafficFlow";

/** Normalisasi nama gerbang agar cocok lintas sumber. */
export function normGate(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/gerbang|exit|\bgt\b|\bgb\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ArahIndex {
  /** normName gerbang → arah (dari /arah-map). */
  byGate: Map<string, string>;
}

export function buildArahIndex(items: ArahMapItem[] | undefined): ArahIndex {
  const byGate = new Map<string, string>();
  for (const it of items ?? []) {
    if (it.is_active === false) continue;
    const k = normGate(it.gb_tujuan);
    if (k) byGate.set(k, it.arah);
  }
  return { byGate };
}

/** Arah untuk satu nama gerbang: exact → fallback "mengandung" (kunci terpanjang). */
function arahForGateName(gateName: string, idx: ArahIndex): string | null {
  const k = normGate(gateName);
  if (!k) return null;
  const exact = idx.byGate.get(k);
  if (exact) return exact;
  let best: string | null = null;
  let bestLen = 0;
  for (const [kk, a] of idx.byGate) {
    if (!kk || kk.length < 4) continue;
    if ((kk.includes(k) || k.includes(kk)) && kk.length > bestLen) {
      best = a;
      bestLen = kk.length;
    }
  }
  return best;
}

/** Arah dominan per branch_id (voting dari semua gerbang branch itu). */
export function buildBranchArah(gates: GateAlert[], idx: ArahIndex): Map<number, string> {
  const votes = new Map<number, Map<string, number>>();
  for (const g of gates) {
    if (g.branch_id == null) continue;
    const a = arahForGateName(g.gate_name, idx);
    if (!a) continue;
    const m = votes.get(g.branch_id) ?? new Map<string, number>();
    m.set(a, (m.get(a) ?? 0) + 1);
    votes.set(g.branch_id, m);
  }
  const out = new Map<number, string>();
  for (const [bid, m] of votes) {
    let top = "";
    let n = -1;
    for (const [a, c] of m) if (c > n) [top, n] = [a, c];
    if (top) out.set(bid, top);
  }
  return out;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ArahResolution {
  arah: string;
  gateName: string;
  branchId: number | null;
  distanceKm: number;
}

/** Klik (lat,lng) → gerbang terdekat → arah. null bila tak ada gerbang dalam
 *  radius wajar atau gerbang/branch-nya tak terpetakan ke arah. */
export function resolveClickToArah(
  lat: number,
  lng: number,
  gates: GateAlert[],
  idx: ArahIndex,
  branchArah: Map<number, string>,
  maxKm = 80
): ArahResolution | null {
  let nearest: GateAlert | null = null;
  let nd = Infinity;
  for (const g of gates) {
    if (g.lat == null || g.lng == null) continue;
    const d = haversineKm(lat, lng, g.lat, g.lng);
    if (d < nd) {
      nd = d;
      nearest = g;
    }
  }
  if (!nearest || nd > maxKm) return null;
  const arah =
    arahForGateName(nearest.gate_name, idx) ??
    (nearest.branch_id != null ? branchArah.get(nearest.branch_id) : undefined) ??
    null;
  if (!arah) return null;
  return { arah, gateName: nearest.gate_name, branchId: nearest.branch_id ?? null, distanceKm: nd };
}
