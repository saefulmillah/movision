import { Icon } from "@/components/ui/Icon";
import type { Camera } from "@/types/cctv";
import styles from "./cctv.module.css";

interface CameraListPanelProps {
  cameras: Camera[];
  query: string;
  onQuery: (q: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function km(cam: Camera): string {
  if (cam.cctv_desc) return cam.cctv_desc;
  const m = cam.cctv_name.match(/km\s*[\d+.]+/i);
  return m ? m[0].toUpperCase() : "";
}

export function CameraListPanel({ cameras, query, onQuery, selectedId, onSelect }: CameraListPanelProps) {
  return (
    <aside className={styles.listPanel}>
      <div className={styles.searchBox}>
        <Icon name="search" size={15} style={{ color: "var(--text-faint)" }} />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Cari kamera…" />
      </div>
      <div className={styles.camList}>
        {cameras.map((cam) => {
          const offline = Number(cam.is_active) !== 1 || !cam.stream_play_url;
          return (
            <div
              key={cam.id}
              className={styles.camItem}
              data-selected={selectedId === cam.id || undefined}
              onClick={() => onSelect(cam.id)}
            >
              <span className={styles.camDot} data-off={offline || undefined} />
              <span className={styles.camInfo}>
                <span className={styles.camName}>{cam.cctv_name}</span>
                {km(cam) && <span className={styles.camKm}>{km(cam)}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
