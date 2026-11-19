import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button, EmptyState, Input, Tabs, useToast } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import {
  trafficFlow, ARAH_UTAMA, arahLabel,
  type CapacityResp, type HealthResp, type PrediksiListResp
} from "@/lib/trafficFlow";
import { fmt, UpdateTicker, Hint } from "./parts";

const METODE_LABEL: Record<string, string> = { p95: "otomatis", nominal: "sementara", manual: "manual" };
import styles from "@/pages/modules.module.css";

const TABS: TabItem[] = [
  { value: "kapasitas", label: "Kapasitas", icon: "gauge" },
  { value: "prediksi", label: "Input Prediksi", icon: "target" },
  { value: "status", label: "Status", icon: "activity" }
];

function todayWib(): string {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

export function SetelanArusPage() {
  const [tab, setTab] = useState("kapasitas");
  return (
    <div className={`${styles.page} ${styles.pageFlow}`}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Setelan Arus</strong>
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Kapasitas terkalibrasi, angka prediksi, dan status pengumpul data.</span>
        </div>
        <span className={styles.headSpacer} />
        <Tabs value={tab} onValueChange={setTab} items={TABS} />
      </div>
      {tab === "kapasitas" && <KapasitasTab />}
      {tab === "prediksi" && <PrediksiTab />}
      {tab === "status" && <StatusTab />}
    </div>
  );
}

const CAP_GRID = "1.5fr 1.1fr 0.8fr 0.75fr 0.75fr 0.85fr 0.7fr 0.85fr" as const;

function KapasitasTab() {
  const { data, loading, error } = usePolling<CapacityResp>(useCallback(() => trafficFlow.capacity(), []), 0);
  const grid = { gridTemplateColumns: CAP_GRID } as CSSProperties;
  return (
    <>
      <Hint style={{ margin: "0 0 6px" }}>Kapasitas (praktis) dihitung otomatis dari data 2 minggu terakhir, dipakai untuk "Terisi %". Jumlah lajur diambil dari data gardu resmi ("3 +1" = 3 lajur + 1 reversible/contraflow). "Kap desain" = kapasitas resmi (lajur × 1080/gardu), untuk pelaporan saja.</Hint>
      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={grid}>
                <span>Gerbang</span><span>Tujuan</span>
                <span style={{ textAlign: "right" }}>Kap/jam</span>
                <span style={{ textAlign: "right" }}>Smp</span>
                <span style={{ textAlign: "right" }}>Per lajur</span>
                <span style={{ textAlign: "right" }}>Desain</span>
                <span style={{ textAlign: "right" }}>Lajur</span>
                <span>Cara</span>
              </div>
            {error ? <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} /> :
              (data?.items.length ?? 0) === 0 ? <EmptyState icon="gauge" title={loading ? "Memuat…" : "Belum ada kalibrasi"} /> :
                data!.items.map((c) => (
                  <div key={`${c.kode_bujt}-${c.gb_tujuan}`} className={styles.trow} style={grid}>
                    <span style={{ minWidth: 0 }}><span className={styles.cellTitle}>{c.gb_tujuan}</span><span className={styles.cellSub}>{c.kode_bujt}</span></span>
                    <span className={styles.cellText}>{arahLabel(c.arah)}</span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.kapasitas_jam)}</span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.kapasitas_smp_jam)}</span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.kapasitas_per_gardu)}</span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }} title="Kapasitas desain resmi = lajur × 1080/gardu">{fmt(c.kapasitas_desain)}</span>
                    <span className={styles.muted} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                      title={c.kapasitas_contraflow ? `Contraflow (lajur + reversible): ${fmt(c.kapasitas_contraflow)}/jam` : undefined}>
                      {c.gardu_ref}{c.gardu_reversible ? ` +${c.gardu_reversible}` : ""}
                    </span>
                    <span className={styles.cellText}>{METODE_LABEL[c.metode] ?? c.metode}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PrediksiTab() {
  const toast = useToast();
  const { data, refresh } = usePolling<PrediksiListResp>(useCallback(() => trafficFlow.prediksiList(), []), 0);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Pre-isi dari nilai yang ada (resmi > baseline) saat data datang.
  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const a of ARAH_UTAMA) {
      const rows = data.items.filter((i) => i.scope_type === "arah" && i.scope_value === a);
      const resmi = rows.find((r) => r.source === "resmi");
      const chosen = resmi ?? rows[0];
      if (chosen) next[a] = String(chosen.prediksi_kend);
    }
    setVals((prev) => ({ ...next, ...prev }));
  }, [data]);

  async function save() {
    const rows = ARAH_UTAMA
      .filter((a) => vals[a] && Number(vals[a]) > 0)
      .map((a) => ({ scope_type: "arah" as const, scope_value: a, tanggal: todayWib(), prediksi_kend: Math.round(Number(vals[a])) }));
    if (rows.length === 0) { toast.error("Isi minimal satu angka prediksi."); return; }
    setSaving(true);
    try {
      const res = await trafficFlow.prediksiUpsert(rows);
      toast.success(`Tersimpan ${res.upserted} angka prediksi (resmi).`);
      refresh();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.body} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--sp-4)", alignContent: "start" }}>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Angka Prediksi Resmi · {todayWib()}</div>
        <div className={styles.muted} style={{ fontSize: "var(--fs-xs)", marginBottom: 12 }}>Isi target jumlah kendaraan per hari untuk tiap tujuan. Angka ini menggantikan perkiraan otomatis.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ARAH_UTAMA.map((a) => (
            <label key={a} style={{ display: "grid", gridTemplateColumns: "1fr 130px", alignItems: "center", gap: 10 }}>
              <span>{arahLabel(a)}</span>
              <Input type="number" inputMode="numeric" placeholder="—" value={vals[a] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [a]: e.target.value }))} />
            </label>
          ))}
          <Button icon="save" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan prediksi"}</Button>
        </div>
      </div>

      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Prediksi tersimpan hari ini</div>
        {(data?.items.length ?? 0) === 0 ? (
          <EmptyState icon="target" title="Belum ada" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data!.items.filter((i) => i.scope_type === "arah").map((i) => (
              <div key={`${i.scope_value}-${i.source}`} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)" }}>
                <span>{arahLabel(i.scope_value)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(i.prediksi_kend)} <span className={styles.muted} style={{ fontSize: "10px" }}>({i.source === "resmi" ? "resmi" : "otomatis"})</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusTab() {
  const { data } = usePolling<HealthResp>(useCallback(() => trafficFlow.health(), []), 30000);
  return (
    <>
    <Hint style={{ margin: "0 0 4px" }}>Memastikan data arus masih mengalir. "Belum terpetakan" = gerbang yang transaksinya ada tapi belum ditautkan ke tujuan mana pun.</Hint>
    <div className={styles.body} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--sp-4)", alignContent: "start" }}>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Pengumpul Data</div>
        <Row label="Status"><UpdateTicker lag={data?.lag_minutes ?? null} pollMinutes={data?.poll_interval_minutes} /></Row>
        <Row label="Bin terakhir">{data?.last_bin ?? "—"}</Row>
        <Row label="Interval poll">{data?.poll_interval_minutes ?? "—"} menit</Row>
        <Row label="Bin hari ini">{fmt(data?.hari_ini.bins)}</Row>
        <Row label="Transaksi hari ini">{fmt(data?.hari_ini.vll)}</Row>
      </div>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-2xl)", padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Gerbang belum terpetakan</div>
        {(data?.gerbang_belum_terpetakan.length ?? 0) === 0 ? (
          <span className={styles.muted} style={{ fontSize: "var(--fs-xs)" }}>Semua gerbang sudah terpetakan ke arah. ✓</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data!.gerbang_belum_terpetakan.map((g) => (
              <div key={`${g.kode_bujt}-${g.gb_tujuan}`} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)" }}>
                <span>{g.gb_tujuan} <span className={styles.muted} style={{ fontSize: "10px" }}>{g.kode_bujt}</span></span>
                <span className={styles.muted} style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(g.vll)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: "var(--fs-sm)" }}>
      <span className={styles.muted}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}
