import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useBranch } from "@/context/BranchContext";
import { useTickets } from "@/context/TicketsContext";
import { useSse } from "@/context/SseContext";
import { useClock } from "@/lib/useClock";
import { usePolling } from "@/lib/usePolling";
import { fetchGateAlerts, fetchLiveVehicles, fetchMapAssets, fetchNetworkArcs, fetchWeatherPoints } from "@/lib/monitoring";
import { LayerPanel } from "./LayerPanel";
import { AssetPanel } from "./AssetPanel";
import type { PanelMode } from "./AssetPanel";
import { MapView } from "./MapView";
import {
  LAYERS,
  arcNodesToPoints,
  arcToItem,
  assetToItem,
  assetToPoint,
  gateToItem,
  gateToPoint,
  sosToItem,
  sosToPoint,
  vehicleToItem,
  vehicleToPoint,
  weatherToPoint
} from "./layers";
import type { LayerKey, ListItem, MapPoint } from "./layers";
import styles from "./peta.module.css";

const AUTO_HIDE_MS = 2600;

function initVisibility(): Record<LayerKey, boolean> {
  const out = {} as Record<LayerKey, boolean>;
  for (const l of LAYERS) out[l.key] = l.defaultOn;
  return out;
}

export function PetaPage() {
  const { activeBranchId, activeBranch } = useBranch();
  const { tickets } = useTickets();
  const { status: sseStatus } = useSse();
  const clock = useClock();

  const assetsQ = usePolling(() => fetchMapAssets("cctv,vms"), 60000);
  const gatesQ = usePolling(fetchGateAlerts, 30000);
  const arcsQ = usePolling(fetchNetworkArcs, 60000);
  const vehQ = usePolling(fetchLiveVehicles, 15000);
  const wxQ = usePolling(fetchWeatherPoints, 120000);

  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(initVisibility);
  const [panelMode, setPanelMode] = useState<PanelMode>("empty");
  const [listKey, setListKey] = useState<LayerKey | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<ListItem | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const [full, setFull] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const branchName = activeBranch?.branch_name ?? "Semua Ruas";

  // --- Filter per ruas aktif ---
  const inBranch = useCallback(
    (bid: unknown) => activeBranchId == null || Number(bid) === activeBranchId,
    [activeBranchId]
  );

  const groups = useMemo(() => {
    const assets = assetsQ.data ?? [];
    const cctv = assets.filter((a) => a.asset_type === "cctv" && inBranch(a.branch_id));
    const vms = assets.filter((a) => a.asset_type === "vms" && inBranch(a.branch_id));
    const gates = (gatesQ.data ?? []).filter((g) => inBranch(g.branch_id));
    const veh = (vehQ.data ?? []).filter((v) => inBranch(v.branch_id));
    const wx = (wxQ.data ?? []).filter((w) => inBranch(w.branch_id));
    const sos = tickets.filter((t) => inBranch(t.sos?.branch_id));
    const fo = (arcsQ.data ?? []).filter((e) => inBranch(e.source?.branch_id) || inBranch(e.target?.branch_id));
    return { cctv, vms, gates, veh, wx, sos, fo };
  }, [assetsQ.data, gatesQ.data, vehQ.data, wxQ.data, arcsQ.data, tickets, inBranch]);

  const items = useMemo<Record<LayerKey, ListItem[]>>(
    () => ({
      cctv: groups.cctv.map(assetToItem),
      vms: groups.vms.map(assetToItem),
      fo: groups.fo.map(arcToItem),
      gps: groups.veh.map(vehicleToItem),
      gate: groups.gates.map(gateToItem),
      weather: [],
      sos: groups.sos.map(sosToItem)
    }),
    [groups]
  );

  const counts = useMemo<Record<LayerKey, number>>(
    () => ({
      cctv: groups.cctv.length,
      vms: groups.vms.length,
      fo: groups.fo.length,
      gps: groups.veh.length,
      gate: groups.gates.length,
      weather: groups.wx.length,
      sos: groups.sos.length
    }),
    [groups]
  );

  const badges = useMemo<Record<LayerKey, number>>(
    () => ({
      cctv: groups.cctv.filter((a) => !a.is_online).length,
      vms: groups.vms.filter((a) => !a.is_online).length,
      fo: groups.fo.filter((e) => String(e.status).toLowerCase() !== "normal").length,
      gps: 0,
      gate: groups.gates.filter((g) => ["error", "offline"].includes(String(g.status).toLowerCase())).length,
      weather: 0,
      sos: groups.sos.length
    }),
    [groups]
  );

  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    const add = (arr: (MapPoint | null)[]) => {
      for (const p of arr) if (p) pts.push(p);
    };
    if (visible.cctv) add(groups.cctv.map((a) => assetToPoint(a, "cctv")));
    if (visible.vms) add(groups.vms.map((a) => assetToPoint(a, "vms")));
    if (visible.gps) add(groups.veh.map(vehicleToPoint));
    if (visible.gate) add(groups.gates.map(gateToPoint));
    if (visible.weather) add(groups.wx.map(weatherToPoint));
    if (visible.sos) add(groups.sos.map(sosToPoint));
    if (visible.fo) pts.push(...arcNodesToPoints(groups.fo));
    return pts;
  }, [visible, groups]);

  // --- Interaksi panel ---
  const openList = useCallback((key: LayerKey) => {
    setListKey(key);
    setPanelMode("list");
    setSearch("");
    setSelection(null);
    setVisible((v) => (v[key] ? v : { ...v, [key]: true }));
  }, []);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const selectItem = useCallback((item: ListItem) => {
    setSelection(item);
    setPanelMode("detail");
    if (item.lat && item.lng) setFocus({ lat: item.lat, lng: item.lng });
  }, []);

  // Klik marker di peta → buka detail.
  const selectByPointId = useCallback(
    (pointId: string) => {
      const dash = pointId.indexOf("-");
      const key = pointId.slice(0, dash) as LayerKey;
      const layerItems = items[key];
      if (!layerItems) return;
      const found = layerItems.find((i) => `${key}-${i.id}` === pointId);
      if (found) {
        setListKey(key);
        setSelection(found);
        setPanelMode("detail");
        if (found.lat && found.lng) setFocus({ lat: found.lat, lng: found.lng });
      }
    },
    [items]
  );

  const backToList = useCallback(() => {
    setSelection(null);
    setPanelMode(listKey ? "list" : "empty");
  }, [listKey]);

  const closePanel = useCallback(() => {
    setPanelMode("empty");
    setSelection(null);
    setListKey(null);
  }, []);

  const listItems = useMemo(() => {
    if (!listKey) return [];
    const all = items[listKey] ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((i) => i.title.toLowerCase().includes(q)) : all;
  }, [listKey, items, search]);

  // --- Auto-hide UI mode layar penuh ---
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
      const next = !f;
      if (!next) setLayersOpen(false);
      return next;
    });
  }, []);

  const showRightPanel = panelMode !== "empty";
  const uiDim = full && !uiVisible;

  return (
    <div className={styles.page} data-full={full} onMouseMove={full ? nudgeUi : undefined}>
      {/* Panel layer kiri: normal inline; fullscreen jadi drawer di balik EdgeTab */}
      {!full ? (
        <LayerPanel
          branchName={branchName}
          visible={visible}
          counts={counts}
          badges={badges}
          activeListKey={panelMode !== "empty" ? listKey : null}
          onOpenList={openList}
          onToggle={toggleLayer}
        />
      ) : (
        <>
          <button
            className={styles.edgeTab}
            data-open={layersOpen}
            data-dim={uiDim}
            onClick={() => setLayersOpen((o) => !o)}
          >
            LAYER
          </button>
          <div className={styles.fullLayerPanel} data-open={layersOpen}>
            <LayerPanel
              branchName={branchName}
              visible={visible}
              counts={counts}
              badges={badges}
              activeListKey={panelMode !== "empty" ? listKey : null}
              onOpenList={(k) => {
                openList(k);
              }}
              onToggle={toggleLayer}
            />
          </div>
        </>
      )}

      {/* Kanvas peta */}
      <div className={styles.canvas}>
        {!full && (
          <div className={styles.branchLabel}>
            <Icon name="map" size={15} />
            {branchName}
          </div>
        )}
        <MapView points={points} arcs={groups.fo} foVisible={visible.fo} focus={focus} onSelect={selectByPointId} onToggleFull={toggleFull} isFull={full} />

        {/* Floating toolbar (mode layar penuh) */}
        {full && (
          <div className={styles.floatingToolbar} data-dim={uiDim}>
            <span className={styles.ftItem}>
              <span className={styles.ftDot} data-off={sseStatus !== "open"} />
              {sseStatus === "open" ? "Realtime" : "Terputus"}
            </span>
            <span className={styles.ftSep} />
            <span className={styles.ftItem}>{clock}</span>
            <span className={styles.ftSep} />
            <button className={styles.rpIconBtn} onClick={toggleFull} title="Keluar layar penuh" aria-label="Keluar">
              <Icon name="minimize" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Panel kanan */}
      {(!full || showRightPanel) && (
        <AssetPanel
          key={`${panelMode}-${selection?.id ?? "none"}`}
          mode={panelMode}
          layerKey={listKey}
          items={listItems}
          search={search}
          onSearch={setSearch}
          selection={selection}
          onSelectItem={selectItem}
          onBack={backToList}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
