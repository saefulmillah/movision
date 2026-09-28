import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui";
import { LAYERS } from "./layers";
import type { LayerKey } from "./layers";
import styles from "./peta.module.css";

interface LayerPanelProps {
  branchName: string;
  visible: Record<LayerKey, boolean>;
  counts: Record<LayerKey, number>;
  badges: Record<LayerKey, number>;
  activeListKey: LayerKey | null;
  onOpenList: (key: LayerKey) => void;
  onToggle: (key: LayerKey) => void;
}

export function LayerPanel({
  branchName,
  visible,
  counts,
  badges,
  activeListKey,
  onOpenList,
  onToggle
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
      </div>
    </aside>
  );
}
