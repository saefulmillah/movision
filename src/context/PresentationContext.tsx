import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPeriod as getLrPeriod, getPeriods as getLrPeriods } from "@/lib/labaRugi";
import { getMatrix, getPeriod as getRiskPeriod, getPeriods as getRiskPeriods } from "@/lib/risk";
import { getPeriod as getPendPeriod, getPeriods as getPendPeriods } from "@/lib/pendapatan";
import type { PeriodData as LrPeriodData } from "@/types/labaRugi";
import type { PeriodData as RiskPeriodData, RiskMatrix } from "@/types/risk";
import type { PeriodData as PendPeriodData } from "@/types/pendapatan";
import { DEFAULT_ORDER, SLIDES } from "@/components/presentation/slideRegistry";
import { isPdfSlide, makePdfSlideId, parsePdfSlide, prunePdfSlides } from "@/components/presentation/pdfSlides";
import { listPdfs, type PdfDoc } from "@/lib/presentationPdf";

export type PresentationMode = "builder" | "present";

export interface PeriodOption {
  key: string;
  label: string;
}

/** Snapshot beku satu periode — diambil sekali per periode saat presentasi. */
export interface PeriodSnapshot {
  lr: LrPeriodData | null;
  risk: RiskPeriodData | null;
  pend: PendPeriodData | null;
}

interface SnapshotState {
  loading: boolean;
  error: string | null;
  data: PeriodSnapshot | null;
}

interface PresentationContextValue {
  mode: PresentationMode;
  period: string;
  periodLabel: string;
  periods: PeriodOption[];
  order: string[];
  enabled: Record<string, boolean>;
  activeSlides: string[];
  cur: number;
  auto: boolean;
  autoSec: number;
  matrix: RiskMatrix | null;
  snapshot: SnapshotState;
  // Dokumen PDF (tiap halaman jadi slide).
  pdfs: PdfDoc[];
  refreshPdfs: () => Promise<void>;
  addPdf: (pdf: PdfDoc) => void;
  removePdfFromAgenda: (pdfId: number) => void;
  // Konten slide pembuka (editable di builder).
  meetingTitle: string;
  meetingSubtitle: string;
  meetingDate: string;
  setMeetingTitle: (v: string) => void;
  setMeetingSubtitle: (v: string) => void;
  setMeetingDate: (v: string) => void;
  setPeriod: (key: string) => void;
  refreshPeriods: () => Promise<void>;
  toggleEnabled: (id: string) => void;
  move: (id: string, dir: number) => void;
  toggleAuto: () => void;
  setAutoSec: (sec: number) => void;
  start: () => void;
  exit: () => void;
  next: (wrap?: boolean) => void;
  prev: () => void;
  goto: (index: number) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

// Pengaturan builder yang dipertahankan antar-sesi (localStorage).
const STORE_KEY = "tollsentra.presentation";

interface PersistState {
  order: string[];
  enabled: Record<string, boolean>;
  period: string;
  meetingTitle: string;
  meetingSubtitle: string;
  meetingDate: string;
  auto: boolean;
  autoSec: number;
}

function loadPersisted(): Partial<PersistState> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistState>) : {};
  } catch {
    return {};
  }
}

/** Gabungkan urutan tersimpan dengan registry saat ini: buang id yang tak dikenal
 *  lagi, dan sisipkan slide baru (mis. Pendapatan) sebelum "closing" agar penutup
 *  tetap terakhir. Tanpa data tersimpan → pakai DEFAULT_ORDER apa adanya. */
function reconcileOrder(saved?: string[]): string[] {
  const valid = Array.isArray(saved) ? saved.filter((id) => id in SLIDES || isPdfSlide(id)) : [];
  if (valid.length === 0) return [...DEFAULT_ORDER];
  const merged = [...valid];
  for (const id of DEFAULT_ORDER) {
    if (merged.includes(id)) continue;
    const closingIdx = merged.indexOf("closing");
    if (closingIdx >= 0) merged.splice(closingIdx, 0, id);
    else merged.push(id);
  }
  return merged;
}

function initialEnabled(order: string[], saved?: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(order.map((id) => [id, saved?.[id] ?? true]));
}

