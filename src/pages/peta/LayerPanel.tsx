import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui";
import { LAYERS } from "./layers";
import type { LayerKey } from "./layers";
import { FUNCTIONAL_COLOR, ROUTE_LAYERS } from "./routeLayers";
import type { RouteKey } from "./routeLayers";
import { LEVEL_META } from "@/lib/trafficFlow";
import styles from "./peta.module.css";

// Legenda warna tooltip kepadatan (urut dari lancar → kritis).
const DENSITY_LEGEND: { key: keyof typeof LEVEL_META; }[] = [
  { key: "lancar" },
  { key: "ramai" },
  { key: "padat" },
  { key: "kritis" }
];

interface LayerPanelProps {
  branchName: string;
  visible: Record<LayerKey, boolean>;
  counts: Record<LayerKey, number>;
  badges: Record<LayerKey, number>;
  activeListKey: LayerKey | null;
  onOpenList: (key: LayerKey) => void;
  onToggle: (key: LayerKey) => void;
  routeVisible: Record<RouteKey, boolean>;
  onToggleRoute: (key: RouteKey) => void;
  densityOn: boolean;
  densityCount: number;
  onToggleDensity: () => void;
}

export function LayerPanel({
  branchName,
  visible,
  counts,
  badges,
  activeListKey,
  onOpenList,
  onToggle,
  routeVisible,
  onToggleRoute,
  densityOn,
  densityCount,
  onToggleDensity
}: LayerPanelProps) {
  return (
    <aside className={styles.layerPanel}>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadLabel}>Ruas Aktif</div>
        <div className={styles.panelHeadValue}>{branchName}</div>
      </div>

      <div className={styles.layerList}>
        {LAYERS.map((layer) => {
          const badge = badges[layer.key] ?? 0;
          return (
            <div key={layer.key} className={styles.layerRow} data-active={activeListKey === layer.key}>
              {/* Zona teks: buka daftar (tidak untuk layer tanpa daftar). */}
              <div
                className={styles.layerZone}
                onClick={() => layer.hasList && onOpenList(layer.key)}
                style={{ cursor: layer.hasList ? "pointer" : "default" }}
                role={layer.hasList ? "button" : undefined}
                title={layer.hasList ? `Lihat daftar ${layer.name}` : layer.name}
              >
                <span
                  className={styles.layerIcon}
                  style={{
                    background: `color-mix(in srgb, var(${layer.colorVar}) 16%, transparent)`,
                    color: `var(${layer.colorVar})`
                  }}
                >
                  <Icon name={layer.icon} size={16} />
                </span>
                <span className={styles.layerInfo}>
                  <span className={styles.layerName}>{layer.name}</span>
                  <span className={styles.layerCount}>{counts[layer.key] ?? 0} titik</span>
                </span>
                {badge > 0 && <span className={styles.layerBadge}>{badge}</span>}
              </div>

              {/* Zona toggle: hanya nyalakan/matikan marker. */}
              <Switch
                checked={visible[layer.key]}
                onCheckedChange={() => onToggle(layer.key)}
                stopPropagation
                ariaLabel={`Toggle ${layer.name}`}
                title={`${visible[layer.key] ? "Sembunyikan" : "Tampilkan"} ${layer.name}`}
              />
            </div>
          );
        })}

        {/* ---- Status kepadatan gerbang (toggle independen) ---- */}
        <div className={styles.layerGroupLabel}>Arus Lalu Lintas</div>
        <div className={styles.layerRow} data-active={densityOn || undefined}>
          <div className={styles.layerZone} style={{ cursor: "default" }} title="Tooltip kepadatan gerbang yang selalu tampil (marker gerbang padat ikut muncul walau layer Gerbang Tol dimatikan).">
            <span className={styles.layerIcon} style={{ background: "color-mix(in srgb, var(--sem-orange, #f97316) 16%, transparent)", color: "var(--sem-orange, #f97316)" }}>
              <Icon name="gauge" size={16} />
            </span>
            <span className={styles.layerInfo}>
              <span className={styles.layerName}>Status Kepadatan</span>
              <span className={styles.layerCount}>{densityCount} gerbang padat</span>
            </span>
          </div>
          <Switch
            checked={densityOn}
            onCheckedChange={onToggleDensity}
            stopPropagation
            ariaLabel="Toggle Status Kepadatan"
            title={`${densityOn ? "Sembunyikan" : "Tampilkan"} status kepadatan gerbang`}
          />
        </div>
        {densityOn && (
          <div className={styles.densityLegend}>
            {DENSITY_LEGEND.map(({ key }) => (
              <span key={key} className={styles.densityLegendItem}>
                <span className={styles.densityLegendDot} style={{ background: LEVEL_META[key].color }} />
                {LEVEL_META[key].label}
              </span>
            ))}
          </div>
        )}

        {/* ---- Jaringan jalan tol (layer GeoJSON) ---- */}
        <div className={styles.layerGroupLabel}>Jaringan Jalan Tol</div>
        {ROUTE_LAYERS.map((layer) => {
          const functional = layer.kind === "functional";
          return (
            <div key={layer.key} className={styles.layerRow}>
              <div className={styles.layerZone} style={{ cursor: "default" }} title={layer.desc}>
                <span className={styles.layerIcon} style={{ background: "transparent" }}>
                  {/* Legenda garis: solid utk operasional, putus-putus utk fungsional. */}
                  <span
                    className={styles.routeLegend}
                    data-dashed={functional || undefined}
                    style={functional ? { color: FUNCTIONAL_COLOR } : undefined}
                  />
                </span>
                <span className={styles.layerInfo}>
                  <span className={styles.layerName}>{layer.name}</span>
                  <span className={styles.layerCount}>{functional ? "Fungsional" : "Operasional"}</span>
                </span>
              </div>
              <Switch
                checked={routeVisible[layer.key]}
                onCheckedChange={() => onToggleRoute(layer.key)}
                stopPropagation
                ariaLabel={`Toggle ${layer.name}`}
                title={`${routeVisible[layer.key] ? "Sembunyikan" : "Tampilkan"} ${layer.name}`}
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
