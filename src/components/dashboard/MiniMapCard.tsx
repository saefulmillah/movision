import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { usePolling } from "@/lib/usePolling";
import { fetchGateAlerts, fetchMapAssets } from "@/lib/monitoring";
import styles from "./dashboard.module.css";

const W = 600;
const H = 280;
const PAD = 16;
const MAX_POINTS = 500;

interface Pt {
  x: number;
  y: number;
  color: string;
  r: number;
}

// Sampel merata agar render tetap ringan bila aset ribuan.
function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[Math.floor(i)]);
  return out;
}

export function MiniMapCard() {
  const navigate = useNavigate();
  // Snapshot ringkas — ambil sekali (mini-map, bukan peta penuh).
  const assets = usePolling(() => fetchMapAssets("cctv,vms"), 0);
  const gates = usePolling(fetchGateAlerts, 0);

  const points = useMemo<Pt[]>(() => {
    const coords: { lat: number; lng: number; type: string; status?: string }[] = [];
    for (const a of sample(assets.data ?? [], MAX_POINTS)) {
      if (a.lat && a.lng) coords.push({ lat: a.lat, lng: a.lng, type: a.asset_type });
    }
    for (const g of gates.data ?? []) {
      if (g.lat && g.lng) coords.push({ lat: g.lat, lng: g.lng, type: "gate", status: String(g.status).toLowerCase() });
    }
    if (coords.length === 0) return [];

    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;

    const colorFor = (c: { type: string; status?: string }): string => {
      if (c.type === "gate") {
        if (c.status === "error") return "var(--sem-red)";
        if (c.status === "warning") return "var(--sem-amber)";
        if (c.status === "offline") return "var(--st-gray)";
        return "var(--sem-amber)";
      }
      if (c.type === "vms") return "var(--sem-purple)";
      return "var(--sem-green)"; // cctv
    };

    return coords.map((c) => ({
      x: PAD + ((c.lng - minLng) / spanLng) * (W - 2 * PAD),
      y: PAD + (1 - (c.lat - minLat) / spanLat) * (H - 2 * PAD),
      color: colorFor(c),
      r: c.type === "gate" ? 3.4 : 1.9
    }));
  }, [assets.data, gates.data]);

  return (
    <Card
      title="Sebaran Aset"
      action={{ label: "Buka peta penuh", onClick: () => navigate("/peta") }}
    >
      <div className={styles.miniMap}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="var(--grid)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity={p.r > 3 ? 0.95 : 0.7} />
          ))}
        </svg>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: "var(--sem-green)" }} /> CCTV
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: "var(--sem-purple)" }} /> VMS
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: "var(--sem-amber)" }} /> Gerbang
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: "var(--sem-red)" }} /> Bermasalah
          </div>
        </div>
      </div>
    </Card>
  );
}
