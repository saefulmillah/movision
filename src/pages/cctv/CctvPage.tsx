import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { EdgeTab, FloatingToolbar } from "@/components/shell/FullscreenChrome";
import { useBranch } from "@/context/BranchContext";
import { usePolling } from "@/lib/usePolling";
import { fetchCameras } from "@/lib/cctv";
import { CameraListPanel } from "./CameraListPanel";
import { CctvToolbar } from "./CctvToolbar";
import { CameraGrid } from "./CameraGrid";
import styles from "./cctv.module.css";

const AUTO_HIDE_MS = 2600;
const GRID_TABS: TabItem[] = [
  { value: "2", label: "2×2" },
  { value: "3", label: "3×3" },
  { value: "4", label: "4×4" }
];

export function CctvPage() {
  const { activeBranchId, activeBranch } = useBranch();
  const branchName = activeBranch?.branch_name ?? "Semua Ruas";

  const { data, loading, error } = usePolling(() => fetchCameras(activeBranchId), 30000, [activeBranchId]);
  const cameras = useMemo(() => data ?? [], [data]);

  const [cols, setCols] = useState(3);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cameras.filter((c) => c.cctv_name.toLowerCase().includes(q)) : cameras;
  }, [cameras, query]);

  // Paging hanya saat layar penuh (mode normal menggulir seluruh kamera).
  const perPage = cols * cols;
  const pageCount = full ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const gridCameras = full ? filtered.slice((page - 1) * perPage, page * perPage) : filtered;

  // Reset/clamp halaman saat grid, ruas, filter, atau mode berubah.
  useEffect(() => {
    setPage(1);
  }, [cols, activeBranchId, full, query]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const online = useMemo(() => cameras.filter((c) => Number(c.is_active) === 1 && c.stream_play_url).length, [cameras]);
  const offline = cameras.length - online;

  // Auto-hide UI mode layar penuh.
  const hideTimer = useRef<number | null>(null);
  const nudgeUi = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setUiVisible(false), AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!full) {
      setUiVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      return;
    }
    nudgeUi();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [full, nudgeUi]);

  const toggleFull = useCallback(() => {
    setFull((f) => {
      if (f) setListOpen(false);
      return !f;
    });
  }, []);

  const selectCamera = useCallback((id: number) => setSelectedId(id), []);
  const uiDim = full && !uiVisible;

  return (
    <div className={styles.page} data-full={full || undefined} onMouseMove={full ? nudgeUi : undefined}>
      {/* Panel daftar kamera */}
      {!full ? (
        <CameraListPanel
          cameras={filtered}
          query={query}
          onQuery={setQuery}
          selectedId={selectedId}
          onSelect={selectCamera}
        />
      ) : (
        <>
          <EdgeTab label="KAMERA" open={listOpen} dim={uiDim} onClick={() => setListOpen((o) => !o)} />
          <div className={styles.fullListPanel} data-open={listOpen || undefined}>
            <CameraListPanel
              cameras={filtered}
              query={query}
              onQuery={setQuery}
              selectedId={selectedId}
              onSelect={selectCamera}
            />
          </div>
        </>
      )}

      {/* Kolom utama */}
      <div className={styles.main}>
        {!full && (
          <CctvToolbar
            branchName={branchName}
            online={online}
            offline={offline}
            cols={cols}
            onCols={setCols}
            onFull={toggleFull}
          />
        )}

        {loading && cameras.length === 0 ? (
          <div className={styles.gridWrap}>
            <EmptyState icon="cctv" title="Memuat kamera…" />
          </div>
        ) : error && cameras.length === 0 ? (
          <div className={styles.gridWrap}>
            <EmptyState icon="info" title="Gagal memuat kamera" description={error} />
          </div>
        ) : cameras.length === 0 ? (
          <div className={styles.gridWrap}>
            <EmptyState icon="cctv" title="Tidak ada kamera" description="Pilih ruas lain atau periksa data kamera." />
          </div>
        ) : (
          <CameraGrid cameras={gridCameras} cols={cols} full={full} selectedId={selectedId} />
        )}

        {full && (
          <FloatingToolbar dim={uiDim} onExit={toggleFull}>
            {pageCount > 1 && (
              <span className={styles.pager}>
                <button className={styles.pagerBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Halaman sebelumnya">
                  ‹
                </button>
                <span className={styles.pagerLabel}>
                  {page}/{pageCount}
                </span>
                <button className={styles.pagerBtn} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} aria-label="Halaman berikutnya">
                  ›
                </button>
              </span>
            )}
            <Tabs value={String(cols)} onValueChange={(v) => setCols(Number(v))} items={GRID_TABS} />
          </FloatingToolbar>
        )}
      </div>
    </div>
  );
}
