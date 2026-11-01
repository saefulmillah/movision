import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Select, Tabs, useToast } from "@/components/ui";
import type { SelectOption, TabItem } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  getLrScopeView,
  getLrScopePeriods,
  uploadLrScopeDataset,
  type LrScopePeriod
} from "@/lib/labaRugi";
import {
  getPresentationScopes,
  flattenScopes,
  type PresentationScope,
  type PresentationScopesResponse
} from "@/lib/presentationScope";
import type { Cell, EntityData, PeriodData } from "@/types/labaRugi";
import styles from "../../laba-rugi/LabaRugiPage.module.css";

// ============================================================================
// Fitur "Laba Rugi Regional" (alur pra-rakor). Regional/cabang mengunggah file
// kinerja & melihat L/R LENGKAP (ringkasan + breakdown) per scope-nya. Dataset
// per-scope (Model B) dipakai juga oleh slide presentasi. View penuh: Konsolidasi
// (4 kolom periode entitas scope) + Per Ruas (anggota), breakdown dapat diperluas.
// ============================================================================

type View = "konsol" | "ruas";

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
// Baris yang punya rincian (breakdown) dari file kinerja.
const EXPANDABLE_PARENTS = ["beban_i", "beban_ii", "beban_iii", "beban_usaha", "bunga", "pajak_tangguhan"];

type BreakdownItem = { seq: number; label: string; rkap: number | null; real: number | null };

const TABS: TabItem[] = [
  { value: "konsol", label: "Konsolidasi", icon: "layers" },
  { value: "ruas", label: "Per Ruas", icon: "route" }
];

const FS_MIN = 11;
const FS_MAX = 20;
const FS_DEFAULT = 13.5;

const MONTH_TITLE_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Opsi periode = awal tahun s.d bulan berjalan (tahun berjalan).
function buildPeriodOptions(): SelectOption[] {
  const now = new Date();
  const year = now.getFullYear();
  const cur = now.getMonth() + 1;
  const out: SelectOption[] = [];
  for (let m = 1; m <= cur; m++) {
    out.push({ value: `${year}-${String(m).padStart(2, "0")}`, label: `${MONTH_TITLE_ID[m - 1]} ${year}` });
  }
  return out;
}

function fmtNum(v: number | null | undefined): { t: string; neg: boolean } {
  if (v == null) return { t: "–", neg: false };
  const r = Math.round(v);
  if (r === 0) return { t: "–", neg: false };
  const neg = r < 0;
  const s = Math.abs(r).toLocaleString("en-US");
  return { t: neg ? `(${s})` : s, neg };
}
function fmtPct(v: number | null | undefined): { t: string; neg: boolean } {
  if (v == null) return { t: "–", neg: false };
  return { t: `${Math.round(v)}%`, neg: v > 100 };
}
function hppOf(d: EntityData): Cell {
  const bl = d.beban_langsung;
  const pu = d.pend_usaha;
  const f = (b?: number | null, p?: number | null) => (p == null || p === 0 || b == null ? null : (b / p) * 100);
  return [f(bl?.[0], pu?.[0]), f(bl?.[1], pu?.[1])];
}
function cellVal(d: EntityData, rowId: string): Cell {
  if (rowId === "hpp") return hppOf(d);
  return d[rowId] ?? [null, null];
}

interface Column {
  code: string; // kunci lookup breakdown (label konsol / entity code)
  label: string;
  tint: string;
  data: EntityData;
}

