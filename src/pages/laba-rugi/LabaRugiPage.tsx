import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Modal, Select, Switch, Tabs, useToast } from "@/components/ui";
import type { SelectOption, TabItem } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getPeriod, getPeriods, importPeriod } from "@/lib/labaRugi";
import type {
  Cell,
  EntityData,
  ImportResult,
  Period,
  PeriodData,
  ValidationResult
} from "@/types/labaRugi";
import styles from "./LabaRugiPage.module.css";

/* ------------------------------------------------------------------ *
 * Konfigurasi tampilan (porting dari dashboard-reference.html)
 * ------------------------------------------------------------------ */
type View = "konsol" | "regional" | "ruas";

interface RowDef {
  id: string;
  label: string;
  type: "section" | "sub" | "total" | "hpp";
}
const ROWS: RowDef[] = [
  { id: "pend_usaha", label: "Pend. Usaha", type: "section" },
  { id: "tol", label: "Tol", type: "sub" },
  { id: "usaha_lainnya", label: "Usaha Lainnya", type: "sub" },
  { id: "elektronifikasi", label: "Elektronifikasi", type: "sub" },
  { id: "beban_langsung", label: "Beban Langsung", type: "section" },
  { id: "beban_i", label: "Beban I", type: "sub" },
  { id: "beban_ii", label: "Beban II", type: "sub" },
  { id: "beban_iii", label: "Beban III", type: "sub" },
  { id: "laba_operasi", label: "Laba Operasi", type: "total" },
  { id: "beban_usaha", label: "Beban Usaha", type: "section" },
  { id: "bunga", label: "Bunga", type: "sub" },
  { id: "pajak_tangguhan", label: "Pajak Tangguhan", type: "sub" },
  { id: "eat", label: "EAT", type: "total" },
  { id: "ebitda", label: "EBITDA", type: "total" },
  { id: "hpp", label: "HPP (%)", type: "hpp" }
];

interface RegionDef {
  id: string;
  label: string;
}
const REGIONS: RegionDef[] = [
  { id: "JKT", label: "JKT" },
  { id: "SUMBAGSEL", label: "REG SUMBAGSEL" },
  { id: "SUMBAGTENG", label: "REG SUMBAGTENG" },
  { id: "SUMBAGUT", label: "REG SUMBAGUT" },
  { id: "JTTS", label: "JTTS" },
  { id: "PBBL", label: "PBBL" }
];
const ALL_REGION_IDS = REGIONS.map((r) => r.id);

interface RuasDef {
  id: string;
  grp: string;
  always?: boolean;
}
const RUAS: RuasDef[] = [
  { id: "DIVISI", grp: "DIVISI", always: true },
  { id: "JORR S", grp: "JKT" },
  { id: "ATP", grp: "JKT" },
  { id: "TERPEKA", grp: "SUMBAGSEL" },
  { id: "PALINDRA", grp: "SUMBAGSEL" },
  { id: "INPRABU", grp: "SUMBAGSEL" },
  { id: "BENGTABA", grp: "SUMBAGSEL" },
  { id: "PALTUNG", grp: "SUMBAGSEL" },
  { id: "PERMAI", grp: "SUMBAGTENG" },
  { id: "PEKBANGPAR", grp: "SUMBAGTENG" },
  { id: "PACIN", grp: "SUMBAGTENG" },
  { id: "LINGKAR PKU", grp: "SUMBAGTENG" },
  { id: "SIBANCEH", grp: "SUMBAGUT" },
  { id: "BINBRAN", grp: "SUMBAGUT" },
  { id: "INKIS", grp: "SUMBAGUT" },
  { id: "JTTS", grp: "JTTS", always: true },
  { id: "PBBL", grp: "PBBL", always: true }
];

const TABS: TabItem[] = [
  { value: "konsol", label: "Konsolidasi", icon: "layers" },
  { value: "regional", label: "Per Regional", icon: "building-2" },
  { value: "ruas", label: "Per Ruas", icon: "route" }
];

const STORE_KEY = "tollsentra.labaRugi";
const FS_MIN = 11;
const FS_MAX = 20;
const FS_DEFAULT = 13.5;

/* ------------------------------------------------------------------ *
 * Format & perhitungan
 * ------------------------------------------------------------------ */
