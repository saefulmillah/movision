import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPeriod as getLrPeriod, getPeriods as getLrPeriods } from "@/lib/labaRugi";
import { getMatrix, getPeriod as getRiskPeriod, getPeriods as getRiskPeriods } from "@/lib/risk";
import { getPeriod as getPendPeriod, getPeriods as getPendPeriods } from "@/lib/pendapatan";
import { getDashboard as getSentimentDashboard, getPeriods as getSentimentPeriods } from "@/lib/sentiment";
import { getOdolPresentation } from "@/lib/insights";
import { getKinerjaRegional, type KinerjaRegionalData } from "@/lib/kinerjaRegional";
import { getLhrPhrEval, type LhrPhrEvalData } from "@/lib/lhrPhrEval";
import type { PeriodData as LrPeriodData } from "@/types/labaRugi";
import type { PeriodData as RiskPeriodData, RiskMatrix } from "@/types/risk";
import type { PeriodData as PendPeriodData } from "@/types/pendapatan";
import type { SentimentDashboard } from "@/types/sentiment";
import type { OdolPresentation } from "@/types/insights";
import { DEFAULT_ORDER, SLIDES, isSlideAllowedForScope } from "@/components/presentation/slideRegistry";
import { isPdfSlide, makePdfSlideId, parsePdfSlide, prunePdfSlides } from "@/components/presentation/pdfSlides";
import { isCustomCover, makeCustomCoverId } from "@/components/presentation/customCover";
import { getAgenda, saveAgenda, resetAgenda as resetAgendaApi, type PresentationConfig } from "@/lib/presentationConfig";
import {
  getPresentationScopes,
  flattenScopes,
  type PresentationScope,
  type PresentationScopesResponse
} from "@/lib/presentationScope";
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
  sentiment: SentimentDashboard | null;
  odol: OdolPresentation | null;
  /** Kinerja Regional (hanya diisi untuk scope regional; null selainnya). */
  kinerja: KinerjaRegionalData | null;
  /** Pencapaian LHR & PHR vs BP (hanya scope regional; null selainnya). */
  lhrPhrEval: LhrPhrEvalData | null;
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
  /** Muat ulang agenda (scope aktif) dari server (dipanggil saat builder dibuka). */
  refreshAgenda: () => Promise<void>;
  /** true bila scope aktif memakai override sendiri (bukan bawaan divisi). */
  agendaIsOverride: boolean;
  /** Hapus override agenda scope aktif → kembali ke bawaan divisi. */
  resetAgenda: () => Promise<void>;
  // Scope presentasi (divisi/regional/cabang) — Fase 1: pemilihan saja.
  scope: PresentationScope | null;
  scopeInfo: PresentationScopesResponse | null;
  setScope: (scope: PresentationScope) => void;
  refreshScopes: () => Promise<void>;
  /** Buang cache snapshot (periode×scope) agar data dimuat ulang — dipakai setelah
   *  upload dataset kinerja per-scope. Tanpa argumen → kosongkan seluruh cache. */
  invalidateSnapshot: (key?: string, scopeKey?: string) => void;
  addPdf: (pdf: PdfDoc) => void;
  removePdfFromAgenda: (pdfId: number) => void;
  // Konten slide pembuka (editable di builder).
  meetingTitle: string;
  meetingSubtitle: string;
  meetingDate: string;
  // Override judul per-item slide (builder). Kosong → pakai judul default registry.
  titles: Record<string, string>;
  setSlideTitle: (id: string, title: string) => void;
  // Override subjudul per-slide (dipakai slide sampul kustom). Kosong → tanpa subjudul.
  subtitles: Record<string, string>;
  setSlideSubtitle: (id: string, subtitle: string) => void;
  setMeetingTitle: (v: string) => void;
  setMeetingSubtitle: (v: string) => void;
  setMeetingDate: (v: string) => void;
  setPeriod: (key: string) => void;
  refreshPeriods: () => Promise<void>;
  toggleEnabled: (id: string) => void;
  move: (id: string, dir: number) => void;
  /** Pindahkan slide dari posisi `from` ke `to` (untuk drag-and-drop). */
  reorder: (from: number, to: number) => void;
  /** Tambah slide sampul kustom (pembatas). Bila `afterId` diisi, sisipkan tepat
   *  setelah slide tersebut; jika tidak, sebelum "closing". */
  addCoverSlide: (afterId?: string) => void;
  /** Hapus slide sampul kustom dari agenda. */
  removeCoverSlide: (id: string) => void;
  toggleAuto: () => void;
  setAutoSec: (sec: number) => void;
  start: () => void;
  exit: () => void;
  next: (wrap?: boolean) => void;
  prev: () => void;
  goto: (index: number) => void;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

