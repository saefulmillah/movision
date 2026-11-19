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
import type { FitRequest, LatLng } from "./MapView";
import type { DensityTip } from "./useMapOverlays";
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
import { ROUTE_LAYERS } from "./routeLayers";
import type { RouteKey } from "./routeLayers";
import { trafficFlow, levelMeta } from "@/lib/trafficFlow";
import { buildArahIndex, buildBranchArah, normGate, resolveClickToArah } from "./arusResolver";
import type { GateConcern } from "./layers";
import { ArusLalinPanel } from "./ArusLalinPanel";
import type { TrafficSel } from "./ArusLalinPanel";
import styles from "./peta.module.css";

const AUTO_HIDE_MS = 2600;

function initVisibility(): Record<LayerKey, boolean> {
  const out = {} as Record<LayerKey, boolean>;
  for (const l of LAYERS) out[l.key] = l.defaultOn;
  return out;
}

function initRouteVisibility(): Record<RouteKey, boolean> {
  const out = {} as Record<RouteKey, boolean>;
  for (const l of ROUTE_LAYERS) out[l.key] = l.defaultOn;
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
  // Pemetaan gerbang→arah (konfigurasi, ambil sekali) untuk resolver klik vektor.
  const arahMapQ = usePolling(() => trafficFlow.arahMap(), 0);
  // Gerbang "jadi perhatian" (ramai/padat/kritis) untuk status kepadatan di peta.
  const rankQ = usePolling(() => trafficFlow.ranking({ min_level: "ramai", limit: 80 }), 60000);

  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(initVisibility);
  const [routeVisible, setRouteVisible] = useState<Record<RouteKey, boolean>>(initRouteVisibility);
  // Toggle "Status Kepadatan": marker gerbang padat + tooltip persisten,
  // independen dari toggle "Gerbang Tol".
  const [densityOn, setDensityOn] = useState(true);
  const [panelMode, setPanelMode] = useState<PanelMode>("empty");
  const [listKey, setListKey] = useState<LayerKey | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<ListItem | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [fitRequest, setFitRequest] = useState<FitRequest | null>(null);
  const [trafficSel, setTrafficSel] = useState<TrafficSel | null>(null);

  const [full, setFull] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [mapTheme, setMapTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("peta-map-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const toggleMapTheme = useCallback(() => {
    setMapTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("peta-map-theme", next);
      } catch {
        /* storage tak tersedia — abaikan */
      }
      return next;
    });
  }, []);

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

  // Peta nama-gerbang(ternormalisasi) → status kepadatan, untuk marker gerbang.
  const gateConcern = useMemo(() => {
    const m = new Map<string, GateConcern>();
    for (const it of rankQ.data?.items ?? []) {
      const meta = levelMeta(it.level);
      m.set(normGate(it.gb_tujuan), {
        label: meta.label,
        color: meta.color,
        pct: `${Math.round((it.rho ?? 0) * 100)}%`
      });
    }
    return m;
  }, [rankQ.data]);

  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    const add = (arr: (MapPoint | null)[]) => {
      for (const p of arr) if (p) pts.push(p);
    };
    if (visible.cctv) add(groups.cctv.map((a) => assetToPoint(a, "cctv")));
    if (visible.vms) add(groups.vms.map((a) => assetToPoint(a, "vms")));
    if (visible.gps) add(groups.veh.map(vehicleToPoint));
    // Gerbang: layer penuh menampilkan semua gerbang; cincin level hanya saat
    // "Status Kepadatan" aktif. Bila layer Gerbang Tol mati tapi Status Kepadatan
    // aktif → tetap tampilkan gerbang yang padat (beserta tooltip-nya).
    if (visible.gate) {
      add(groups.gates.map((g) => gateToPoint(g, densityOn ? gateConcern : undefined)));
    } else if (densityOn) {
      add(groups.gates.filter((g) => gateConcern.has(normGate(g.gate_name))).map((g) => gateToPoint(g, gateConcern)));
    }
    if (visible.weather) add(groups.wx.map(weatherToPoint));
    if (visible.sos) add(groups.sos.map(sosToPoint));
    if (visible.fo) pts.push(...arcNodesToPoints(groups.fo));
    return pts;
  }, [visible, groups, gateConcern, densityOn]);

  // Tooltip kepadatan persisten: satu per gerbang yang sedang jadi perhatian.
  const densityTips = useMemo<DensityTip[]>(() => {
    if (!densityOn) return [];
    const out: DensityTip[] = [];
    for (const g of groups.gates) {
      if (g.lat == null || g.lng == null) continue;
      const dens = gateConcern.get(normGate(g.gate_name));
      if (!dens) continue;
      out.push({ id: `dens-${g.gate_id}`, lat: g.lat, lng: g.lng, label: dens.label, color: dens.color, pct: `terisi ${dens.pct}` });
    }
    return out;
  }, [densityOn, groups.gates, gateConcern]);

  // --- Auto zoom & center ke ruas yang dipilih ---
  // Kumpulan semua koordinat milik ruas aktif (lepas dari visibilitas layer),
  // dipakai menghitung bounds fitBounds.
  const branchCoords = useMemo<LatLng[]>(() => {
    const c: LatLng[] = [];
    // Hanya terima koordinat di dalam kotak wajar Indonesia; buang outlier
    // (data koordinat rusak/0/terbalik) agar bounds tidak meledak.
    const sane = (lat: number, lng: number) => lat >= -11 && lat <= 7 && lng >= 94 && lng <= 142;
    const push = (lat?: number | null, lng?: number | null) => {
      if (lat != null && lng != null && sane(lat, lng)) c.push({ lat, lng });
    };
    // Pakai infrastruktur statis MILIK ruas (gerbang, CCTV, VMS, cuaca).
    // - Kendaraan GPS & SOS dilewati: berpindah → bounds tak stabil.
    // - Node FO dilewati: arc backbone bisa menyambung ke kota lain (mis.
    //   Palembang↔Jakarta) sehingga bounds meledak jauh dari ruas.
    groups.gates.forEach((g) => push(g.lat, g.lng));
    groups.cctv.forEach((a) => push(a.lat, a.lng));
    groups.vms.forEach((a) => push(a.lat, a.lng));
    groups.wx.forEach((w) => push(w.lat, w.lng));
    return c;
  }, [groups]);

  // Tandai perlu fit hanya saat ruas BENAR-BENAR berganti (bukan tiap polling).
  const prevBranchRef = useRef<number | null>(activeBranchId);
  const pendingFitRef = useRef(true); // fit awal sesuai ruas tersimpan
  const fitSeqRef = useRef(0);

  useEffect(() => {
    if (prevBranchRef.current !== activeBranchId) {
      prevBranchRef.current = activeBranchId;
      pendingFitRef.current = true;
    }
  }, [activeBranchId]);

  // Data titik ruas dianggap siap bila muatan awal gerbang & aset selesai
  // (switch ruas memakai data cache → langsung siap; hanya load awal menunggu).
  const fitDataReady = !assetsQ.loading && !gatesQ.loading;

  useEffect(() => {
    if (!pendingFitRef.current) return;
    if (activeBranchId == null) {
      pendingFitRef.current = false;
      fitSeqRef.current += 1;
      setFitRequest({ token: fitSeqRef.current, kind: "overview" });
      return;
    }
    // Tunggu data awal termuat agar bounds dihitung dari seluruh titik ruas,
    // bukan sebagian (menghindari fit prematur yang salah zoom).
    if (!fitDataReady) return;
    const center = activeBranch ? { lat: activeBranch.center_lat, lng: activeBranch.center_lng } : null;
    if (branchCoords.length === 0 && !center) return;
    pendingFitRef.current = false;
    fitSeqRef.current += 1;
    setFitRequest({ token: fitSeqRef.current, kind: "branch", coords: branchCoords, center });
  }, [activeBranchId, activeBranch, branchCoords, fitDataReady]);

  // --- Interaksi panel ---
  const openList = useCallback((key: LayerKey) => {
    setTrafficSel(null);
    setListKey(key);
    setPanelMode("list");
    setSearch("");
    setSelection(null);
    setVisible((v) => (v[key] ? v : { ...v, [key]: true }));
  }, []);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const toggleRoute = useCallback((key: RouteKey) => {
    setRouteVisible((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const toggleDensity = useCallback(() => setDensityOn((v) => !v), []);

  // --- Klik vektor ruas → kartu arus lalin ---
  const arahIndex = useMemo(() => buildArahIndex(arahMapQ.data?.items), [arahMapQ.data]);
  const branchArah = useMemo(() => buildBranchArah(gatesQ.data ?? [], arahIndex), [gatesQ.data, arahIndex]);

  // normName gerbang → gb_tujuan kanonik (untuk ambil streaming CCTV gerbang).
  const gateGbByNorm = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of arahMapQ.data?.items ?? []) {
      const k = normGate(it.gb_tujuan);
      if (k && !m.has(k)) m.set(k, it.gb_tujuan);
    }
    return m;
  }, [arahMapQ.data]);

  // gb_tujuan gerbang yang sedang dibuka detailnya (null bila bukan gerbang).
  const gateStreamGb = useMemo(() => {
    if (panelMode !== "detail" || listKey !== "gate" || !selection) return null;
    const name = (selection.raw as { gate_name?: string } | null)?.gate_name ?? selection.title;
    return gateGbByNorm.get(normGate(name)) ?? null;
  }, [panelMode, listKey, selection, gateGbByNorm]);

  const onRouteClick = useCallback(
    (lat: number, lng: number, info: { functional: boolean; name: string }) => {
      if (info.functional) {
        setTrafficSel({ kind: "functional", roadName: info.name });
        return;
      }
      const r = resolveClickToArah(lat, lng, gatesQ.data ?? [], arahIndex, branchArah);
      setTrafficSel(
        r
          ? { kind: "arah", arah: r.arah, roadName: info.name, gateName: r.gateName }
          : { kind: "untracked", roadName: info.name }
      );
    },
    [gatesQ.data, arahIndex, branchArah]
  );

  const selectItem = useCallback((item: ListItem) => {
    setTrafficSel(null);
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
        setTrafficSel(null);
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
          routeVisible={routeVisible}
          onToggleRoute={toggleRoute}
          densityOn={densityOn}
          densityCount={densityTips.length}
          onToggleDensity={toggleDensity}
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
              routeVisible={routeVisible}
              onToggleRoute={toggleRoute}
              densityOn={densityOn}
              densityCount={densityTips.length}
              onToggleDensity={toggleDensity}
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
        <MapView points={points} arcs={groups.fo} foVisible={visible.fo} routeVisible={routeVisible} densityTips={densityTips} densityOn={densityOn} focus={focus} fitRequest={fitRequest} onSelect={selectByPointId} onRouteClick={onRouteClick} onToggleFull={toggleFull} isFull={full} mapTheme={mapTheme} onToggleTheme={toggleMapTheme} />

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

      {/* Panel kanan — kartu arus lalin (klik vektor) diprioritaskan */}
      {trafficSel ? (
        <ArusLalinPanel sel={trafficSel} onClose={() => setTrafficSel(null)} />
      ) : (!full || showRightPanel) ? (
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
          gateStreamGb={gateStreamGb}
        />
      ) : null}
    </div>
  );
}
