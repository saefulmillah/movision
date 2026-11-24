import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { HlsVideo } from "@/components/ui/HlsVideo";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import type { MapAsset } from "@/types/monitoring";
import { trafficFlow } from "@/lib/trafficFlow";
import type { Cctv } from "@/lib/trafficFlow";
import { LAYERS } from "./layers";
import type { LayerKey, ListItem } from "./layers";
import styles from "./peta.module.css";

export type PanelMode = "empty" | "list" | "detail";

interface AssetPanelProps {
  mode: PanelMode;
  layerKey: LayerKey | null;
  items: ListItem[];
  search: string;
  onSearch: (q: string) => void;
  selection: ListItem | null;
  onSelectItem: (item: ListItem) => void;
  onBack: () => void;
  onClose: () => void;
  /** Nama gerbang (ter-normalisasi, gb_tujuan) utk ambil streaming CCTV gerbang. */
  gateStreamGb: string | null;
}

function layerName(key: LayerKey | null): string {
  return LAYERS.find((l) => l.key === key)?.name ?? "";
}

function attributes(key: LayerKey | null, raw: Record<string, unknown>): [string, string][] {
  const rows: [string, string][] = [];
  const push = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") rows.push([k, String(v)]);
  };
  switch (key) {
    case "cctv":
    case "vms":
      push("Kode", raw.asset_code);
      push("Ruas", raw.branch_id);
      push("Status", raw.is_online ? "Online" : "Offline");
      push("Koordinat", raw.lat && raw.lng ? `${raw.lat}, ${raw.lng}` : "");
      break;
    case "gate":
      push("Kode", raw.gate_code);
      push("Ruas", raw.branch_id);
      push("Severity", raw.severity);
      if (raw.device_summary) {
        const s = raw.device_summary as Record<string, number>;
        push("Perangkat", `${s.total} total · ${s.error} error · ${s.offline} offline`);
      }
      break;
    case "gps":
      push("Unit", raw.node);
      push("Tipe", raw.vehicle_type);
      push("Kecepatan", raw.speed !== undefined ? `${Math.round(Number(raw.speed))} km/j` : "");
      push("Ruas", raw.branch_name);
      push("Status", raw.movement_status);
      break;
    case "sos":
      push("Tiket", raw.ticket_no);
      push("Jenis", raw.incident_type);
      push("Lokasi", (raw.sos as Record<string, unknown>)?.location);
      push("Ruas", (raw.sos as Record<string, unknown>)?.branch_name);
      break;
    case "fo":
      push("Kode", raw.edge_code);
      push("Tipe", raw.connection_type);
      push("Bandwidth", raw.bandwidth_label);
      push("Jarak", raw.distance_km ? `${raw.distance_km} km` : "");
      push("Status", raw.status);
      break;
    case "weather":
      push("Kode", raw.point_code);
      push("Kondisi", raw.weather_label);
      push("Suhu", raw.temperature_c != null ? `${raw.temperature_c}°C` : "");
      push("Kelembapan", raw.humidity_pct != null ? `${raw.humidity_pct}%` : "");
      push("Angin", raw.wind_kph != null ? `${raw.wind_kph} km/j` : "");
      push("Ruas", raw.branch_name ?? raw.branch_id);
      push("Koordinat", raw.lat && raw.lng ? `${raw.lat}, ${raw.lng}` : "");
      if (raw.is_stale) push("Catatan", "Data mungkin kedaluwarsa");
      break;
  }
  return rows;
}