interface FmtOut {
  t: string;
  neg: boolean;
}
function fmtNum(v: number | null | undefined): FmtOut {
  if (v == null) return { t: "–", neg: false };
  const r = Math.round(v);
  if (r === 0) return { t: "–", neg: false };
  const neg = r < 0;
  const s = Math.abs(r).toLocaleString("en-US");
  return { t: neg ? `(${s})` : s, neg };
}
function fmtPct(v: number | null | undefined): FmtOut {
  if (v == null) return { t: "–", neg: false };
  return { t: `${Math.round(v)}%`, neg: v > 100 };
}
function hppOf(d: EntityData): Cell {
  const bl = d.beban_langsung;
  const pu = d.pend_usaha;
  const f = (b?: number | null, p?: number | null) =>
    p == null || p === 0 || b == null ? null : (b / p) * 100;
  return [f(bl?.[0], pu?.[0]), f(bl?.[1], pu?.[1])];
}
function cellVal(d: EntityData, rowId: string): Cell {
  if (rowId === "hpp") return hppOf(d);
  return d[rowId] ?? [null, null];
}

/* ------------------------------------------------------------------ *
 * State tersimpan
 * ------------------------------------------------------------------ */
interface PersistState {
  view: View;
  period: string;
  regions: string[];
  konsolCol: boolean;
  showPaltung: boolean;
  fs: number;
}
function loadState(): PersistState {
  const base: PersistState = {
    view: "regional",
    period: "",
    regions: ALL_REGION_IDS,
    konsolCol: false,
    showPaltung: false,
    fs: FS_DEFAULT
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const merged = { ...base, ...saved } as PersistState;
    merged.regions = ALL_REGION_IDS.filter((id) => merged.regions?.includes(id));
    if (!merged.regions.length) merged.regions = ALL_REGION_IDS;
    return merged;
  } catch {
    return base;
  }
}

interface Column {
  label: string;
  tint: string;
  data: EntityData;
  konsol?: boolean;
}

