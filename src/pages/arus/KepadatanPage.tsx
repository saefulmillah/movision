import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { EmptyState, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import { trafficFlow, ARAH_UTAMA, arahLabel, type DensityResp, type DensityItem, type Level } from "@/lib/trafficFlow";
import { fmt, pctFull, LevelBadge, TrenArrow, UpdateTicker, Hint } from "./parts";
import styles from "@/pages/modules.module.css";

const GRID = "1.5fr 0.9fr 0.8fr 0.8fr 0.9fr 0.8fr 0.7fr 0.9fr" as const;

type Basis = "jumlah" | "smp" | "dinamis";

const ARAH_OPTIONS: SelectOption[] = [
  { value: "all", label: "Semua arah" },
  ...ARAH_UTAMA.map((a) => ({ value: a, label: arahLabel(a) }))
];
const BASIS_OPTIONS: SelectOption[] = [
  { value: "jumlah", label: "Hitungan biasa" },
  { value: "smp", label: "Perhitungkan kendaraan berat" },
  { value: "dinamis", label: "Perhitungkan lajur yang buka" }
];

function pick(it: DensityItem, basis: Basis): { rho: number | null; level: Level | undefined; tren: number | null } {
  if (basis === "smp") return { rho: it.rho_smp, level: it.level_smp, tren: it.tren_smp };
  if (basis === "dinamis") return { rho: it.rho_dinamis, level: it.level_dinamis, tren: it.tren_dinamis };
  return { rho: it.rho, level: it.level, tren: it.tren };
}

const RANK: Record<string, number> = { kritis: 4, anomali: 4, padat: 3, ramai: 2, lancar: 1, data: 0, "n/a": -1 };

export function KepadatanPage() {
  const [arah, setArah] = useState("all");
  const [basis, setBasis] = useState<Basis>("jumlah");

  const fetcher = useCallback(() => trafficFlow.density(arah === "all" ? undefined : arah), [arah]);
  const { data, loading, error } = usePolling<DensityResp>(fetcher, 60000, [arah]);

  const rows = useMemo(() => {
    const items = [...(data?.items ?? [])];
    items.sort((a, b) => {
      const la = pick(a, basis).level ?? "n/a";
      const lb = pick(b, basis).level ?? "n/a";
      const d = (RANK[lb] ?? -1) - (RANK[la] ?? -1);
      return d !== 0 ? d : (pick(b, basis).rho ?? 0) - (pick(a, basis).rho ?? 0);
    });
    return items;
  }, [data, basis]);

  const gridStyle = { gridTemplateColumns: GRID } as CSSProperties;

  return (
    <div className={`${styles.page} ${styles.pageFlow}`}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Kepadatan Gerbang</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Seberapa penuh tiap gerbang dibanding kapasitasnya (1 jam terakhir). Angka bersifat perkiraan.</span>
        </div>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={basis} onValueChange={(v) => setBasis(v as Basis)} options={BASIS_OPTIONS} icon="sliders-horizontal" ariaLabel="Basis ρ" />
        <Select className={styles.filter} value={arah} onValueChange={setArah} options={ARAH_OPTIONS} icon="navigation" ariaLabel="Arah" />
        <UpdateTicker lag={0} />
      </div>

      <Hint style={{ margin: "0 0 4px" }}>
        "Terisi" = arus dibanding kapasitas praktis gerbang (dari data nyata). Di bawah 70% <b style={{ color: "#22c55e" }}>Lancar</b> · 70–85% <b style={{ color: "#eab308" }}>Ramai</b> · 85–95% <b style={{ color: "#f97316" }}>Padat</b> · di atas 95% <b style={{ color: "#ef4444" }}>Kritis</b>. "Desain" = pemakaian terhadap kapasitas desain resmi (1080/gardu), untuk pelaporan.
      </Hint>
      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                <span>Gerbang</span>
                <span>Tujuan</span>
                <span style={{ textAlign: "right" }}>Arus/jam</span>
                <span style={{ textAlign: "right" }}>Terisi</span>
                <span style={{ textAlign: "right" }}>Kapasitas</span>
                <span style={{ textAlign: "right" }}>Desain</span>
                <span style={{ textAlign: "right" }}>Lajur</span>
                <span>Status</span>
              </div>
              {error && !data ? (
                <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} />
              ) : rows.length === 0 ? (
                <EmptyState icon="gauge" title={loading ? "Memuat…" : "Tidak ada data"} />
              ) : (
                rows.map((g) => {
                  const p = pick(g, basis);
                  const cap = basis === "smp" ? g.kapasitas_smp_jam : basis === "dinamis" ? g.kapasitas_dinamis : g.kapasitas_jam;
                  const rate = basis === "smp" ? g.rate_smp_now : g.rate_now;
                  return (
                    <div key={`${g.kode_bujt}-${g.gb_tujuan}`} className={styles.trow} style={gridStyle}>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.cellTitle}>{g.gb_tujuan}</span>
                        <span className={styles.cellSub}>{g.kode_bujt}{g.is_open_system ? " · terbuka" : ""}</span>
                      </span>
                      <span className={styles.cellText}>{arahLabel(g.arah)}</span>
                      <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(rate)}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, display: "inline-flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        {pctFull(p.rho)} <TrenArrow value={p.tren} />
                      </span>
                      <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(cap)}</span>
                      <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }} title="Pemakaian terhadap kapasitas desain resmi (1080/gardu)">
                        {g.pct_desain != null ? `${Math.round(g.pct_desain * 100)}%` : "—"}
                      </span>
                      <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {g.gardu_aktif != null ? `${g.gardu_aktif}/${g.gardu_ref}` : "—"}
                      </span>
                      <span><LevelBadge level={p.level} size="sm" /></span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