export function AssetPanel({
  mode,
  layerKey,
  items,
  search,
  onSearch,
  selection,
  onSelectItem,
  onBack,
  onClose,
  gateStreamGb
}: AssetPanelProps) {
  if (mode === "empty") {
    return (
      <aside className={styles.rightPanel}>
        <EmptyState
          icon="mouse-pointer-click"
          title="Belum ada yang dipilih"
          description="Klik salah satu layer di panel kiri untuk melihat daftarnya, atau klik marker di peta untuk detail."
        />
      </aside>
    );
  }

  if (mode === "detail" && selection) {
    const raw = (selection.raw ?? {}) as Record<string, unknown>;
    const attrs = attributes(layerKey, raw);
    return (
      <aside className={styles.rightPanel}>
        <div className={styles.rpHead}>
          <button className={styles.rpIconBtn} onClick={onBack} title="Kembali" aria-label="Kembali">
            <Icon name="arrow-left" size={16} />
          </button>
          <span className={styles.rpTitle}>Detail {layerName(layerKey)}</span>
          <button className={`${styles.rpIconBtn} ${styles.rpClose}`} onClick={onClose} title="Tutup" aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={styles.detail}>
          <div className={styles.detailChips}>
            <StatusPill label={layerName(layerKey)} tone="blue" />
            <StatusPill label={selection.status} tone={toneForStatus(selection.status)} />
          </div>
          <div className={styles.detailTitle}>{selection.title}</div>
          {attrs.map(([k, v]) => (
            <div key={k} className={styles.attrRow}>
              <span className={styles.attrKey}>{k}</span>
              <span className={styles.attrVal}>{v}</span>
            </div>
          ))}
          {layerKey === "cctv" &&
            (() => {
              const cam = raw as unknown as MapAsset;
              return (
                <div style={{ marginTop: 14 }}>
                  <HlsVideo url={cam.stream_play_url ?? null} offline={!cam.is_online} />
                </div>
              );
            })()}
          {layerKey === "gate" && <GateCctv gb={gateStreamGb} />}
        </div>
      </aside>
    );
  }

  // mode === "list"
  return (
    <aside className={styles.rightPanel}>
      <div className={styles.rpHead}>
        <span className={styles.rpTitle}>{layerName(layerKey)}</span>
        <span className={styles.rpSub}>{items.length} item</span>
        <button className={`${styles.rpIconBtn} ${styles.rpClose}`} onClick={onClose} title="Tutup" aria-label="Tutup">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className={styles.searchBox}>
        <Icon name="search" size={15} style={{ color: "var(--text-faint)" }} />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={`Cari ${layerName(layerKey).toLowerCase()}…`} />
      </div>
      <div className={styles.assetList}>
        {items.length === 0 ? (
          <EmptyState icon="boxes" title="Tidak ada item" description="Tidak ada aset pada ruas ini atau kata kunci pencarian." />
        ) : layerKey === "gps" ? (
          groupByVehicleType(items).map(([type, group]) => (
            <div key={type}>
              <div className={styles.groupHeader}>
                <span>{type}</span>
                <span className={styles.groupCount}>{group.length}</span>
              </div>
              {group.map((item) => renderItem(item, selection, onSelectItem))}
            </div>
          ))
        ) : layerKey === "weather" ? (
          groupByBranch(items).map(([ruas, group]) => (
            <div key={ruas}>
              <div className={styles.groupHeader}>
                <span>{ruas}</span>
                <span className={styles.groupCount}>{group.length}</span>
              </div>
              {group.map((item) => renderItem(item, selection, onSelectItem))}
            </div>
          ))
        ) : (
          items.map((item) => renderItem(item, selection, onSelectItem))
        )}
      </div>
    </aside>
  );
}

function renderItem(item: ListItem, selection: ListItem | null, onSelectItem: (i: ListItem) => void) {
  return (
    <div
      key={item.id}
      className={styles.assetItem}
      data-selected={selection?.id === item.id}
      onClick={() => onSelectItem(item)}
    >
      <span className={styles.assetMain}>
        <span className={styles.assetName}>{item.title}</span>
        {item.desc && <span className={styles.assetDesc}>{item.desc}</span>}
      </span>
      <span className={styles.assetRight}>
        <StatusPill label={item.status} tone={toneForStatus(item.status)} dot />
      </span>
    </div>
  );
}

/** Streaming CCTV gerbang terpilih (klik marker gerbang). Ambil kamera via
 *  traffic-flow/cctv memakai nama gerbang ternormalisasi (gb_tujuan). */
function GateCctv({ gb }: { gb: string | null }) {
  const [cams, setCams] = useState<Cctv[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!gb) {
      setCams([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setActive(0);
    trafficFlow
      .cctv({ gb_tujuan: gb })
      .then((r) => {
        if (alive) setCams(r.items.flatMap((g) => g.cctv));
      })
      .catch(() => {
        if (alive) setCams([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [gb]);

  const cam = cams[active];
  return (
    <div className={styles.gateCctv}>
      <div className={styles.gateCctvHead}>
        <Icon name="cctv" size={15} /> Kamera Gerbang{cams.length > 0 ? ` (${cams.length})` : ""}
      </div>
      {loading ? (
        <EmptyState icon="cctv" title="Memuat kamera…" />
      ) : cams.length === 0 ? (
        <EmptyState
          icon="video-off"
          title="Tak ada kamera terpetakan"
          description={gb ? "Petakan kamera gerbang ini lewat data CCTV / Arus Lalin." : "Gerbang ini belum terhubung ke modul arus lalin."}
        />
      ) : (
        <>
          <HlsVideo url={cam?.stream_url ?? null} active />
          <div className={styles.gateCamName}>
            {cam?.name}
            {cam?.is_gate ? " · kamera gerbang" : ""}
          </div>
          {cams.length > 1 && (
            <div className={styles.gateCamList}>
              {cams.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.gateCamBtn}
                  data-active={i === active || undefined}
                  onClick={() => setActive(i)}
                >
                  {c.is_gate && <Icon name="door-open" size={13} />}
                  <span className={styles.gateCamBtnText}>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Kelompokkan item GPS berdasarkan tipe kendaraan (dari data mentah), urut alfabet. */
function groupByVehicleType(items: ListItem[]): [string, ListItem[]][] {
  const map = new Map<string, ListItem[]>();
  for (const item of items) {
    const type = (item.raw as { vehicle_type?: string })?.vehicle_type || "Lainnya";
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(item);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Kelompokkan item cuaca berdasarkan nama ruas (dari data mentah), urut alfabet. */
function groupByBranch(items: ListItem[]): [string, ListItem[]][] {
  const map = new Map<string, ListItem[]>();
  for (const item of items) {
    const raw = item.raw as { branch_name?: string; branch_id?: number } | null;
    const ruas = raw?.branch_name || (raw?.branch_id != null ? `Ruas ${raw.branch_id}` : "Tanpa Ruas");
    if (!map.has(ruas)) map.set(ruas, []);
    map.get(ruas)!.push(item);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