export function PresentationProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [persisted] = useState<Partial<PersistState>>(loadPersisted);
  const [mode, setMode] = useState<PresentationMode>("builder");
  const [period, setPeriodState] = useState(persisted.period ?? "");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [order, setOrder] = useState<string[]>(() => reconcileOrder(persisted.order));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    initialEnabled(reconcileOrder(persisted.order), persisted.enabled)
  );
  const [cur, setCur] = useState(0);
  const [auto, setAuto] = useState(persisted.auto ?? false);
  const [autoSec, setAutoSecState] = useState(persisted.autoSec ?? 8);

  const [matrix, setMatrix] = useState<RiskMatrix | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotState>({ loading: false, error: null, data: null });
  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);

  const [meetingTitle, setMeetingTitle] = useState(persisted.meetingTitle ?? "Rapat Direktorat");
  const [meetingSubtitle, setMeetingSubtitle] = useState(
    persisted.meetingSubtitle ??
      "Kinerja Laba Rugi, Manajemen Risiko, dan Pendapatan Divisi Operasi & Pemeliharaan Jalan Tol."
  );
  const [meetingDate, setMeetingDate] = useState(persisted.meetingDate ?? new Date().toISOString().slice(0, 10));

  // Cache snapshot per periode agar tidak fetch ulang saat bolak-balik.
  const snapCache = useRef<Map<string, PeriodSnapshot>>(new Map());

  // Simpan pengaturan builder (urutan, slide aktif, periode, konten pembuka,
  // auto-play) agar bertahan antar-sesi / reload.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ order, enabled, period, meetingTitle, meetingSubtitle, meetingDate, auto, autoSec })
      );
    } catch {
      /* abaikan kuota / mode privasi localStorage */
    }
  }, [order, enabled, period, meetingTitle, meetingSubtitle, meetingDate, auto, autoSec]);

  const activeSlides = useMemo(() => order.filter((id) => enabled[id]), [order, enabled]);
  const periodLabel = useMemo(
    () => periods.find((p) => p.key === period)?.label || period || "—",
    [periods, period]
  );

  // Daftar periode = gabungan periode Laba Rugi + Manajemen Risiko + Pendapatan
  // (dedupe by key). Dipanggil saat login DAN tiap builder Presentasi dibuka
  // (via refreshPeriods) agar periode yang baru di-import langsung tampil.
  const refreshPeriods = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const [lrList, riskList, pendList] = await Promise.all([
      getLrPeriods().catch(() => []),
      getRiskPeriods().catch(() => []),
      getPendPeriods().catch(() => [])
    ]);
    const byKey = new Map<string, string>();
    // Risiko & Pendapatan dulu, lalu LR menimpa label (label "SD ..." lebih deskriptif untuk rapat).
    for (const r of riskList) byKey.set(r.key, r.label);
    for (const pnd of pendList) byKey.set(pnd.key, pnd.label_sd || pnd.label_month || pnd.key);
    for (const l of lrList) byKey.set(l.key, l.label);
    const list = [...byKey.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
    setPeriods(list);
    setPeriodState((prev) => (prev && list.some((p) => p.key === prev) ? prev : list[0]?.key ?? ""));
  }, [authStatus]);

  useEffect(() => {
    void refreshPeriods();
  }, [refreshPeriods]);

  // Ambil matriks risiko sekali (independen periode).
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let alive = true;
    getMatrix()
      .then((m) => alive && setMatrix(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authStatus]);

  // Daftar dokumen PDF — di-fetch saat login & tiap builder dibuka. Setelah berhasil,
  // pangkas slide pdf di agenda yang dokumennya sudah dihapus.
  const refreshPdfs = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    try {
      const list = await listPdfs();
      setPdfs(list);
      setOrder((o) => prunePdfSlides(o, list));
    } catch {
      /* biarkan agenda apa adanya bila gagal fetch */
    }
  }, [authStatus]);

  useEffect(() => {
    void refreshPdfs();
  }, [refreshPdfs]);

  // Sisipkan semua halaman sebuah PDF sebagai slide (sebelum "closing"), aktif.
  const addPdf = useCallback((pdf: PdfDoc) => {
    const pages = pdf.page_count && pdf.page_count > 0 ? pdf.page_count : 1;
    const ids = Array.from({ length: pages }, (_, i) => makePdfSlideId(pdf.id, i + 1));
    setOrder((o) => {
      const existing = new Set(o);
      const toAdd = ids.filter((id) => !existing.has(id));
      if (toAdd.length === 0) return o;
      const arr = o.slice();
      const closingIdx = arr.indexOf("closing");
      if (closingIdx >= 0) arr.splice(closingIdx, 0, ...toAdd);
      else arr.push(...toAdd);
      return arr;
    });
    setEnabled((e) => {
      const next = { ...e };
      for (const id of ids) if (next[id] === undefined) next[id] = true;
      return next;
    });
  }, []);

  const removePdfFromAgenda = useCallback((pdfId: number) => {
    setOrder((o) =>
      o.filter((id) => {
        const meta = parsePdfSlide(id);
        return !(meta && meta.pdfId === pdfId);
      })
    );
  }, []);

  const loadSnapshot = useCallback(async (key: string) => {
    if (!key) {
      setSnapshot({ loading: false, error: null, data: null });
      return;
    }
    const cached = snapCache.current.get(key);
    if (cached) {
      setSnapshot({ loading: false, error: null, data: cached });
      return;
    }
    setSnapshot({ loading: true, error: null, data: null });
    const [lr, risk, pend] = await Promise.all([
      getLrPeriod(key).catch(() => null),
      getRiskPeriod(key).catch(() => null),
      getPendPeriod(key).catch(() => null)
    ]);
    const data: PeriodSnapshot = { lr, risk, pend };
    snapCache.current.set(key, data);
    setSnapshot({ loading: false, error: null, data });
  }, []);

  // Muat snapshot ketika masuk mode presentasi atau ganti periode saat presentasi.
  useEffect(() => {
    if (mode === "present") void loadSnapshot(period);
  }, [mode, period, loadSnapshot]);

  const setPeriod = useCallback((key: string) => setPeriodState(key), []);
  const toggleEnabled = useCallback((id: string) => setEnabled((e) => ({ ...e, [id]: !e[id] })), []);
  const move = useCallback((id: string, dir: number) => {
    setOrder((o) => {
      const arr = o.slice();
      const i = arr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return o;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }, []);
  const toggleAuto = useCallback(() => setAuto((a) => !a), []);
  const setAutoSec = useCallback((sec: number) => setAutoSecState(Math.max(4, Math.min(30, sec))), []);

  const start = useCallback(() => {
    setCur(0);
    setMode("present");
  }, []);
  const exit = useCallback(() => setMode("builder"), []);

  const nextRef = useRef<number>(0);
  nextRef.current = activeSlides.length;
  const next = useCallback((wrap = false) => {
    setCur((c) => {
      const n = nextRef.current;
      if (n === 0) return 0;
      return c + 1 >= n ? (wrap ? 0 : n - 1) : c + 1;
    });
  }, []);
  const prev = useCallback(() => setCur((c) => Math.max(0, c - 1)), []);
  const goto = useCallback((index: number) => setCur(index), []);

  // Jaga cur tetap dalam rentang bila jumlah slide aktif berubah.
  useEffect(() => {
    setCur((c) => Math.min(c, Math.max(0, activeSlides.length - 1)));
  }, [activeSlides.length]);

  const value: PresentationContextValue = {
    mode,
    period,
    periodLabel,
    periods,
    order,
    enabled,
    activeSlides,
    cur,
    auto,
    autoSec,
    matrix,
    snapshot,
    pdfs,
    refreshPdfs,
    addPdf,
    removePdfFromAgenda,
    meetingTitle,
    meetingSubtitle,
    meetingDate,
    setMeetingTitle,
    setMeetingSubtitle,
    setMeetingDate,
    setPeriod,
    refreshPeriods,
    toggleEnabled,
    move,
    toggleAuto,
    setAutoSec,
    start,
    exit,
    next,
    prev,
    goto
  };

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation(): PresentationContextValue {
  const ctx = useContext(PresentationContext);
  if (!ctx) throw new Error("usePresentation harus dipakai di dalam PresentationProvider");
  return ctx;
}