/* ================================================================== */
export function LabaRugiPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("laba_rugi");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const [view, setView] = useState<View>(() => loadState().view);
  const [period, setPeriod] = useState<string>(() => loadState().period);
  const [regions, setRegions] = useState<string[]>(() => loadState().regions);
  const [konsolCol, setKonsolCol] = useState<boolean>(() => loadState().konsolCol);
  const [showPaltung, setShowPaltung] = useState<boolean>(() => loadState().showPaltung);
  const [fs, setFs] = useState<number>(() => loadState().fs);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [data, setData] = useState<PeriodData | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [validationView, setValidationView] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Persist preferensi tampilan.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ view, period, regions, konsolCol, showPaltung, fs })
      );
    } catch {
      /* abaikan kuota localStorage */
    }
  }, [view, period, regions, konsolCol, showPaltung, fs]);

  // Hanya tawarkan periode yang lolos validasi (kontrak API).
  const passedPeriods = useMemo(() => periods.filter((p) => p.validation_passed), [periods]);

  const loadPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    try {
      const list = await getPeriods();
      setPeriods(list);
      const passed = list.filter((p) => p.validation_passed);
      setPeriod((prev) => {
        if (prev && passed.some((p) => p.key === prev)) return prev;
        return passed[0]?.key ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar periode");
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  // Muat data periode terpilih.
  useEffect(() => {
    if (!period) {
      setData(null);
      return;
    }
    let alive = true;
    setLoadingData(true);
    setError(null);
    getPeriod(period)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err) => {
        if (alive) {
          setData(null);
          setError(err instanceof Error ? err.message : "Gagal memuat data periode");
        }
      })
      .finally(() => {
        if (alive) setLoadingData(false);
      });
    return () => {
      alive = false;
    };
  }, [period]);

  /* ---------- turunan ---------- */
  const periodLabel = data?.meta.period_label ?? passedPeriods.find((p) => p.key === period)?.label ?? "";
  const sdKonsol = useMemo<EntityData | null>(() => {
    if (!data) return null;
    const key = (data.meta.period_label || "").toUpperCase();
    return data.konsol[key] ?? null;
  }, [data]);

  const columns = useMemo<Column[]>(() => {
    if (!data) return [];
    if (view === "konsol") {
      return Object.keys(data.konsol).map((k) => ({
        label: k.replace(/ 20\d\d$/, ""),
        tint: /^SD/i.test(k) ? "JTTS" : "DIVISI",
        data: data.konsol[k]
      }));
    }
    if (view === "regional") {
      const cols: Column[] = REGIONS.filter((r) => regions.includes(r.id)).map((r) => ({
        label: r.label,
        tint: r.id,
        data: data.entities[r.id] ?? {}
      }));
      if (konsolCol && sdKonsol) {
        cols.push({ label: "KONSOLIDASI", tint: "PBBL", konsol: true, data: sdKonsol });
      }
      return cols;
    }
    // ruas — PALTUNG disembunyikan secara default (opt-in lewat pill).
    const list = RUAS.filter((x) => x.always || regions.includes(x.grp)).filter(
      (x) => x.id !== "PALTUNG" || showPaltung
    );
    return list.map((x) => ({
      label: x.id,
      tint: x.grp,
      data: data.entities[x.id] ?? {}
    }));
  }, [data, view, regions, konsolCol, showPaltung, sdKonsol]);

  const periodOptions: SelectOption[] = passedPeriods.map((p) => ({ value: p.key, label: p.label }));

  const viewTitle =
    view === "konsol"
      ? "Laba Rugi — Konsolidasi"
      : view === "regional"
        ? "Laba Rugi — Per Regional"
        : "Laba Rugi — Per Ruas";

  const footNote =
    view === "konsol"
      ? "Kolom Total resmi = JKT + JTTS + PBBL + DIVISI (pusat)."
      : view === "ruas"
        ? "Ruas dikelompokkan per regional (warna). JTTS = SUMBAGSEL + SUMBAGTENG + SUMBAGUT."
        : "HPP (%) = Beban Langsung ÷ Pendapatan Usaha · JTTS sudah mencakup 3 regional Sumatra.";

  /* ---------- aksi ---------- */
  function toggleRegion(id: string) {
    setRegions((prev) => {
      if (id === "__all") return prev.length === REGIONS.length ? [] : ALL_REGION_IDS;
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return ALL_REGION_IDS.filter((x) => next.includes(x));
    });
  }

  function toggleFullscreen() {
    const el = pageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => {});
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const res: ImportResult = await importPeriod(file);
      toast.success("Impor berhasil", `${res.period_label} tersimpan & lolos validasi.`);
      await loadPeriods();
      setPeriod(res.period_key);
      if (res.validation) setValidationView(res.validation);
    } catch (err) {
      if (err instanceof ApiError && err.payload && typeof err.payload === "object") {
        const summary = err.payload as Partial<ImportResult>;
        if (summary.validation) {
          setValidationView(summary.validation);
          toast.error(
            "Validasi gagal",
            `${summary.validation.n_failed} dari ${summary.validation.n_checks} cek tidak lolos. Data tidak disimpan.`
          );
        } else {
          toast.error("Impor gagal", err.message);
        }
      } else {
        toast.error("Impor gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ---------- render ---------- */
  const tableStyle = { "--lr-fs": `${fs}px` } as CSSProperties;
  const headerColspan = columns.length * 2;

  return (
    <div className={styles.page} ref={pageRef}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>{viewTitle}</h1>
          <div className={styles.sub}>
            Periode <b>{periodLabel || "—"}</b> · Nilai dalam <b>Rp juta</b> · Sumber: LR_CF_PER_RUAS
          </div>
        </div>
        <div className={styles.headSpacer} />
        {canWrite && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onFilePicked(e.target.files?.[0])}
            />
            <Button
              variant="primary"
              icon={uploading ? "loader" : "upload"}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Mengunggah…" : "Upload Periode"}
            </Button>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as View)} items={TABS} />

      {/* Toolbar (satu baris, minimalis) */}
      <div className={styles.toolbar}>
        <Select
          value={period}
          onValueChange={setPeriod}
          options={periodOptions}
          placeholder="Pilih periode"
          icon="calendar"
          ariaLabel="Pilih periode"
        />

        {view !== "konsol" && (
          <div className={styles.pills}>
            <button
              type="button"
              className={styles.pill}
              aria-pressed={regions.length === REGIONS.length}
              onClick={() => toggleRegion("__all")}
            >
              Semua
            </button>
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.pill}
                aria-pressed={regions.includes(r.id)}
                onClick={() => toggleRegion(r.id)}
              >
                <span className={styles.dot} style={{ background: `var(--lr-${r.id})` }} />
                {r.label}
              </button>
            ))}
            {view === "ruas" && (
              <button
                type="button"
                className={styles.pill}
                aria-pressed={showPaltung}
                onClick={() => setShowPaltung((v) => !v)}
                title="Tampilkan ruas PALTUNG (disembunyikan secara default)"
              >
                <span className={styles.dot} style={{ background: "var(--lr-SUMBAGSEL)" }} />
                PALTUNG
              </button>
            )}
          </div>
        )}

        {view === "regional" && (
          <label className={styles.optRow}>
            <Switch checked={konsolCol} onCheckedChange={setKonsolCol} ariaLabel="Tampilkan kolom Total" />
            <span>Kolom Total</span>
          </label>
        )}

        <div className={styles.headSpacer} />

        <div className={styles.sizer}>
          <Button size="sm" iconOnly icon="minus" title="Perkecil teks" disabled={fs <= FS_MIN} onClick={() => setFs((v) => Math.max(FS_MIN, v - 1))} />
          <Button size="sm" iconOnly icon="plus" title="Perbesar teks" disabled={fs >= FS_MAX} onClick={() => setFs((v) => Math.min(FS_MAX, v + 1))} />
        </div>
        <Button size="sm" iconOnly icon="maximize" title="Layar Penuh" onClick={toggleFullscreen} />
      </div>

      {/* Tabel / status */}
      {loadingPeriods || loadingData ? (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      ) : error ? (
        <div className={styles.stateBox}>
          <EmptyState icon="triangle-alert" title="Gagal memuat" description={error}>
            <Button icon="refresh-cw" onClick={() => void loadPeriods()}>
              Coba lagi
            </Button>
          </EmptyState>
        </div>
      ) : !passedPeriods.length ? (
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada periode"
            description="Belum ada periode Laba Rugi yang lolos validasi untuk ditampilkan."
          />
        </div>
      ) : data && columns.length ? (
        <div className={styles.tableCard}>
          <div className={styles.scroll}>
            <table className={styles.table} style={tableStyle}>
              <thead>
                <tr>
                  <th className={styles.cUraian} rowSpan={3}>
                    Uraian
                  </th>
                  <th className={styles.hTitle} colSpan={headerColspan}>
                    {view === "konsol" ? "Agustus · SD Agustus · September · SD September" : periodLabel}
                  </th>
                </tr>
                <tr>
                  {columns.map((c, i) => (
                    <th
                      key={`${c.label}-${i}`}
                      className={`${styles.hReg} ${styles.grp}`}
                      colSpan={2}
                      style={{ background: `var(--lr-${c.tint})` }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.map((c, i) => (
                    <Fragment key={`${c.label}-${i}`}>
                      <th className={`${styles.hSub} ${styles.grp}`}>RKAP</th>
                      <th className={styles.hSub}>REAL</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const rowCls =
                    row.type === "hpp"
                      ? styles.rHpp
                      : row.type === "section"
                        ? styles.rSection
                        : row.type === "total"
                          ? styles.rTotal
                          : styles.rSub;
                  const isPct = row.id === "hpp";
                  return (
                    <tr key={row.id} className={rowCls}>
                      <td className={styles.cUraian}>{row.label}</td>
                      {columns.map((c, i) => {
                        const v = cellVal(c.data, row.id);
                        const a = isPct ? fmtPct(v[0]) : fmtNum(v[0]);
                        const b = isPct ? fmtPct(v[1]) : fmtNum(v[1]);
                        return (
                          <Fragment key={`${row.id}-${i}`}>
                            <td className={`${styles.rkap} ${styles.grp} ${a.neg ? styles.neg : ""}`}>{a.t}</td>
                            <td className={`${styles.real} ${b.neg ? styles.neg : ""}`}>{b.t}</td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.stateBox}>
          <EmptyState icon="filter" title="Tidak ada kolom" description="Pilih minimal satu regional untuk ditampilkan." />
        </div>
      )}

      {/* Catatan kaki */}
      <div className={styles.foot}>
        <div className={styles.legend}>
          <span>
            <i className={styles.sw} style={{ background: "var(--lr-total)" }} /> Baris utama
          </span>
          <span>
            <i className={styles.sw} style={{ background: "var(--lr-section)" }} /> Kelompok
          </span>
          <span>
            <span className={styles.neg} style={{ fontWeight: 700 }}>
              ( )
            </span>{" "}
            Negatif
          </span>
        </div>
        <div>{footNote}</div>
      </div>

      {/* Ringkasan validasi (upload) */}
      <Modal
        open={!!validationView}
        onOpenChange={(o) => !o && setValidationView(null)}
        title="Hasil Validasi"
        width={560}
      >
        {validationView && (
          <div className={styles.validation}>
            <div className={`${styles.valSummary} ${validationView.passed ? styles.valOk : styles.valWarn}`}>
              {validationView.passed
                ? `Lolos — ${validationView.n_checks} cek tanpa kegagalan.`
                : `WARN — ${validationView.n_failed} dari ${validationView.n_checks} cek gagal. Data tidak disimpan.`}
            </div>
            <ul className={styles.valList}>
              {validationView.checks
                .filter((c) => validationView.passed || !c.ok)
                .map((c, i) => (
                  <li key={i} className={c.ok ? styles.valPass : styles.valFail}>
                    <span className={styles.valMark}>{c.ok ? "✓" : "✕"}</span>
                    <span>
                      <b>{c.check}</b>
                      {c.detail ? <span className={styles.valDetail}> — {c.detail}</span> : null}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
