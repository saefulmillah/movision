import type { CSSProperties, ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Icon } from "@/components/ui";
import { levelMeta, type SeriesPoint } from "@/lib/trafficFlow";

/** Format angka ribuan gaya Indonesia. */
export function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("id-ID");
}

/** Terjemahan awam untuk ρ (rasio keterisian) → "terisi X%". */
export function pctFull(rho: number | null | undefined): string {
  if (rho == null || Number.isNaN(rho)) return "—";
  return `${Math.round(rho * 100)}%`;
}

/** Alasan peringatan dalam bahasa awam. */
const REASON_TEXT: Record<string, string> = {
  prior_saturasi: "sempat penuh",
  drop_tajam: "arus mendadak anjlok",
  lokal_koridor_sehat: "hanya gerbang ini",
  waktu_tempuh_naik: "waktu tempuh naik"
};
export function reasonText(reasons: string[] | undefined, fallback = ""): string {
  if (!reasons || reasons.length === 0) return fallback;
  return reasons.map((r) => REASON_TEXT[r] ?? r).join(", ");
}

/** Badge warna level kepadatan / status. */
export function LevelBadge({ level, size = "md" }: { level: string | null | undefined; size?: "sm" | "md" }) {
  const m = levelMeta(level);
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  const fs = size === "sm" ? "var(--fs-xs)" : "var(--fs-sm)";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: pad, borderRadius: 999,
        fontSize: fs, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap",
        color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55`
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.color }} />
      {m.label}
    </span>
  );
}

/** Panah tren: naik (merah untuk kepadatan) / turun (hijau) / datar. */
export function TrenArrow({ value, invert = false }: { value: number | null | undefined; invert?: boolean }) {
  if (value == null || Math.abs(value) < 0.0005) {
    return <Icon name="minus" size={14} style={{ color: "var(--text-muted)" }} />;
  }
  const up = value > 0;
  // invert=false: naik dianggap "memburuk" (merah). invert=true: naik = baik (hijau).
  const bad = invert ? !up : up;
  return (
    <Icon
      name={up ? "trending-up" : "trending-down"}
      size={14}
      style={{ color: bad ? "var(--sem-red, #ef4444)" : "var(--sem-green, #22c55e)" }}
    />
  );
}

/** Sparkline mungil dari deret bin. */
export function Spark({ data, color, height = 36 }: { data: SeriesPoint[]; color: string; height?: number }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="vll" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Indikator "diperbarui X menit lalu". */
export function UpdateTicker({ lag, pollMinutes, style }: { lag: number | null; pollMinutes?: number; style?: CSSProperties }) {
  const fresh = lag != null && lag <= (pollMinutes ?? 5) + 1;
  const text = lag == null ? "belum ada data" : lag <= 0 ? "baru saja" : `${lag} menit lalu`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--text-muted)", ...style }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: fresh ? "var(--sem-green, #22c55e)" : "var(--sem-amber, #f59e0b)" }} />
      diperbarui {text}
      {pollMinutes ? <span style={{ opacity: 0.6 }}>· poll {pollMinutes}m</span> : null}
    </span>
  );
}

/** Teks penjelasan singkat (deskripsi kartu/halaman) untuk orang awam. */
export function Hint({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", margin: "0 0 10px", lineHeight: 1.5, ...style }}>
      {children}
    </p>
  );
}

/** Kartu KPI kecil seragam. */
export function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: "14px 16px" }}>
      <div style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: color ?? "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}