export function LabaRugiRegionalPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("laba_rugi_regional");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const [scopeInfo, setScopeInfo] = useState<PresentationScopesResponse | null>(null);
  const [scope, setScope] = useState<PresentationScope | null>(null);
  const periodOptions = useMemo<SelectOption[]>(() => buildPeriodOptions(), []);
  const [period, setPeriod] = useState<string>(() => buildPeriodOptions().slice(-1)[0]?.value ?? "");
  const [uploadedPeriods, setUploadedPeriods] = useState<LrScopePeriod[]>([]);
  const [data, setData] = useState<PeriodData | null>(null);
  const [view, setView] = useState<View>("konsol");
  const [fs, setFs] = useState<number>(FS_DEFAULT);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Muat scope + daftar periode sekali.
  useEffect(() => {
    void getPresentationScopes()
      .then((info) => {
        setScopeInfo(info);
        const all = flattenScopes(info);
        // Default: regional pertama (fitur ini untuk regional/cabang), jika tidak scope default.
        const def = all.find((s) => s.level === "regional") || info.default || all[0] || null;
        setScope(def);
      })
      .catch(() => setScopeInfo(null));
  }, []);

  const scopeOptions: SelectOption[] = useMemo(() => {
    const all = flattenScopes(scopeInfo).filter((s) => s.level !== "divisi" || (scopeInfo?.canDrill ?? false));
    return all.map((s) => ({
      value: s.key,
      label: s.level === "cabang" ? `  • ${s.label}` : s.label
    }));
  }, [scopeInfo]);

  const isUploadScope = scope?.level === "regional"; // hanya regional yang mengunggah
  const periodUploaded = useMemo(
    () => (period ? uploadedPeriods.find((p) => p.period_key === period) ?? null : null),
    [uploadedPeriods, period]
  );

  // Daftar periode kinerja yang sudah diunggah untuk scope aktif (status upload).
  const refreshUploaded = useCallback(() => {
    if (!scope) {
      setUploadedPeriods([]);
      return;
    }
    getLrScopePeriods(scope.key)
      .then((res) => setUploadedPeriods(res.periods ?? []))
      .catch(() => setUploadedPeriods([]));
  }, [scope]);

  useEffect(() => {
    refreshUploaded();
  }, [refreshUploaded]);

  // Muat data view saat scope/period berubah.
  useEffect(() => {
    if (!scope || !period) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    getLrScopeView(period, scope.key)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err) => {
        if (alive) {
          setData(null);
          setError(err instanceof Error ? err.message : "Gagal memuat data");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, period]);

  const empty = !data || (data.meta as { empty?: boolean }).empty || Object.keys(data.konsol || {}).length === 0;

  const columns = useMemo<Column[]>(() => {
    if (!data || empty) return [];
    if (view === "konsol") {
      return Object.keys(data.konsol).map((k) => ({
        code: k,
        label: k.replace(/ 20\d\d$/, ""),
        tint: /^SD/i.test(k) ? "JTTS" : "DIVISI",
        data: data.konsol[k]
      }));
    }
    // Per ruas — entitas anggota.
    return Object.keys(data.entities || {}).map((code) => ({
      code,
      label: code,
      tint: "SUMBAGSEL",
      data: data.entities[code] ?? {}
    }));
  }, [data, view, empty]);

  const breakdownMap = useMemo<Record<string, Record<string, BreakdownItem[]>> | undefined>(() => {
    const bd = data?.breakdown as
      | { konsol?: Record<string, Record<string, BreakdownItem[]>>; entity?: Record<string, Record<string, BreakdownItem[]>> }
      | undefined;
    return view === "konsol" ? bd?.konsol : bd?.entity;
  }, [data, view]);

  const itemsOf = (col: Column, parentId: string): BreakdownItem[] => breakdownMap?.[col.code]?.[parentId] || [];
  const canExpand = (parentId: string) =>
    EXPANDABLE_PARENTS.includes(parentId) && columns.some((c) => itemsOf(c, parentId).length > 0);
  const repItems = (parentId: string) =>
    columns.map((c) => itemsOf(c, parentId)).reduce((a, b) => (b.length > a.length ? b : a), [] as BreakdownItem[]);
  const toggleRow = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  async function onFilePicked(file: File | undefined) {
    if (!file || !scope || !period) {
      if (!period) toast.error("Pilih periode dulu", "Tentukan periode sebelum mengunggah.");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadLrScopeDataset(scope.key, period, file);
      toast.success("Data kinerja tersimpan", `${res.period_label}: ${res.entity_count} entitas untuk ${scope.label}.`);
      refreshUploaded();
      const fresh = await getLrScopeView(period, scope.key);
      setData(fresh);
    } catch (err) {
      toast.error("Upload gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleFullscreen() {
    const el = pageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => {});
  }

  const periodLabel = data?.meta.period_label ?? periodOptions.find((p) => p.value === period)?.label ?? "";
  const tableStyle = { "--lr-fs": `${fs}px` } as CSSProperties;
  const headerColspan = columns.length * 2;
  const rowTypeCls = (t: string) =>
    t === "hpp" ? styles.rHpp : t === "section" ? styles.rSection : t === "total" ? styles.rTotal : styles.rSub;

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Laba Rugi Regional</h1>
          <div className={styles.sub}>
            Lingkup <b>{scope?.label || "—"}</b> · Periode <b>{periodLabel || "—"}</b> · Nilai dalam <b>Rp juta</b> ·
            Kinerja: <b>{periodUploaded ? "ada" : "belum"}</b>
          </div>
        </div>
        <div className={styles.headSpacer} />
        {canWrite && isUploadScope && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onFilePicked(e.target.files?.[0])}
            />
            <Button
              variant="primary"
              icon={uploading ? "loader" : "upload"}
              disabled={uploading || !period}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Mengunggah…" : "Upload Kinerja"}
            </Button>
          </>
        )}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} items={TABS} />

      <div className={styles.toolbar}>
        <Select value={scope?.key ?? ""} onValueChange={(k) => setScope(flattenScopes(scopeInfo).find((s) => s.key === k) ?? null)} options={scopeOptions} placeholder="Pilih lingkup" icon="layers" ariaLabel="Lingkup" />
        <Select value={period} onValueChange={setPeriod} options={periodOptions} placeholder="Pilih periode" icon="calendar" ariaLabel="Periode" />
        <div className={styles.headSpacer} />
        <div className={styles.sizer}>
          <Button size="sm" iconOnly icon="minus" title="Perkecil teks" disabled={fs <= FS_MIN} onClick={() => setFs((v) => Math.max(FS_MIN, v - 1))} />
          <Button size="sm" iconOnly icon="plus" title="Perbesar teks" disabled={fs >= FS_MAX} onClick={() => setFs((v) => Math.min(FS_MAX, v + 1))} />
        </div>
        <Button size="sm" iconOnly icon="maximize" title="Layar Penuh" onClick={toggleFullscreen} />
      </div>

      {loading ? (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      ) : error ? (
        <div className={styles.stateBox}>
          <EmptyState icon="triangle-alert" title="Gagal memuat" description={error} />
        </div>
      ) : empty ? (
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data kinerja"
            description={
              isUploadScope
                ? "Unggah file kinerja (.xlsx) untuk lingkup & periode ini agar tabel tampil."
                : "Data cabang berasal dari upload kinerja regional induk. Minta regional mengunggah file kinerjanya."
            }
          />
        </div>
      ) : columns.length ? (
        <div className={styles.tableCard}>
          <div className={styles.scroll}>
            <table className={styles.table} style={tableStyle}>
              <thead>
                <tr>
                  <th className={styles.cUraian} rowSpan={3}>
                    Uraian
                  </th>
                  <th className={styles.hTitle} colSpan={headerColspan}>
                    {view === "konsol" ? "Periode berjalan & proyeksi" : periodLabel}
                  </th>
                </tr>
                <tr>
                  {columns.map((c, i) => (
                    <th key={`${c.code}-${i}`} className={`${styles.hReg} ${styles.grp}`} colSpan={2} style={{ background: `var(--lr-${c.tint})` }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.map((c, i) => (
                    <Fragment key={`${c.code}-${i}`}>
                      <th className={`${styles.hSub} ${styles.grp}`}>RKAP</th>
                      <th className={styles.hSub}>REAL</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const isPct = row.id === "hpp";
                  const expandable = canExpand(row.id);
                  const isOpen = expandable && !!expanded[row.id];
                  const items = isOpen ? repItems(row.id) : [];
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={rowTypeCls(row.type)}
                        onClick={expandable ? () => toggleRow(row.id) : undefined}
                        style={expandable ? { cursor: "pointer" } : undefined}
                      >
                        <td className={styles.cUraian}>
                          {expandable ? (isOpen ? "▾ " : "▸ ") : ""}
                          {row.label}
                        </td>
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
                      {isOpen &&
                        items.map((_, idx) => (
                          <tr key={`${row.id}-item-${idx}`} className={styles.rSub}>
                            <td className={styles.cUraian} style={{ paddingLeft: 26, opacity: 0.85, fontStyle: "italic" }}>
                              {repItems(row.id)[idx]?.label || ""}
                            </td>
                            {columns.map((c, i) => {
                              const it = itemsOf(c, row.id)[idx];
                              const a = fmtNum(it?.rkap);
                              const b = fmtNum(it?.real);
                              return (
                                <Fragment key={`${row.id}-item-${idx}-${i}`}>
                                  <td className={`${styles.rkap} ${styles.grp} ${a.neg ? styles.neg : ""}`} style={{ opacity: 0.85 }}>{a.t}</td>
                                  <td className={`${styles.real} ${b.neg ? styles.neg : ""}`} style={{ opacity: 0.85 }}>{b.t}</td>
                                </Fragment>
                              );
                            })}
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.stateBox}>
          <EmptyState icon="filter" title="Tidak ada kolom" description="Tidak ada entitas untuk ditampilkan pada lingkup ini." />
        </div>
      )}

      <div className={styles.foot}>
        <div>
          Klik baris <b>Beban I/II/III, Beban Usaha, Bunga, Pajak</b> untuk menampilkan rinciannya. Satu file kinerja
          regional mengisi lingkup regional & tiap cabangnya.
        </div>
      </div>
    </div>
  );
}