interface PersistState {
  order: string[];
  enabled: Record<string, boolean>;
  period: string;
  meetingTitle: string;
  meetingSubtitle: string;
  meetingDate: string;
  titles: Record<string, string>;
  subtitles: Record<string, string>;
  auto: boolean;
  autoSec: number;
}

// Sumber kebenaran agenda = server PER SCOPE (lihat loadScopeData). Tak ada lagi
// cache localStorage global karena menyebabkan kontaminasi lintas-scope saat mount
// (state awal scope lama tampil sebelum data scope aktif termuat). State awal =
// default; data benar dimuat oleh loadScopeData begitu scope ter-resolve.
function loadPersisted(): Partial<PersistState> {
  return {};
}

/** Gabungkan urutan tersimpan dengan registry saat ini: buang id yang tak dikenal
 *  lagi, dan sisipkan slide baru (mis. Pendapatan) sebelum "closing" agar penutup
 *  tetap terakhir. Tanpa data tersimpan → pakai DEFAULT_ORDER apa adanya. */
function reconcileOrder(saved?: string[]): string[] {
  const valid = Array.isArray(saved) ? saved.filter((id) => id in SLIDES || isPdfSlide(id) || isCustomCover(id)) : [];
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
  const [titles, setTitles] = useState<Record<string, string>>(persisted.titles ?? {});
  const [subtitles, setSubtitles] = useState<Record<string, string>>(persisted.subtitles ?? {});
  const [scope, setScopeState] = useState<PresentationScope | null>(null);
  const [scopeInfo, setScopeInfo] = useState<PresentationScopesResponse | null>(null);

  // Cache snapshot per periode agar tidak fetch ulang saat bolak-balik.
  const snapCache = useRef<Map<string, PeriodSnapshot>>(new Map());

  // Sinkronisasi agenda per scope (server). saveTimerRef men-debounce PUT agar
  // tidak spam saat drag/ketik.
  // agendaLoadedForRef = scope yang agendanya SUDAH termuat (gating simpan agar
  // tak menulis config scope lain / default sebelum scope aktif benar-benar dimuat).
  const agendaLoadedForRef = useRef<string | null>(null);
  // true setelah scope pertama ter-resolve (jangan muat agenda/PDF sebelum ini,
  // agar tidak sempat memuat "divisi" saat scope sebenarnya belum diketahui).
  const scopeResolvedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lewati satu kali penyimpanan ke server tepat setelah menerapkan konfig dari
  // server (hindari menulis balik data yang baru saja dimuat).
  const skipServerSaveRef = useRef(false);
  const [agendaIsOverride, setAgendaIsOverride] = useState(false);
  // Kunci scope aktif terbaru (untuk target simpan/muat agenda tanpa stale closure).
  const scopeKeyRef = useRef("divisi");
  scopeKeyRef.current = scope?.key ?? "divisi";

  // Simpan pengaturan builder ke server (per scope aktif, di-debounce).
  useEffect(() => {
    const cfg: PresentationConfig = {
      order,
      enabled,
      period,
      meetingTitle,
      meetingSubtitle,
      meetingDate,
      titles,
      subtitles,
      auto,
      autoSec
    };
    // Hanya simpan setelah agenda SCOPE AKTIF termuat (hindari menulis config
    // scope lain / default saat masih berpindah scope).
    if (agendaLoadedForRef.current !== scopeKeyRef.current) return;
    // Lewati echo tepat setelah loadScopeData (data baru saja dimuat dari server).
    if (skipServerSaveRef.current) {
      skipServerSaveRef.current = false;
      return;
    }
    // Edit asli → scope ini punya deck tersimpan (umpan balik UI tombol reset).
    setAgendaIsOverride(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Simpan ke scope aktif: divisi → bawaan (base); regional/cabang → override.
      void saveAgenda(scopeKeyRef.current, cfg).catch(() => {
        /* biarkan localStorage sbg cadangan bila server gagal */
      });
    }, 800);
  }, [order, enabled, period, meetingTitle, meetingSubtitle, meetingDate, titles, subtitles, auto, autoSec]);

  const activeSlides = useMemo(
    () => order.filter((id) => enabled[id] && isSlideAllowedForScope(id, scope?.level)),
    [order, enabled, scope]
  );
  const periodLabel = useMemo(
    () => periods.find((p) => p.key === period)?.label || period || "—",
    [periods, period]
  );

  // Daftar periode = gabungan periode Laba Rugi + Manajemen Risiko + Pendapatan
  // (dedupe by key). Dipanggil saat login DAN tiap builder Presentasi dibuka
  // (via refreshPeriods) agar periode yang baru di-import langsung tampil.
  const refreshPeriods = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const [lrList, riskList, pendList, sentList] = await Promise.all([
      getLrPeriods().catch(() => []),
      getRiskPeriods().catch(() => []),
      getPendPeriods().catch(() => []),
      getSentimentPeriods().catch(() => [])
    ]);
    const byKey = new Map<string, string>();
    // Risiko, Pendapatan & Sentimen dulu, lalu LR menimpa label (label "SD ..." lebih deskriptif untuk rapat).
    for (const r of riskList) byKey.set(r.key, r.label);
    for (const pnd of pendList) byKey.set(pnd.key, pnd.label_sd || pnd.label_month || pnd.key);
    for (const s of sentList) byKey.set(s.key, s.label);
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

  // Muat ulang daftar PDF scope aktif (dipakai setelah upload/hapus). Aman-scope:
  // abaikan hasil basi bila scope sudah berganti.
  const refreshPdfs = useCallback(async () => {
    const sk = scopeKeyRef.current;
    if (authStatus !== "authenticated" || !sk || !scopeResolvedRef.current) return;
    try {
      const list = await listPdfs(sk);
      if (scopeKeyRef.current !== sk) return;
      setPdfs(list);
      setOrder((o) => prunePdfSlides(o, list));
    } catch {
      /* biarkan apa adanya bila gagal fetch */
    }
  }, [authStatus]);

  // Muat agenda + daftar PDF sebuah scope SECARA ATOMIK — hindari race & kontaminasi
  // antar-scope: fetch keduanya, abaikan bila scope sudah berganti, lalu terapkan
  // order (dipangkas terhadap PDF scope itu) + PDF sekaligus. Scope tanpa deck →
  // config null → DEFAULT_ORDER bawaan.
  const loadScopeData = useCallback(
    async (sk: string | null) => {
      if (authStatus !== "authenticated" || !sk || !scopeResolvedRef.current) return;
      const [agendaRes, pdfList] = await Promise.all([
        getAgenda(sk).catch(() => null),
        listPdfs(sk).catch(() => [] as PdfDoc[])
      ]);
      if (scopeKeyRef.current !== sk) return; // scope sudah berganti → hasil basi
      const cfg = (agendaRes?.config ?? {}) as Partial<PresentationConfig>;
      const ord = prunePdfSlides(
        reconcileOrder(Array.isArray(cfg.order) ? cfg.order : undefined),
        pdfList
      );
      skipServerSaveRef.current = true;
      setPdfs(pdfList);
      setOrder(ord);
      setEnabled(initialEnabled(ord, cfg.enabled));
      if (typeof cfg.period === "string") setPeriodState(cfg.period);
      if (typeof cfg.meetingTitle === "string") setMeetingTitle(cfg.meetingTitle);
      if (typeof cfg.meetingSubtitle === "string") setMeetingSubtitle(cfg.meetingSubtitle);
      if (typeof cfg.meetingDate === "string") setMeetingDate(cfg.meetingDate);
      setTitles(cfg.titles && typeof cfg.titles === "object" ? cfg.titles : {});
      setSubtitles(cfg.subtitles && typeof cfg.subtitles === "object" ? cfg.subtitles : {});
      if (typeof cfg.auto === "boolean") setAuto(cfg.auto);
      if (typeof cfg.autoSec === "number") setAutoSecState(cfg.autoSec);
      setAgendaIsOverride(Boolean(agendaRes?.isOverride));
      agendaLoadedForRef.current = sk;
    },
    [authStatus]
  );

  // Dipakai builder saat dibuka: muat ulang scope aktif.
  const refreshAgenda = useCallback(async () => {
    await loadScopeData(scopeKeyRef.current);
  }, [loadScopeData]);

  // Muat data scope saat scope ter-resolve / berganti.
  useEffect(() => {
    void loadScopeData(scope?.key ?? null);
  }, [scope?.key, loadScopeData]);

  const resetAgenda = useCallback(async () => {
    const sk = scopeKeyRef.current || "divisi";
    try {
      await resetAgendaApi(sk);
      await loadScopeData(sk);
    } catch {
      /* abaikan */
    }
  }, [loadScopeData]);

  // Scope presentasi: tingkat yang boleh dipresentasikan user (dari branch-scope).
  const SCOPE_KEY = "tollsentra.presentation.scope";
  const setScope = useCallback((s: PresentationScope) => {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, s.key);
    } catch {
      /* abaikan */
    }
  }, []);

  const refreshScopes = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    try {
      const info = await getPresentationScopes();
      setScopeInfo(info);
      scopeResolvedRef.current = true;
      const all = flattenScopes(info);
      setScopeState((cur) => {
        let savedKey = cur?.key || null;
        if (!savedKey) {
          try {
            savedKey = localStorage.getItem(SCOPE_KEY);
          } catch {
            savedKey = null;
          }
        }
        const match = savedKey ? all.find((s) => s.key === savedKey) : null;
        return match || info.default || null;
      });
    } catch {
      /* abaikan — scope tetap null, builder jalan tanpa pemilih */
    }
  }, [authStatus]);

  useEffect(() => {
    void refreshScopes();
  }, [refreshScopes]);

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

  // Snapshot di-cache per periode × scope (LR & Pendapatan difilter per scope di
  // backend; Risiko masih level-divisi sampai Fase 4, jadi tak di-scope).
  const loadSnapshot = useCallback(async (key: string, scopeKey: string, scopeLevel?: string | null) => {
    if (!key) {
      setSnapshot({ loading: false, error: null, data: null });
      return;
    }
    const cacheKey = `${key}::${scopeKey}`;
    const cached = snapCache.current.get(cacheKey);
    if (cached) {
      setSnapshot({ loading: false, error: null, data: cached });
      return;
    }
    setSnapshot({ loading: true, error: null, data: null });
    // Slide regional-only (Kinerja Regional, LHR/PHR vs BP) hanya di-fetch utk scope regional.
    const kinerjaReq = scopeLevel === "regional" ? getKinerjaRegional(key, scopeKey).catch(() => null) : Promise.resolve(null);
    const lhrPhrReq = scopeLevel === "regional" ? getLhrPhrEval(key, scopeKey).catch(() => null) : Promise.resolve(null);
    const [lr, risk, pend, sentiment, odol, kinerja, lhrPhrEval] = await Promise.all([
      getLrPeriod(key, scopeKey).catch(() => null),
      getRiskPeriod(key, scopeKey).catch(() => null),
      getPendPeriod(key, scopeKey).catch(() => null),
      getSentimentDashboard(key, scopeKey).catch(() => null),
      getOdolPresentation(scopeKey).catch(() => null),
      kinerjaReq,
      lhrPhrReq
    ]);
    const data: PeriodSnapshot = { lr, risk, pend, sentiment, odol, kinerja, lhrPhrEval };
    snapCache.current.set(cacheKey, data);
    setSnapshot({ loading: false, error: null, data });
  }, []);

  // Buang cache snapshot agar data dimuat ulang (dipakai setelah upload dataset
  // kinerja per-scope). Bila periode & scope yang dibuang = yang sedang aktif di
  // mode presentasi, muat ulang segera.
  const invalidateSnapshot = useCallback(
    (key?: string, scopeKey?: string) => {
      if (!key) {
        snapCache.current.clear();
      } else {
        snapCache.current.delete(`${key}::${scopeKey ?? "divisi"}`);
      }
      if (mode === "present" && (!key || (key === period && (scopeKey ?? "divisi") === (scope?.key ?? "divisi")))) {
        void loadSnapshot(period, scope?.key ?? "divisi", scope?.level);
      }
    },
    [mode, period, scope, loadSnapshot]
  );

  // Muat snapshot ketika masuk mode presentasi, ganti periode, atau ganti scope.
  useEffect(() => {
    if (mode === "present") void loadSnapshot(period, scope?.key ?? "divisi", scope?.level);
  }, [mode, period, scope, loadSnapshot]);

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
  const reorder = useCallback((from: number, to: number) => {
    setOrder((o) => {
      if (from === to || from < 0 || to < 0 || from >= o.length || to >= o.length) return o;
      const arr = o.slice();
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, []);
  const addCoverSlide = useCallback((afterId?: string) => {
    const id = makeCustomCoverId();
    setOrder((o) => {
      const arr = o.slice();
      let at = -1;
      if (afterId) {
        const i = arr.indexOf(afterId);
        if (i >= 0) at = i + 1;
      }
      if (at < 0) {
        const closingIdx = arr.indexOf("closing");
        at = closingIdx >= 0 ? closingIdx : arr.length;
      }
      arr.splice(at, 0, id);
      return arr;
    });
    setEnabled((e) => ({ ...e, [id]: true }));
    setTitles((t) => ({ ...t, [id]: "Sampul Baru" }));
  }, []);
  const removeCoverSlide = useCallback((id: string) => {
    setOrder((o) => o.filter((x) => x !== id));
    setTitles((t) => {
      if (!(id in t)) return t;
      const next = { ...t };
      delete next[id];
      return next;
    });
    setSubtitles((s) => {
      if (!(id in s)) return s;
      const next = { ...s };
      delete next[id];
      return next;
    });
  }, []);
  const setSlideTitle = useCallback((id: string, title: string) => {
    setTitles((t) => {
      const v = title.trim();
      const next = { ...t };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });
  }, []);
  const setSlideSubtitle = useCallback((id: string, subtitle: string) => {
    setSubtitles((s) => {
      const v = subtitle.trim();
      const next = { ...s };
      if (v) next[id] = v;
      else delete next[id];
      return next;
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
    refreshAgenda,
    agendaIsOverride,
    resetAgenda,
    scope,
    scopeInfo,
    setScope,
    refreshScopes,
    invalidateSnapshot,
    addPdf,
    removePdfFromAgenda,
    meetingTitle,
    meetingSubtitle,
    meetingDate,
    titles,
    setSlideTitle,
    subtitles,
    setSlideSubtitle,
    setMeetingTitle,
    setMeetingSubtitle,
    setMeetingDate,
    setPeriod,
    refreshPeriods,
    toggleEnabled,
    move,
    reorder,
    addCoverSlide,
    removeCoverSlide,
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
